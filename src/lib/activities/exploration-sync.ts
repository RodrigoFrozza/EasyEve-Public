import { prisma } from '@/lib/prisma'
import { getCharacterLocation, getCharacterShip } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import type { Activity } from '@prisma/client'
import { Prisma } from '@prisma/client'

/**
 * Background sync metadata patch. Location/ship polling is not player progress;
 * stale auto-pause uses `lastDataAt`, log dates, or manual entries — not `lastSyncAt`.
 */
function latestExplorationProgressAt(data: Record<string, unknown>): string | null {
  const logs =
    (data.logs as Array<{ type?: string; date?: string; value?: number; amount?: number }>) || []
  let latestMs: number | null = null

  for (const log of logs) {
    if (log.type !== 'loot' && log.type !== 'site') continue
    const hasValue = (Number(log.value) || Number(log.amount) || 0) > 0
    if (!hasValue && log.type !== 'site') continue
    const ts = log.date ? Date.parse(log.date) : NaN
    if (!Number.isFinite(ts)) continue
    if (latestMs == null || ts > latestMs) latestMs = ts
  }

  return latestMs != null ? new Date(latestMs).toISOString() : null
}

export function buildExplorationSyncDataPatch(
  activityData: Record<string, unknown>,
  syncAt: string,
  mainParticipant: { location?: unknown } | undefined
): Record<string, unknown> {
  const nextLocation = mainParticipant?.location || activityData.currentSystem
  const locationChanged =
    typeof nextLocation === 'string' &&
    nextLocation.length > 0 &&
    nextLocation !== activityData.currentSystem

  const latestProgress = latestExplorationProgressAt(activityData)
  const currentLastDataAt =
    typeof activityData.lastDataAt === 'string' ? activityData.lastDataAt : null
  let nextLastDataAt: string | undefined

  if (locationChanged) {
    nextLastDataAt = syncAt
  } else if (
    latestProgress &&
    (!currentLastDataAt || Date.parse(latestProgress) > Date.parse(currentLastDataAt))
  ) {
    nextLastDataAt = latestProgress
  }

  return {
    ...activityData,
    currentSystem: nextLocation || activityData.currentSystem,
    lastSyncLocation: mainParticipant?.location,
    lastSyncAt: syncAt,
    ...(nextLastDataAt ? { lastDataAt: nextLastDataAt } : {}),
  }
}

export type ExplorationSyncParticipantError = {
  characterId: number
  characterName?: string
  error: string
}

/**
 * Sync exploration activity participant location/ship from ESI.
 * Shared by API route and unified-activity-sync background script.
 */
export async function syncExplorationActivity(activity: Activity) {
  const participants = activity.participants as Array<Record<string, unknown>>
  const updatedParticipants: Record<string, unknown>[] = []
  const syncErrors: ExplorationSyncParticipantError[] = []

  for (const participant of participants) {
    const charId = participant.characterId as number

    try {
      const { accessToken } = await getValidAccessToken(charId)

      if (!accessToken) {
        updatedParticipants.push(participant)
        continue
      }

      const [locationData, shipData] = await Promise.all([
        getCharacterLocation(charId, accessToken),
        getCharacterShip(charId, accessToken),
      ])

      if (locationData.error) {
        syncErrors.push({
          characterId: charId,
          characterName: participant.characterName as string | undefined,
          error: locationData.error,
        })
      }

      await prisma.character.update({
        where: { id: charId },
        data: {
          location: locationData.location || (participant.location as string),
          ship: shipData.ship || (participant.shipName as string),
          shipTypeId: shipData.shipTypeId || (participant.shipTypeId as number),
        },
      })

      const shipTypeId = shipData.shipTypeId || (participant.shipTypeId as number)
      updatedParticipants.push({
        ...participant,
        location: locationData.location || participant.location,
        shipName: shipData.ship || participant.shipName,
        shipTypeId: shipData.shipTypeId || participant.shipTypeId,
        lastShipTypeId:
          shipTypeId && shipTypeId !== 670
            ? shipTypeId
            : (participant.lastShipTypeId || participant.shipTypeId),
      })
    } catch (error) {
      syncErrors.push({
        characterId: charId,
        characterName: participant.characterName as string | undefined,
        error: error instanceof Error ? error.message : String(error),
      })
      updatedParticipants.push(participant)
    }
  }

  const mainParticipant = updatedParticipants[0]
  const syncAt = new Date().toISOString()
  const expectedUpdatedAt = activity.updatedAt

  // Re-read the freshest data right before writing and guard the write with the
  // original updatedAt, otherwise this sync (which can take a while due to the ESI
  // round-trips above) can overwrite logs/loot added concurrently (e.g. add-site)
  // with the stale snapshot captured when the sync started.
  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.activity.findFirst({
      where: { id: activity.id, updatedAt: expectedUpdatedAt },
    })
    if (!fresh) return null

    const freshData = (fresh.data as Record<string, unknown>) || {}
    const dataPatch = buildExplorationSyncDataPatch(freshData, syncAt, mainParticipant)

    const result = await tx.activity.updateMany({
      where: { id: activity.id, updatedAt: expectedUpdatedAt },
      data: {
        participants: updatedParticipants as object,
        region: (mainParticipant?.location as string) || activity.region,
        data: {
          ...dataPatch,
          syncErrors,
        } as Prisma.InputJsonValue,
      },
    })
    if (result.count === 0) return null
    return tx.activity.findUnique({ where: { id: activity.id } })
  })

  if (!updated) {
    const latest = await prisma.activity.findUnique({ where: { id: activity.id } })
    return latest ?? activity
  }

  return updated
}
