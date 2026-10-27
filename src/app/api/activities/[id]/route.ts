import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { scheduleLootIntelIngest } from '@/lib/analytics/loot-intel-dispatch'
import { retractAbyssalLootForActivity } from '@/lib/analytics/abyssal-loot-intel-ingest'
import { retractSalvagingForActivity } from '@/lib/analytics/salvaging-intel-ingest'
import { retractRattingLootForActivity } from '@/lib/analytics/ratting-loot-intel-ingest'
import { retractExplorationLootForActivity } from '@/lib/analytics/exploration-loot-intel-ingest'
import { retractMiningLootForActivity } from '@/lib/analytics/mining-loot-intel-ingest'
import {
  discardZeroValueActivity,
  isRattingTooYoungToDiscard,
  isZeroGrossActivity,
} from '@/lib/activities/activity-completion-policy'
import { mergeAbyssalRuns } from '@/lib/activities/abyssal-runs-merge'
import { mergeRattingLogs } from '@/lib/activities/ratting-logs-merge'
import {
  applyRattingLootPatch,
  rattingLootDataChanged,
  recalcRattingWalletTotalsFromLogs,
} from '@/lib/activities/ratting-data-recalc'
import { syncRattingWalletForActivity } from '@/lib/activities/ratting-wallet-sync'
import { mergeExplorationLogs, type ExplorationLogLike } from '@/lib/activities/exploration-logs-merge'
import {
  explorationLootDataChanged,
  recalcExplorationLootTotalsFromLogs,
} from '@/lib/activities/exploration-data-recalc'
import { mergeSalvagingLogs, type SalvagingLogLike } from '@/lib/activities/salvaging-logs-merge'
import {
  recalcSalvagingLootTotalsFromLogs,
  salvagingLootDataChanged,
} from '@/lib/activities/salvaging-data-recalc'
import { miningLootDataChanged } from '@/lib/activities/mining-data-recalc'
import { refreshMiningDetectionCacheForActivity } from '@/lib/esi/mining-ledger'
import type { RattingLogEntry, RattingEscalationDrop, RattingExpenseEntry } from '@/lib/activities/ratting-manual-entries'
import { dedupeEscalationDrops, dedupeRattingExpenses } from '@/lib/activities/ratting-manual-entries'
import {
  dedupeEscalations,
  recalcEscalationTotals,
  syncExpiredEscalations,
  type EscalationEntry,
  type EscalationsActivityData,
} from '@/lib/activities/escalations-entries'
import type { RattingLogLike } from '@/lib/activities/ratting-log-dedup'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

function abyssalLootFingerprint(data: Record<string, unknown> | null | undefined): string {
  const runs = ((data?.runs as Array<Record<string, unknown>>) || []).map((run) => ({
    id: run.id,
    status: run.status,
    tier: run.tier,
    weather: run.weather,
    startTime: run.startTime,
    endTime: run.endTime,
    lootValue: run.lootValue,
    lootItems: run.lootItems,
    registrationStatus: run.registrationStatus,
  }))
  return JSON.stringify({
    runs,
    totalLootValue: data?.totalLootValue,
    lootValue: data?.lootValue,
  })
}

function abyssalLootDataChanged(
  previousData: unknown,
  nextData: Record<string, unknown>
): boolean {
  return (
    abyssalLootFingerprint(previousData as Record<string, unknown>) !==
    abyssalLootFingerprint(nextData)
  )
}

export const GET = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const activity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  return activity
})

