import { prisma } from '@/lib/prisma'
import type { Activity } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { getTypeDetails } from '@/lib/esi'
import {
  buildDailyBaselines,
  fetchMiningLedgerForCharacter,
  isValidMiningEntry,
  mergeBaselinesForLateJoin,
  type MiningLedgerEntry,
} from '@/lib/esi/mining-ledger'
import { resolveMiningUnitPrice } from '@/lib/mining-price-resolution'
import { batchPromiseAll } from '@/lib/utils'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { getJitaPricesPersistent } from '@/lib/market-prices'
import { ICE_GROUP_ID } from '@/lib/constants/mining'
import { shouldRefetchMiningTypeFromEsi } from '@/lib/mining-type-metadata'
import { enrichMiningLogsWithGeo } from '@/lib/activities/mining-geo-enrichment'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'

export type MiningSyncMode = 'initial' | 'regular' | null

export type MiningBaselineScope = 'all' | 'newParticipantsOnly'

export type RunMiningActivitySyncOpts = {
  userId: string
  activityId: string
  mode: MiningSyncMode
  baselineScope?: MiningBaselineScope
  newParticipantCharacterIds?: number[]
  forceEsiBaseline?: boolean
  /**
   * Explicit user-initiated sync (the card's "Sync API" button) that must run
   * even on a paused session. Background/auto-sync callers already filter paused
   * activities out before calling, so this only ever comes from the manual route.
   */
  allowPaused?: boolean
}

export type MiningSyncParticipantError = {
  characterId: number
  characterName: string
  error: string
  /**
   * 'auth' = missing/expired token or missing mining scope (user must re-login);
   * 'transient' = ESI outage / partial page (retries on its own). Lets the UI show
   * an actionable "reauthorize" hint instead of a generic failure.
   */
  reason: 'auth' | 'transient'
}

// no_token / 401 / 403 all mean the character can't be read until the user
// re-authenticates with the mining scope. Everything else is transient.
const MINING_AUTH_ERROR_CODES = new Set(['no_token', 'esi_401', 'esi_403'])

function classifyMiningLedgerError(code: string | undefined): 'auth' | 'transient' {
  return code && MINING_AUTH_ERROR_CODES.has(code) ? 'auth' : 'transient'
}

const OPTIMISTIC_LOCK_RETRIES = 3

function resolveInitialBaselines(params: {
  results: Array<{ entries: MiningLedgerEntry[]; charId: number }>
  activityDateOnly: string
  activityData: Record<string, unknown>
  baselineScope: MiningBaselineScope
  newParticipantCharacterIds: number[]
  forceEsiBaseline?: boolean
}): Record<string, number> {
  const {
    results,
    activityDateOnly,
    activityData,
    baselineScope,
    newParticipantCharacterIds,
    forceEsiBaseline,
  } = params
  const existingBaselines = (activityData.baselines as Record<string, number>) || {}
  const pendingBaselines = (activityData.pendingBaselines as Record<string, number>) || {}

  if (forceEsiBaseline) {
    if (baselineScope === 'newParticipantsOnly') {
      const incoming = buildDailyBaselines(results, activityDateOnly, newParticipantCharacterIds)
      return mergeBaselinesForLateJoin(existingBaselines, incoming, newParticipantCharacterIds)
    }
    return buildDailyBaselines(results, activityDateOnly)
  }

  if (baselineScope === 'newParticipantsOnly') {
    const incoming =
      Object.keys(pendingBaselines).length > 0
        ? pendingBaselines
        : buildDailyBaselines(results, activityDateOnly, newParticipantCharacterIds)
    return mergeBaselinesForLateJoin(existingBaselines, incoming, newParticipantCharacterIds)
  }

  if (Object.keys(pendingBaselines).length > 0) {
    return { ...pendingBaselines }
  }

  return buildDailyBaselines(results, activityDateOnly)
}

function hasValidLedgerFetch(
  results: Array<{ entries: MiningLedgerEntry[]; charId: number }>
): boolean {
  return results.some((r) => r.entries.length > 0)
}

function resolveHasInitialBaseline(
  baselines: Record<string, number>,
  results: Array<{ entries: MiningLedgerEntry[]; charId: number }>
): boolean {
  const hasBaselines = Object.keys(baselines).length > 0
  const hasLedger = hasValidLedgerFetch(results)
  return hasBaselines || !hasLedger
}

type PersistResult = { activity: Activity; conflict: boolean }

