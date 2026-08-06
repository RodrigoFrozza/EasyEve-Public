import type { Activity } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCharacterWalletJournal } from '@/lib/esi'
import { logger } from '@/lib/server-logger'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import {
  buildRattingLogFromJournalEntry,
  classifyRattingJournalRefType,
  normalizeRattingLog,
  rattingLogMapHasEquivalent,
  registerRattingLogInMap,
  type RattingLogLike,
} from '@/lib/activities/ratting-log-dedup'
import { hasActiveActivityForCharacter } from '@/lib/activities/activity-participant-queries'
import { hasTrackableTag } from '@/lib/activities/trackable-tags'
import { getRattingDetectionWindowStart } from '@/lib/activities/ratting-detection-window'
import { RATTING_POST_COMPLETE_SYNC_MINUTES } from '@/lib/constants/ratting'

const component = 'Activity:Sync'

export type RattingSyncParticipantError = {
  characterId: number
  characterName: string
  error: string
}

function participantErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

function journalHasRattingEntrySince(
  journal: Array<{ date: string; ref_type?: string }> | null | undefined,
  windowStart: Date
): boolean {
  if (!Array.isArray(journal)) return false
  return journal.some((entry) => {
    const entryDate = new Date(entry.date)
    const refType = (entry.ref_type || '').toLowerCase()
    return entryDate >= windowStart && classifyRattingJournalRefType(refType) != null
  })
}

/**
 * Adds missing ratter-tagged characters with bounty since activity start (auto-tracked only).
 */
export async function backfillAutoTrackedRattingParticipants(
  activity: Activity
): Promise<Activity> {
  const activityData = (activity.data as Record<string, unknown> | null) ?? {}
  if (!activityData.isAutoTracked) return activity

  const participants =
    (activity.participants as Array<{ characterId: number; characterName?: string; fit?: null }>) ||
    []
  const participantIds = new Set(participants.map((p) => p.characterId))
  const windowStart = getRattingDetectionWindowStart(new Date(activity.startTime))

  const characters = await prisma.character.findMany({
    where: { userId: activity.userId },
  })

  const toAdd: Array<{ characterId: number; characterName: string; fit: null }> = []

  for (const char of characters) {
    if (participantIds.has(char.id)) continue
    if (!hasTrackableTag(char.tags as string[], 'ratter')) continue

    const otherActive = await hasActiveActivityForCharacter(
      activity.userId,
      char.id,
      'ratting'
    )
    if (otherActive && otherActive.id !== activity.id && !otherActive.isPaused) continue

    try {
      const journal = await getCharacterWalletJournal(char.id, windowStart)
      if (!journalHasRattingEntrySince(journal, windowStart)) continue

      toAdd.push({ characterId: char.id, characterName: char.name, fit: null })
      participantIds.add(char.id)
    } catch (err) {
      logger.debug(
        component,
        `Backfill skip for ${char.name} (${char.id}): ${participantErrorMessage(err)}`
      )
    }
  }

  if (toAdd.length === 0) return activity

  const updatedParticipants = [...participants, ...toAdd]
  logger.info(component, `Backfilled ${toAdd.length} ratting participant(s) for activity ${activity.id}`)

  return prisma.activity.update({
    where: { id: activity.id },
    data: {
      participants: updatedParticipants,
      data: {
        ...activityData,
        detectedCharacters: updatedParticipants.length,
      } as Prisma.InputJsonValue,
    },
  })
}

function reclassifyLogsFromJournal(
  logs: RattingLogLike[],
  journalTypesByRefId: Map<string, 'bounty' | 'ess' | 'tax'>
): RattingLogLike[] {
  return logs.map((log) => {
    const refId = log.refId != null && log.refId !== '' ? String(log.refId) : null
    if (!refId) return log
    const journalType = journalTypesByRefId.get(refId)
    if (!journalType || log.type === journalType) return log
    return normalizeRattingLog({ ...log, type: journalType }, log.charId)
  })
}

const WALLET_SYNC_ACTIVITY_TYPES = new Set(['ratting', 'escalations'])

function isWalletSyncActivityType(type: string): boolean {
  return WALLET_SYNC_ACTIVITY_TYPES.has(type)
}

/**
 * Server-only bounty/ESS wallet sync for ratting and escalations activities.
 */
