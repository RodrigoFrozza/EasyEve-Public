import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getCharacterLocation } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import type { Activity, Prisma } from '@prisma/client'
import { logger } from '@/lib/server-logger'
import { isInsideAbyss } from '@/lib/activities/abyssal-detection'
import { getAbyssalRunDefaults } from '@/lib/activities/abyssal-defaults'

const component = 'AbyssalSync'

interface AbyssalRun {
  id: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'death'
  registrationStatus?: 'pending' | 'registered' | 'not_registered'
  tier?: string
  weather?: string
  ship?: string
  lootValue?: number
  beforeCargoState?: string
  afterCargoState?: string
}

export type AbyssalSyncResult =
  | { synced: true; activity: Activity }
  | { synced: false; activity: Activity; reason: string }

function resolveTrackedCharacterId(activity: Activity): number | null {
  const participants = (activity.participants as { characterId?: number }[]) || []
  return activity.characterId ?? participants[0]?.characterId ?? null
}

function normalizeActiveRuns(runs: AbyssalRun[]): AbyssalRun[] {
  const activeIndices = runs
    .map((run, index) => (run.status === 'active' ? index : -1))
    .filter((index) => index >= 0)

  if (activeIndices.length <= 1) return runs

  const keepIndex = activeIndices[activeIndices.length - 1]
  return runs.map((run, index) => {
    if (run.status !== 'active' || index === keepIndex) return run
    return {
      ...run,
      status: 'completed' as const,
      endTime: run.endTime || new Date().toISOString(),
      registrationStatus: 'pending' as const,
    }
  })
}

/**
 * Syncs an Abyssal activity by checking the character's current location.
 * Automatically starts or ends runs if trackingMode is 'automatic'.
 */
export async function syncAbyssalActivity(activity: Activity): Promise<AbyssalSyncResult> {
  const activityId = activity.id

  if (activity.status !== 'active' || activity.isDeleted || activity.isPaused) {
    return { synced: false, activity, reason: 'not_eligible' }
  }

  const activityData = (activity.data as Record<string, unknown>) || {}
  const trackingMode = (activityData.trackingMode as string) || 'automatic'

  if (trackingMode !== 'automatic') {
    return { synced: false, activity, reason: 'manual_mode' }
  }

  const characterId = resolveTrackedCharacterId(activity)
  if (!characterId) {
    logger.warn(component, `No character ID found for activity ${activityId}`)
    return { synced: false, activity, reason: 'no_character' }
  }

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      logger.error(
        component,
        `No access token found for character ${characterId} in activity ${activityId}`
      )
      return { synced: false, activity, reason: 'no_token' }
    }

    const locationData = await getCharacterLocation(characterId, accessToken)
    if (locationData.error) {
      logger.warn(component, `ESI location error for activity ${activityId}: ${locationData.error}`)
      return { synced: false, activity, reason: 'esi_error' }
    }

    const location = locationData.location || ''
    const solarSystemId = locationData.solar_system_id ?? 0
    const insideAbyss = isInsideAbyss(location, solarSystemId)

    const expectedUpdatedAt = activity.updatedAt

    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.activity.findFirst({
        where: { id: activityId, updatedAt: expectedUpdatedAt },
      })
      if (!fresh) {
        const latest = await tx.activity.findUnique({ where: { id: activityId } })
        return latest
      }

      if (fresh.status !== 'active' || fresh.isDeleted || fresh.isPaused) {
        return fresh
      }

      const freshData = (fresh.data as Record<string, unknown>) || {}
      let runs = normalizeActiveRuns(((freshData.runs as AbyssalRun[]) || []).slice())
      const activeRun = runs.find((r) => r.status === 'active')
      let hasChanges = false

      if (insideAbyss && !activeRun) {
        logger.info(
          component,
          `Detected character ${characterId} entered Abyss. Starting run for activity ${activityId}`
        )
        const defaults = getAbyssalRunDefaults(
          freshData.lastRunDefaults as { tier?: string; weather?: string; ship?: string }
        )
        runs.push({
          id: `abyssal-run-${randomUUID()}`,
          startTime: new Date().toISOString(),
          status: 'active',
          registrationStatus: 'pending',
          tier: defaults.tier,
          weather: defaults.weather,
          ship: defaults.ship,
          lootValue: 0,
          beforeCargoState: (freshData.lastCargoState as string) || '',
        })
        hasChanges = true
      } else if (!insideAbyss && activeRun) {
        logger.info(
          component,
          `Detected character ${characterId} exited Abyss. Ending run for activity ${activityId}`
        )
        runs = runs.map((run) =>
          run.id === activeRun.id
            ? {
                ...run,
                status: 'completed' as const,
                endTime: new Date().toISOString(),
                registrationStatus: 'pending' as const,
              }
            : run
        )
        hasChanges = true
      }

      const updatedData = {
        ...freshData,
        runs,
        lastSyncAt: new Date().toISOString(),
        lastDataAt: hasChanges
          ? new Date().toISOString()
          : (freshData.lastDataAt as string | undefined),
      }

      const result = await tx.activity.updateMany({
        where: { id: activityId, updatedAt: expectedUpdatedAt },
        data: { data: updatedData as unknown as Prisma.InputJsonValue },
      })

      if (result.count === 0) {
        return null
      }

      return tx.activity.findUnique({ where: { id: activityId } })
    })

    if (!updated) {
      return { synced: false, activity, reason: 'stale_write' }
    }

    const freshRuns = (updated.data as Record<string, unknown>)?.runs
    const inputRuns = (activity.data as Record<string, unknown>)?.runs
    const didChange = JSON.stringify(inputRuns) !== JSON.stringify(freshRuns)

    return { synced: didChange, activity: updated, reason: didChange ? 'updated' : 'unchanged' }
  } catch (error) {
    logger.error(component, `Failed to sync Abyssal activity ${activityId}`, error)
    throw error
  }
}