async function persistActivityData(
  activityId: string,
  expectedUpdatedAt: Date,
  patch: Record<string, unknown>,
  extraFields?: Partial<Prisma.ActivityUpdateInput>
): Promise<PersistResult> {
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.activity.findFirst({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
    })
    if (!fresh) {
      const latest = await tx.activity.findUnique({ where: { id: activityId } })
      return { activity: latest!, conflict: true }
    }

    const freshData = (fresh.data as Record<string, unknown>) || {}
    const nextData = { ...freshData, ...patch }
    delete nextData.pendingBaselines

    const result = await tx.activity.updateMany({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
      data: {
        data: nextData as Prisma.InputJsonValue,
        ...extraFields,
      },
    })

    if (result.count === 0) {
      const latest = await tx.activity.findUnique({ where: { id: activityId } })
      return { activity: latest!, conflict: true }
    }

    const updated = await tx.activity.findUnique({ where: { id: activityId } })
    return { activity: updated!, conflict: false }
  })
}

async function runMiningActivitySyncOnce(
  opts: RunMiningActivitySyncOpts
): Promise<PersistResult> {
  const {
    userId,
    activityId,
    mode,
    baselineScope = 'all',
    newParticipantCharacterIds = [],
    forceEsiBaseline = false,
    allowPaused = false,
  } = opts
  const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId, type: 'mining' },
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  const participants = activity.participants as Array<{
    characterId: number
    characterName: string
  }>
  if (!participants || participants.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'No participants to sync', 400)
  }

  // A paused session is normally skipped by regular/background syncs, but an
  // explicit manual sync (allowPaused) must still refresh ledger data — otherwise
  // the card's "Sync API" button silently no-ops on a paused activity while the
  // UI reports success. Duration/ISK-h stay frozen at pausedAt (getActivityDurationMs),
  // so refreshing data here never advances the timer.
  if (mode !== 'initial' && activity.isPaused && !allowPaused) {
    return { activity, conflict: false }
  }

  const expectedUpdatedAt = activity.updatedAt
  const startTimeManual = new Date(activity.startTime)
  const activityDateOnly = startTimeManual.toISOString().split('T')[0]

  logger.info('SYNC-MINING', 'Sync mining start', {
    syncId,
    mode: mode || 'regular',
    activityId,
    baselineScope,
    activityStartTime: activity.startTime,
    participantCount: participants.length,
    participantNames: participants.map((p) => p.characterName),
  })

  const activityData = (activity.data as Record<string, unknown>) || {}
  const existingLogs = (activityData.logs as unknown[]) || []

  const logMap = new Map<string, Record<string, unknown>>()
  const existingFiltered = existingLogs.filter((log: unknown) => {
    const entry = log as { date?: string }
    const logDateOnly =
      entry.date?.split('T')[0] || new Date(entry.date as string).toISOString().split('T')[0]
    return logDateOnly >= activityDateOnly
  })

  existingFiltered.forEach((log: unknown) => {
    const entry = log as {
      date: string
      characterId: number
      typeId: number
      solarSystemId?: number
    }
    const logDateOnly =
      entry.date?.split('T')[0] || new Date(entry.date).toISOString().split('T')[0]
    const key = `${entry.characterId}-${entry.typeId}-${entry.solarSystemId || 0}-${logDateOnly}`
    logMap.set(key, log as Record<string, unknown>)
  })

  const CONCURRENT_PARTICIPANTS = 8
  const results = await batchPromiseAll(participants, CONCURRENT_PARTICIPANTS, (p) =>
    fetchMiningLedgerForCharacter(p.characterId, p.characterName)
  )

  // A ledger fetch that failed (bad/missing token, ESI error) returns ok:false,
  // not just an empty array. Surfacing these per-character keeps a single broken
  // pilot from silently vanishing from the total (CLAUDE.md rule 3), mirroring the
  // ratting wallet sync's syncErrors handling.
  const syncErrors: MiningSyncParticipantError[] = results
    .filter((r) => r.ok === false)
    .map((r) => ({
      characterId: r.charId,
      characterName: r.charName || `Citizen ${r.charId}`,
      error: r.error || 'unknown',
      reason: classifyMiningLedgerError(r.error),
    }))

  logger.info('SYNC-MINING', 'Ledger fetch per participant', {
    syncId,
    activityId,
    requestedCharacterIds: participants.map((p) => p.characterId),
    fetchedCharacterIds: results.map((r) => r.charId),
    entryCounts: results.map((r) => ({ characterId: r.charId, entries: r.entries.length })),
    failedCharacterIds: syncErrors.map((e) => e.characterId),
  })

  let effectiveMode = mode
  let baselines = (activityData.baselines as Record<string, number>) || {}

  if (effectiveMode !== 'initial' && !activityData.hasInitialBaseline) {
    logger.warn('SYNC-MINING', 'Bootstrapping baseline during regular sync', {
      syncId,
      activityId,
    })
    effectiveMode = 'initial'
  }

  if (effectiveMode === 'initial') {
    baselines = resolveInitialBaselines({
      results,
      activityDateOnly,
      activityData,
      baselineScope,
      newParticipantCharacterIds,
      forceEsiBaseline,
    })

    const hasInitialBaseline = resolveHasInitialBaseline(baselines, results)

    logger.info('SYNC-MINING', 'Mining baseline captured', {
      syncId,
      activityId,
      baselineCount: Object.keys(baselines).length,
      hasInitialBaseline,
      usedPendingBaselines: Object.keys(
        (activityData.pendingBaselines as Record<string, number>) || {}
      ).length,
      baselineScope,
    })

    const computed = {
      baselines,
      hasInitialBaseline,
      lastSyncAt: new Date().toISOString(),
    }

    const initialPersist = await persistActivityData(activityId, expectedUpdatedAt, computed)
    if (initialPersist.conflict) {
      return initialPersist
    }

    if (mode === 'initial') {
      return initialPersist
    }

    // Bootstrapped during regular sync — continue with fresh activity row
    return runMiningActivitySyncOnce({
      ...opts,
      mode: 'regular',
    })
  }

  let totalFetched = 0
  let totalNew = 0

  for (const result of results) {
    const { entries, charId, charName } = result
    totalFetched += entries.length

    const validEntries = entries.filter(isValidMiningEntry)

    for (const entry of validEntries) {
      if (entry.date < activityDateOnly) continue

      const compositeKey = `${charId}-${entry.type_id}-${entry.solar_system_id}`
      const logKey = `${compositeKey}-${entry.date}`

      let effectiveQuantity = entry.quantity
      let baselineQty = 0

      if (entry.date === activityDateOnly) {
        const dateKey = `${compositeKey}-${entry.date}`
        baselineQty = baselines[dateKey] ?? baselines[compositeKey] ?? 0
        effectiveQuantity = Math.max(0, entry.quantity - baselineQty)
      }

      if (effectiveQuantity > 0) {
        logger.debug('SYNC-MINING', 'Ledger entry attributed', {
          syncId,
          charId,
          typeId: entry.type_id,
          systemId: entry.solar_system_id,
          date: entry.date,
          esiQty: entry.quantity,
          baselineQty,
          effectiveQty: effectiveQuantity,
        })
      }

      if (effectiveQuantity <= 0) continue

      if (!logMap.has(logKey)) {
        logMap.set(logKey, {
          date: entry.date,
          quantity: effectiveQuantity,
          typeId: entry.type_id,
          characterId: charId,
          characterName: charName,
          solarSystemId: entry.solar_system_id,
        })
        totalNew++
      } else {
        const existing = logMap.get(logKey)!
        const previousQuantity = Number(existing.quantity) || 0
        const nextQuantity = Math.max(previousQuantity, effectiveQuantity)
        // A quantity increase on an already-seen key (same ore/system/date) is still
        // real mining progress — e.g. mining the same ore in the same system for
        // hours only ever grows this one key, and never counting it as "new" left
        // lastDataAt frozen, causing the stale-pause audit to pause an active session.
        if (nextQuantity > previousQuantity) {
          totalNew++
        }
        existing.quantity = nextQuantity
        if (entry.date > String(existing.date)) {
          existing.date = entry.date
        }
        logMap.set(logKey, existing)
      }
    }
  }

  const allLogs = Array.from(logMap.values()).filter((log) => Number(log.quantity) > 0)
  const oreBreakdown: Record<number, Record<string, unknown>> = {}
  const participantBreakdown: Record<number, Record<string, unknown>> = {}

  allLogs.forEach((log) => {
    const typeId = Number(log.typeId)
    if (!oreBreakdown[typeId]) {
      oreBreakdown[typeId] = { typeId, quantity: 0, estimatedValue: 0, volumeValue: 0 }
    }
    oreBreakdown[typeId].quantity =
      (Number(oreBreakdown[typeId].quantity) || 0) + (Number(log.quantity) || 0)

    const charId = Number(log.characterId)
    if (!participantBreakdown[charId]) {
      participantBreakdown[charId] = {
        characterId: charId,
        characterName: log.characterName,
        quantity: 0,
        estimatedValue: 0,
        volumeValue: 0,
      }
    }
  })

  const typeIdsList = Object.keys(oreBreakdown).map(Number)

  const sdeMetadata = await prisma.eveType.findMany({
    where: { id: { in: typeIdsList } },
    select: { id: true, name: true, volume: true, basePrice: true, groupId: true },
  })

  const metaMap: Record<number, { name: string; volume: number; basePrice: number; groupId: number }> =
    {}
  const oreNames: string[] = []

  sdeMetadata.forEach((m) => {
    metaMap[m.id] = {
      name: m.name,
      volume: m.volume || 0,
      basePrice: m.basePrice || 0,
      groupId: m.groupId,
    }
    if (m.name) oreNames.push(m.name)
  })

  const compressedOres = await prisma.eveType.findMany({
    where: {
      name: { in: oreNames.map((name) => `Compressed ${name}`) },
    },
    select: { id: true, name: true },
  })

  const compressedMap: Record<number, number> = {}
  const extraTypeIds: number[] = []

  compressedOres.forEach((co) => {
    const originalName = co.name.replace('Compressed ', '')
    const originalType = sdeMetadata.find((m) => m.name === originalName)
    if (originalType) {
      compressedMap[originalType.id] = co.id
      extraTypeIds.push(co.id)
    }
  })

  const allTypeIdsToFetch = Array.from(new Set([...typeIdsList, ...extraTypeIds]))
  const jitaMarketPrices = await getJitaPricesPersistent(allTypeIdsToFetch)

  for (const log of allLogs) {
    const typeIdNum = Number(log.typeId)
    let meta = metaMap[typeIdNum]

    if (shouldRefetchMiningTypeFromEsi(meta)) {
      try {
        const details = await getTypeDetails(typeIdNum)
        if (details) {
          meta = {
            name: details.name,
            volume: details.volume || 1,
            basePrice: 0,
            groupId: details.group_id || 0,
          }
          metaMap[typeIdNum] = meta

          await prisma.eveType
            .upsert({
              where: { id: typeIdNum },
              update: { name: details.name, volume: details.volume },
              create: {
                id: typeIdNum,
                name: details.name,
                volume: details.volume,
                groupId: details.group_id || 0,
              },
            })
            .catch(() => {})
        }
      } catch (e) {
        logger.error('SYNC-MINING', `Failed to fetch metadata for type ${typeIdNum}`, e)
      }
    }

    log.oreName = meta?.name || 'Unknown Ore'

    const unitVolume = meta?.volume || 1
    log.volumeValue = Number(log.quantity) * unitVolume

    const itemPrices = jitaMarketPrices[typeIdNum]
    const compressedTypeId = compressedMap[typeIdNum]
    const compressedPrices = compressedTypeId ? jitaMarketPrices[compressedTypeId] : null

    const rawBuy = itemPrices?.buy || 0
    const rawSell = itemPrices?.sell || 0
    const compressedBuy = compressedPrices?.buy || 0
    const compressedSell = compressedPrices?.sell || 0

    const isIceType = meta?.groupId === ICE_GROUP_ID
    const { unitPrice: price, basis, confidence } = resolveMiningUnitPrice({
      isIceMiningCategory: isIceType,
      rawBuy,
      rawSell,
      compressedBuy,
      compressedSell,
    })

    const estimatedValue = Number(log.quantity) * price

    log.estimatedValue = estimatedValue
    log.unitPrice = price
    log.priceBasis = basis
    log.priceConfidence = confidence

    if (oreBreakdown[typeIdNum]) {
      oreBreakdown[typeIdNum].name = log.oreName
      oreBreakdown[typeIdNum].icon = `https://images.evetech.net/types/${typeIdNum}/icon?size=64`
      oreBreakdown[typeIdNum].estimatedValue =
        (Number(oreBreakdown[typeIdNum].estimatedValue) || 0) + estimatedValue
      oreBreakdown[typeIdNum].volumeValue =
        (Number(oreBreakdown[typeIdNum].volumeValue) || 0) + Number(log.volumeValue)
      oreBreakdown[typeIdNum].buy = rawBuy
      oreBreakdown[typeIdNum].sell = rawSell
      oreBreakdown[typeIdNum].compressedBuy = compressedBuy
      oreBreakdown[typeIdNum].compressedSell = compressedSell
      oreBreakdown[typeIdNum].priceBasis = basis
      oreBreakdown[typeIdNum].priceConfidence = confidence
    }

    const charId = Number(log.characterId)
    if (participantBreakdown[charId]) {
      participantBreakdown[charId].estimatedValue =
        (Number(participantBreakdown[charId].estimatedValue) || 0) + estimatedValue
      participantBreakdown[charId].quantity =
        (Number(participantBreakdown[charId].quantity) || 0) + Number(log.quantity)
      participantBreakdown[charId].volumeValue =
        (Number(participantBreakdown[charId].volumeValue) || 0) + Number(log.volumeValue)
    }
  }

  const totalQuantity = Object.values(oreBreakdown).reduce(
    (sum, o) => sum + (Number(o.volumeValue) || 0),
    0
  )
  const totalEstimatedValue = Object.values(oreBreakdown).reduce(
    (sum, o) => sum + (Number(o.estimatedValue) || 0),
    0
  )

  const participantEarnings: Record<number, number> = {}
  Object.keys(participantBreakdown).forEach((charId) => {
    participantEarnings[parseInt(charId, 10)] = Number(participantBreakdown[parseInt(charId, 10)].estimatedValue) || 0
  })

  allLogs.sort(
    (a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()
  )

  const geo = await enrichMiningLogsWithGeo(allLogs)
  const {
    systemBreakdown,
    regionBreakdown: regionBreakdownSerialized,
    dominantSystemId,
    dominantRegionId,
    derivedSpace,
  } = geo

  const durationMs = getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    updatedAt: activity.updatedAt,
    accumulatedPausedTime: activity.accumulatedPausedTime,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })
  const hoursElapsed = durationMs / 3_600_000
  const currentM3PerHour = totalQuantity / Math.max(0.1, hoursElapsed)

  const previousM3PerHour = Number(activityData.currentM3PerHour) || 0
  let m3Trend = 'stable'

  if (previousM3PerHour > 0) {
    const diff = currentM3PerHour - previousM3PerHour
    const threshold = previousM3PerHour * 0.02
    if (diff > threshold) m3Trend = 'up'
    else if (diff < -threshold) m3Trend = 'down'
  }

  const nowIso = new Date().toISOString()
  const computed = {
    baselines,
    hasInitialBaseline: true,
    oreBreakdown,
    totalQuantity,
    totalEstimatedValue,
    miningValue: totalEstimatedValue,
    participantBreakdown,
    participantEarnings,
    logs: allLogs,
    systemBreakdown,
    regionBreakdown: regionBreakdownSerialized,
    dominantSystemId: dominantSystemId ?? null,
    dominantRegionId: dominantRegionId ?? null,
    currentM3PerHour,
    m3Trend,
    lastSyncAt: nowIso,
    lastDataAt: totalNew > 0 ? nowIso : activityData.lastDataAt,
    lastSyncWithChangesAt: totalNew > 0 ? nowIso : activityData.lastSyncWithChangesAt,
    syncCount: (Number(activityData.syncCount) || 0) + 1,
    // Mirror ratting: persist per-character failures so the footer can warn, and
    // clear them once a clean sync succeeds.
    syncErrors: syncErrors.length > 0 ? syncErrors : undefined,
    lastSyncFailedAt: syncErrors.length > 0 ? nowIso : undefined,
  }

  logger.info('SYNC-MINING', 'End sync summary', {
    results: `${totalNew} New | ${allLogs.length} Total Logs`,
    value: `${totalEstimatedValue.toLocaleString()} ISK | Volume: ${totalQuantity.toLocaleString()} m3`,
  })

  return persistActivityData(activityId, expectedUpdatedAt, computed, {
    ...(derivedSpace &&
    (!activity.space || activity.space === 'Unknown' || activity.space.trim() === '')
      ? { space: derivedSpace }
      : {}),
  })
}

/**
 * Server-only mining sync (caller must pass authenticated owner userId).
 */
export async function runMiningActivitySync(opts: RunMiningActivitySyncOpts): Promise<Activity> {
  let lastResult: Activity | null = null

  for (let attempt = 0; attempt < OPTIMISTIC_LOCK_RETRIES; attempt++) {
    const result = await runMiningActivitySyncOnce(opts)
    lastResult = result.activity

    if (!result.conflict) {
      return result.activity
    }

    if (attempt < OPTIMISTIC_LOCK_RETRIES - 1) {
      logger.warn('SYNC-MINING', 'Optimistic lock conflict, retrying', {
        activityId: opts.activityId,
        attempt: attempt + 1,
      })
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }
  }

  if (!lastResult) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  return lastResult
}

// Re-export for tests
export { buildDailyBaselines, isValidMiningEntry }