export async function syncRattingWalletForActivity(activity: Activity): Promise<Activity> {
  const activityId = activity.id

  if (!isWalletSyncActivityType(activity.type)) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Sync only supported for ratting and escalations activities',
      400
    )
  }

  if (activity.type === 'ratting') {
    activity = await backfillAutoTrackedRattingParticipants(activity)
  }

  const participants = activity.participants as Array<{
    characterId: number
    characterName?: string
  }>
  if (!participants || participants.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No participants to sync', 400)
  }

  const startTimeManual = new Date(activity.startTime)
  const startTime = new Date(startTimeManual.getTime() - 30 * 60 * 1000)
  // Bounty/tax entries must not bleed past the session's own end — otherwise they can be
  // absorbed again by a subsequently auto-detected session covering the same time range,
  // double-counting the same ISK across two sessions. ESS payouts genuinely lag up to
  // ~2h48m after the tick, so only they get the extended post-complete window.
  const baseEndTimeLimit = activity.endTime
    ? new Date(activity.endTime)
    : new Date(Date.now() + 5 * 60 * 1000)
  const essEndTimeLimit = activity.endTime
    ? new Date(new Date(activity.endTime).getTime() + RATTING_POST_COMPLETE_SYNC_MINUTES * 60 * 1000)
    : baseEndTimeLimit

  logger.info(component, `START INCREMENTAL SYNC for Activity ID: ${activityId}`)
  logger.info(component, `Window (UTC): ${startTime.toISOString()} to ${baseEndTimeLimit.toISOString()} (ess until ${essEndTimeLimit.toISOString()})`)

  const journalTypesByRefId = new Map<string, 'bounty' | 'ess' | 'tax'>()
  const newCandidates: RattingLogLike[] = []
  let totalExisting = 0
  let totalNewCount = 0
  let successfulParticipants = 0
  const syncErrors: RattingSyncParticipantError[] = []

  for (const participant of participants) {
    const charId = participant.characterId
    const charName = participant.characterName || `Citizen ${charId}`

    try {
      const journal = await getCharacterWalletJournal(charId, startTime)
      successfulParticipants++

      if (Array.isArray(journal)) {
        logger.info(component, `${charName}: Fetched ${journal.length} entries from ESI.`)

        journal.forEach((entry: { date: string; ref_type?: string; id?: number; amount?: number }) => {
          const entryDate = new Date(entry.date)
          const refType = (entry.ref_type || '').toLowerCase()
          const refId = entry.id?.toString()
          if (!refId || entryDate < startTime) return

          const type = classifyRattingJournalRefType(refType)
          if (!type) return

          const typeEndTimeLimit = type === 'ess' ? essEndTimeLimit : baseEndTimeLimit
          if (entryDate > typeEndTimeLimit) return

          journalTypesByRefId.set(refId, type)
          const candidate = buildRattingLogFromJournalEntry(
            { id: entry.id!, date: entry.date, amount: entry.amount || 0 },
            charId,
            charName,
            type
          )
          newCandidates.push(candidate)
        })
      }
    } catch (err) {
      const errorMessage = participantErrorMessage(err)
      syncErrors.push({ characterId: charId, characterName: charName, error: errorMessage })
      logger.error(component, `Failed to sync earnings for character ${charName} (${charId})`, err)
    }
  }

  if (successfulParticipants === 0) {
    const activityData = (activity.data as Record<string, unknown>) || {}
    const updatedData = {
      ...activityData,
      syncErrors,
      lastSyncFailedAt: new Date().toISOString(),
    }

    logger.warn(component, 'All participant syncs failed', {
      event: 'sync_ratting_all_failed',
      activityId,
      syncErrors,
    })

    return prisma.activity.update({
      where: { id: activityId },
      data: { data: updatedData as Prisma.InputJsonValue },
    })
  }

  const expectedUpdatedAt = activity.updatedAt
  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.activity.findFirst({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
    })
    if (!fresh) {
      return tx.activity.findUnique({ where: { id: activityId } })
    }

    const activityData = (fresh.data as Record<string, unknown>) || {}
    const existingLogs = (activityData.logs as RattingLogLike[]) || []
    const logMap = new Map<string, ReturnType<typeof normalizeRattingLog>>()

    const reclassifiedExisting = reclassifyLogsFromJournal(existingLogs, journalTypesByRefId)
    reclassifiedExisting.forEach((log) => {
      const participantCharId = participants.find(
        (p) =>
          p.characterId === log.charId ||
          p.characterId === (log as RattingLogLike & { characterId?: number }).characterId ||
          p.characterName === log.charName
      )?.characterId
      registerRattingLogInMap(logMap, log, participantCharId)
    })

    for (const candidate of newCandidates) {
      const charId = candidate.charId
      if (!charId) continue
      if (!rattingLogMapHasEquivalent(logMap, candidate, charId)) {
        logger.debug(
          component,
          `NEW ${String(candidate.type).toUpperCase()}: ${(candidate.amount ?? 0).toLocaleString()} ISK`
        )
        totalNewCount++
        registerRattingLogInMap(logMap, candidate, charId)
      } else {
        totalExisting++
      }
    }

    const allLogs = Array.from(
      new Map(
        Array.from(logMap.values()).map((log) => [
          `${log.charId ?? 0}-${log.refId ?? ''}-${log.type}-${new Date(log.date).getTime()}`,
          normalizeRattingLog(log),
        ])
      ).values()
    )

    let totalBounties = 0
    let totalEss = 0
    let totalTaxes = 0
    const participantEarnings: Record<number, number> = {}

    allLogs.forEach((log) => {
      if (log.type === 'bounty') {
        totalBounties += log.amount ?? 0
        if (log.charId) {
          participantEarnings[log.charId] = (participantEarnings[log.charId] || 0) + (log.amount ?? 0)
        }
      } else if (log.type === 'ess') {
        totalEss += log.amount ?? 0
        if (log.charId) {
          participantEarnings[log.charId] = (participantEarnings[log.charId] || 0) + (log.amount ?? 0)
        }
      } else if (log.type === 'tax') {
        totalTaxes += Math.abs(log.amount ?? 0)
      }
    })

    allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const lastEssPaymentAt = allLogs.find((log) => log.type === 'ess')?.date

    const additionalBounties = Number(activityData.additionalBounties) || 0
    const durationMs = getActivityDurationMs({
      startTime: fresh.startTime,
      endTime: fresh.endTime,
      status: fresh.status,
      accumulatedPausedTime: fresh.accumulatedPausedTime ?? undefined,
      isPaused: fresh.isPaused,
      pausedAt: fresh.pausedAt,
    })
    const hoursElapsed = durationMs / 3600000

    const currentTotalIsk =
      totalBounties +
      additionalBounties +
      totalEss +
      (Number(activityData.estimatedLootValue) || 0) +
      (Number(activityData.estimatedSalvageValue) || 0)
    const currentIskPerHour = currentTotalIsk / Math.max(0.1, hoursElapsed)

    const previousIskPerHour = Number(activityData.currentIskPerHour) || 0
    let iskTrend = 'stable'

    if (previousIskPerHour > 0) {
      const diff = currentIskPerHour - previousIskPerHour
      const threshold = previousIskPerHour * 0.05
      if (diff > threshold) iskTrend = 'up'
      else if (diff < -threshold) iskTrend = 'down'
    }

    const previousAutomatedBounties = Number(activityData.automatedBounties) || 0
    const previousAutomatedEss = Number(activityData.automatedEss) || 0
    const previousLogsCount = existingLogs.length
    const totalsChanged =
      previousAutomatedBounties !== totalBounties ||
      previousAutomatedEss !== totalEss ||
      previousLogsCount !== allLogs.length ||
      totalNewCount > 0

    const updatedData = {
      ...activityData,
      automatedBounties: totalBounties,
      automatedEss: totalEss,
      automatedTaxes: totalTaxes,
      grossBounties: totalBounties + totalEss + additionalBounties,
      participantEarnings,
      logs: allLogs,
      currentIskPerHour,
      iskTrend,
      lastSyncAt: new Date().toISOString(),
      lastDataAt: totalsChanged
        ? new Date().toISOString()
        : (activityData.lastDataAt as string | undefined) || activityData.lastSyncWithChangesAt,
      lastSyncWithChangesAt: totalsChanged
        ? new Date().toISOString()
        : activityData.lastSyncWithChangesAt,
      lastSyncChangeCount: totalNewCount,
      syncCount: (Number(activityData.syncCount) || 0) + 1,
      lastEssPaymentAt: lastEssPaymentAt || activityData.lastEssPaymentAt,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
      lastSyncFailedAt: undefined,
    }

    const result = await tx.activity.updateMany({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
      data: { data: updatedData as Prisma.InputJsonValue },
    })

    if (result.count === 0) {
      return null
    }

    return tx.activity.findUnique({ where: { id: activityId } })
  })

  if (!updated) {
    const latest = await prisma.activity.findUnique({ where: { id: activityId } })
    if (latest) return latest
    return activity
  }

  logger.info(component, `END SYNC Summary: ${totalNewCount} New | ${totalExisting} Existing`)
  logger.info(component, 'Sync complete', {
    event: 'sync_ratting_complete',
    activityId,
    totalNew: totalNewCount,
    totalExisting,
    syncErrors: syncErrors.length,
  })

  return updated
}

/**
 * After a character wallet refresh, sync active ratting activities that include those characters.
 */
export async function syncActiveRattingActivitiesForCharacters(
  userId: string,
  characterIds: number[]
): Promise<void> {
  if (characterIds.length === 0) return

  const idSet = new Set(characterIds)
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      type: { in: ['ratting', 'escalations'] },
      status: 'active',
      isDeleted: false,
      isPaused: false,
    },
  })

  const matching = activities.filter((activity) => {
    const parts = activity.participants as Array<{ characterId?: number }> | null
    return parts?.some((p) => p.characterId != null && idSet.has(p.characterId)) ?? false
  })

  for (const activity of matching) {
    try {
      await syncRattingWalletForActivity(activity)
    } catch (err) {
      logger.error(component, `Post-refresh sync failed for activity ${activity.id}`, err)
    }
  }
}