export const PATCH = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await request.json()
  const { status, endTime, data, space, participants, isPaused, pausedAt, accumulatedPausedTime, deletedLogRefIds, deletedRunIds } = body

  const deletedLogRefIdSet = new Set(
    Array.isArray(deletedLogRefIds) ? deletedLogRefIds.map((id: unknown) => String(id)) : []
  )
  const deletedRunIdSet = new Set(
    Array.isArray(deletedRunIds) ? deletedRunIds.map((id: unknown) => String(id)) : []
  )

  const existingActivity = await prisma.activity.findFirst({
    where: { id: params.id, userId: user.id }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  let updatedData = { ...((existingActivity.data as Record<string, unknown>) || {}) }
  let dataMutated = false

  if (data) {
    // Financial/aggregate fields are derived from logs/runs server-side (see the
    // recalc* helpers) and feed shared cross-user rollups — never accept them raw
    // from the client, or a crafted PATCH could poison global intel stats.
    const SERVER_COMPUTED_FIELDS = [
      'automatedBounties', 'automatedEss', 'automatedTaxes', 'grossBounties',
      'participantEarnings', 'estimatedLootValue', 'estimatedSalvageValue',
      'totalLootValue', 'currentCargoValue', 'batchesCompleted', 'totalItems',
      'estimatedEscalationLootValue', 'estimatedEscalationCostValue', 'miningValue',
    ]
    const sanitizedData: Record<string, unknown> = { ...(data as Record<string, unknown>) }
    for (const f of SERVER_COMPUTED_FIELDS) delete sanitizedData[f]

    updatedData = { ...updatedData, ...sanitizedData }
    dataMutated = true

    if (
      existingActivity.type === 'ratting' &&
      Array.isArray((data as Record<string, unknown>).escalationDrops)
    ) {
      updatedData.escalationDrops = dedupeEscalationDrops(
        (data as { escalationDrops: RattingEscalationDrop[] }).escalationDrops
      )
    }

    if (
      existingActivity.type === 'ratting' &&
      Array.isArray((data as Record<string, unknown>).sessionExpenses)
    ) {
      updatedData.sessionExpenses = dedupeRattingExpenses(
        (data as { sessionExpenses: RattingExpenseEntry[] }).sessionExpenses
      )
    }

    if (
      existingActivity.type === 'escalations' &&
      Array.isArray((data as Record<string, unknown>).escalations)
    ) {
      updatedData.escalations = dedupeEscalations(
        (data as { escalations: EscalationEntry[] }).escalations
      )
      updatedData = {
        ...updatedData,
        ...recalcEscalationTotals(updatedData.escalations as EscalationEntry[]),
      }
    }

    if (existingActivity.type === 'abyssal' && Array.isArray(data.runs)) {
      const serverRuns = ((existingActivity.data as Record<string, unknown>)?.runs as unknown[]) || []
      updatedData.runs = mergeAbyssalRuns(
        serverRuns as Array<{ id: string }>,
        data.runs as Array<{ id: string }>,
        deletedRunIdSet
      )
    }

    if (existingActivity.type === 'ratting' && Array.isArray(data.logs)) {
      const serverLogs =
        (((existingActivity.data as Record<string, unknown>)?.logs as RattingLogEntry[]) || [])
      updatedData.logs = mergeRattingLogs(
        serverLogs as RattingLogLike[],
        data.logs as RattingLogLike[],
        deletedLogRefIdSet
      )
      const additionalBounties = Number(updatedData.additionalBounties) || 0
      updatedData = {
        ...updatedData,
        ...recalcRattingWalletTotalsFromLogs(
          updatedData.logs as RattingLogEntry[],
          additionalBounties
        ),
      }
    }

    // additionalBounties can change without a logs update (manual bounty entry).
    // Since grossBounties is now server-derived only, recompute it from the
    // server-side logs so the total stays correct instead of going stale.
    if (
      (existingActivity.type === 'ratting' || existingActivity.type === 'escalations') &&
      !Array.isArray(data.logs) &&
      'additionalBounties' in (data as Record<string, unknown>)
    ) {
      const additionalBounties = Number(updatedData.additionalBounties) || 0
      updatedData = {
        ...updatedData,
        ...recalcRattingWalletTotalsFromLogs(
          (updatedData.logs as RattingLogEntry[]) || [],
          additionalBounties
        ),
      }
    }

    if (existingActivity.type === 'escalations' && Array.isArray(data.logs)) {
      const serverLogs =
        (((existingActivity.data as Record<string, unknown>)?.logs as RattingLogEntry[]) || [])
      updatedData.logs = mergeRattingLogs(
        serverLogs as RattingLogLike[],
        data.logs as RattingLogLike[],
        deletedLogRefIdSet
      )
      const additionalBounties = Number(updatedData.additionalBounties) || 0
      updatedData = {
        ...updatedData,
        ...recalcEscalationTotals(
          (updatedData.escalations as EscalationEntry[]) ||
            ((existingActivity.data as Record<string, unknown>)?.escalations as EscalationEntry[]) ||
            []
        ),
        ...recalcRattingWalletTotalsFromLogs(
          updatedData.logs as RattingLogEntry[],
          additionalBounties
        ),
      }
    }

    if (existingActivity.type === 'exploration' && Array.isArray(data.logs)) {
      const serverLogs =
        (((existingActivity.data as Record<string, unknown>)?.logs as ExplorationLogLike[]) || [])
      updatedData.logs = mergeExplorationLogs(
        serverLogs,
        data.logs as ExplorationLogLike[],
        deletedLogRefIdSet
      )
      updatedData = {
        ...updatedData,
        ...recalcExplorationLootTotalsFromLogs(updatedData.logs as ExplorationLogLike[]),
        lastDataAt: new Date().toISOString(),
      }
    }

    if (existingActivity.type === 'salvaging' && Array.isArray(data.logs)) {
      const serverLogs =
        (((existingActivity.data as Record<string, unknown>)?.logs as SalvagingLogLike[]) || [])
      updatedData.logs = mergeSalvagingLogs(
        serverLogs,
        data.logs as SalvagingLogLike[],
        deletedLogRefIdSet
      )
      updatedData = {
        ...updatedData,
        ...recalcSalvagingLootTotalsFromLogs(updatedData.logs as SalvagingLogLike[]),
        lastDataAt: new Date().toISOString(),
      }
    }
  }

  if (data && (data.mtuContents || data.salvageContents)) {
    updatedData = await applyRattingLootPatch(updatedData, data as Record<string, unknown>)
    dataMutated = true
  } else if (
    dataMutated &&
    (existingActivity.type === 'ratting' || existingActivity.type === 'escalations')
  ) {
    updatedData.lastDataAt = new Date().toISOString()
  }

  if (existingActivity.type === 'escalations') {
    updatedData = syncExpiredEscalations(updatedData as EscalationsActivityData)
  }

  if (
    status === 'completed' &&
    existingActivity.status !== 'completed' &&
    (existingActivity.type === 'ratting' || existingActivity.type === 'escalations')
  ) {
    try {
      const synced = await syncRattingWalletForActivity({
        ...existingActivity,
        data: updatedData as Prisma.JsonValue,
      })
      updatedData = (synced.data as Record<string, unknown>) || updatedData
    } catch (err) {
      logger.warn('activity-patch', 'Final ratting wallet sync before completion failed', {
        activityId: params.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (status === 'completed' && existingActivity.status !== 'completed') {
    const activityForCheck = {
      type: existingActivity.type,
      data: updatedData,
    }
    if (
      isZeroGrossActivity(activityForCheck) &&
      !isRattingTooYoungToDiscard(existingActivity)
    ) {
      await discardZeroValueActivity(prisma, params.id)
      return { discarded: true, id: params.id }
    }
  }

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(status === 'completed' && !endTime && !existingActivity.endTime && { endTime: new Date() }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(space && { space }),
      data: updatedData as Prisma.JsonValue,
      ...(participants && { participants }),
      ...(typeof isPaused === 'boolean' && { isPaused }),
      ...(pausedAt !== undefined && { pausedAt: pausedAt ? new Date(pausedAt) : null }),
      ...(accumulatedPausedTime !== undefined && { accumulatedPausedTime })
    }
  })

  if (status === 'completed' && existingActivity.status !== 'completed') {
    scheduleLootIntelIngest(activity)
    if (existingActivity.type === 'mining') {
      const participants = (existingActivity.participants as Array<{ characterId: number }>) || []
      await refreshMiningDetectionCacheForActivity(participants)
    }
  } else if (
    existingActivity.type === 'abyssal' &&
    existingActivity.status === 'completed' &&
    abyssalLootDataChanged(existingActivity.data as Record<string, unknown>, updatedData)
  ) {
    scheduleLootIntelIngest(activity, { reconcile: true })
  } else if (
    existingActivity.type === 'ratting' &&
    existingActivity.status === 'completed' &&
    rattingLootDataChanged(existingActivity.data as Record<string, unknown>, updatedData)
  ) {
    scheduleLootIntelIngest(activity, { reconcile: true })
  } else if (
    existingActivity.type === 'exploration' &&
    existingActivity.status === 'completed' &&
    explorationLootDataChanged(existingActivity.data as Record<string, unknown>, updatedData)
  ) {
    scheduleLootIntelIngest(activity, { reconcile: true })
  } else if (
    existingActivity.type === 'salvaging' &&
    existingActivity.status === 'completed' &&
    salvagingLootDataChanged(existingActivity.data as Record<string, unknown>, updatedData)
  ) {
    scheduleLootIntelIngest(activity, { reconcile: true })
  } else if (
    existingActivity.type === 'mining' &&
    existingActivity.status === 'completed' &&
    miningLootDataChanged(existingActivity.data as Record<string, unknown>, updatedData)
  ) {
    scheduleLootIntelIngest(activity, { reconcile: true })
  }

  if (
    existingActivity.type === 'mining' &&
    isPaused === true &&
    !existingActivity.isPaused
  ) {
    const participants = (existingActivity.participants as Array<{ characterId: number }>) || []
    await refreshMiningDetectionCacheForActivity(participants)
  }

  return activity
})

export const PUT = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await request.json()
  const { status, endTime } = body

  const existingActivity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  if (status === 'completed' && existingActivity.status !== 'completed') {
    if (
      isZeroGrossActivity(existingActivity) &&
      !isRattingTooYoungToDiscard(existingActivity)
    ) {
      await discardZeroValueActivity(prisma, params.id)
      return { discarded: true, id: params.id }
    }
  }

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(status === 'completed' && !endTime && !existingActivity.endTime && { endTime: new Date() }),
      ...(endTime && { endTime: new Date(endTime) })
    }
  })

  if (status === 'completed' && existingActivity.status !== 'completed') {
    scheduleLootIntelIngest(activity)
    if (existingActivity.type === 'mining') {
      const participants = (existingActivity.participants as Array<{ characterId: number }>) || []
      await refreshMiningDetectionCacheForActivity(participants)
    }
  }

  return activity
})

export const DELETE = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const existingActivity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  await prisma.activity.update({
    where: { id: params.id },
    data: { isDeleted: true }
  })

  if (existingActivity.type === 'abyssal') {
    void retractAbyssalLootForActivity(params.id).catch((err) => {
      logger.error('abyssal-loot-intel', 'Failed to retract loot intel on delete', err, {
        activityId: params.id,
      })
    })
  }

  if (existingActivity.type === 'salvaging') {
    void retractSalvagingForActivity(params.id).catch((err) => {
      logger.error('salvaging-intel', 'Failed to retract loot intel on delete', err, {
        activityId: params.id,
      })
    })
  }

  if (existingActivity.type === 'ratting') {
    void retractRattingLootForActivity(params.id).catch((err) => {
      logger.error('ratting-loot-intel', 'Failed to retract loot intel on delete', err, {
        activityId: params.id,
      })
    })
  }

  if (existingActivity.type === 'exploration') {
    void retractExplorationLootForActivity(params.id).catch((err) => {
      logger.error('exploration-loot-intel', 'Failed to retract loot intel on delete', err, {
        activityId: params.id,
      })
    })
  }

  if (existingActivity.type === 'mining') {
    void retractMiningLootForActivity(params.id).catch((err) => {
      logger.error('mining-loot-intel', 'Failed to retract loot intel on delete', err, {
        activityId: params.id,
      })
    })
  }

  return { success: true }
})