import { prisma } from '@/lib/prisma'
import type { Activity } from '@prisma/client'
import { getTypeDetails } from '@/lib/esi'
import { resolveMiningUnitPrice } from '@/lib/mining-price-resolution'
import { getValidAccessToken } from '@/lib/token-manager'
import { ESI_BASE_URL, USER_AGENT } from '@/lib/sde'
import { batchPromiseAll } from '@/lib/utils'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { getJitaPricesPersistent } from '@/lib/market-prices'
import { ICE_GROUP_ID, ICE_BATCH_SIZE, ORE_BATCH_SIZE } from '@/lib/constants/mining'
import { shouldRefetchMiningTypeFromEsi } from '@/lib/mining-type-metadata'

const JITA_REGION_ID = 10000002

interface MarketOrder {
  price: number
  volume_remain: number
  type_id: number
}

// Using persistent prices from @/lib/market-prices

interface MiningLedgerEntry {
  date: string
  quantity: number
  type_id: number
  solar_system_id: number
}

function buildDailyBaselines(
  results: Array<{ entries: MiningLedgerEntry[]; charId: number }>,
  activityDateOnly: string
): Record<string, number> {
  const baselines: Record<string, number> = {}
  for (const result of results) {
    const { entries, charId } = result
    for (const entry of entries) {
      if (!isValidMiningEntry(entry)) continue
      // We only strictly need baselines for the day the activity started.
      // Any mining on subsequent days is by definition "during" the activity.
      if (entry.date === activityDateOnly) {
        const compositeKeyWithDate = `${charId}-${entry.type_id}-${entry.solar_system_id}-${entry.date}`
        baselines[compositeKeyWithDate] = entry.quantity
      }
    }
  }
  return baselines
}

function isValidMiningEntry(entry: any): entry is MiningLedgerEntry {
  return (
    entry &&
    typeof entry.date === 'string' &&
    typeof entry.quantity === 'number' &&
    entry.quantity > 0 &&
    typeof entry.type_id === 'number' &&
    typeof entry.solar_system_id === 'number'
  )
}

const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const MAX_CONCURRENT_PAGES = 5

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }
      logger.info('SYNC-MINING', `Retry ${i + 1}/${retries} for ${url} (status ${response.status})`)
    } catch (error) {
      lastError = error as Error
    }

    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (i + 1)))
    }
  }

  throw lastError || new Error('Fetch failed after retries')
}

async function fetchMiningLedgerForCharacter(
  charId: number,
  charName: string,
  activityDateOnly: string,
  startTimeManual: Date
): Promise<{ entries: MiningLedgerEntry[], charId: number, charName: string }> {
  const { accessToken } = await getValidAccessToken(charId)

  if (!accessToken) {
    logger.info('SYNC-MINING', 'No access token found', { charId, charName })
    return { entries: [], charId, charName }
  }

  try {
    const firstResponse = await fetchWithRetry(
      `${ESI_BASE_URL}/characters/${charId}/mining/?page=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-User-Agent': 'EasyEve/1.0'
        }
      }
    )

    const errorText = firstResponse.statusText

    if (!firstResponse.ok) {
      logger.error('SYNC-MINING', 'Fetch error from ESI', null, {
        charId,
        charName,
        status: firstResponse.status,
        error: errorText
      })
      return { entries: [], charId, charName }
    }

    const pagesHeader = firstResponse.headers.get('x-pages')
    const totalPages = pagesHeader ? parseInt(pagesHeader, 10) : 1

    const allEntries: MiningLedgerEntry[] = []

    if (totalPages === 1) {
      const entries = await firstResponse.json()
      allEntries.push(...entries)
    } else {
      for (let batchStart = 1; batchStart <= totalPages; batchStart += MAX_CONCURRENT_PAGES) {
        const batchEnd = Math.min(batchStart + MAX_CONCURRENT_PAGES - 1, totalPages)
        const pagePromises: Promise<Response>[] = []

        for (let page = batchStart; page <= batchEnd; page++) {
          pagePromises.push(
            fetchWithRetry(
              `${ESI_BASE_URL}/characters/${charId}/mining/?page=${page}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'X-User-Agent': 'EasyEve/1.0'
                }
              }
            )
          )
        }

        const responses = await Promise.all(pagePromises)
        const jsons = await Promise.all(responses.map(r => r.json()))
        jsons.forEach(entries => allEntries.push(...entries))
      }
    }

    logger.info('SYNC-MINING', 'Fetched entries', {
      charId,
      charName,
      totalEntries: allEntries.length,
      totalPages
    })

    return { entries: allEntries, charId, charName }
  } catch (err) {
    logger.error('SYNC-MINING', 'Fetch exception', err, {
      charId,
      charName
    })
    return { entries: [], charId, charName }
  }
}

export type MiningSyncMode = 'initial' | 'regular' | null

/**
 * Server-only mining sync (caller must pass authenticated owner userId).
 */
export async function runMiningActivitySync(opts: {
  userId: string
  activityId: string
  mode: MiningSyncMode
}): Promise<Activity> {
  const { userId, activityId, mode } = opts
  const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId, type: 'mining' }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  const participants = activity.participants as any[]
  if (!participants || participants.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'No participants to sync', 400)
  }

  const startTimeManual = new Date(activity.startTime)
  const activityDateOnly = startTimeManual.toISOString().split('T')[0]

  logger.info('SYNC-MINING', 'Sync mining start', {
    syncId,
    mode: mode || 'regular',
    activityId,
    activityStartTime: activity.startTime,
    participantCount: participants.length,
    participantNames: participants.map(p => p.characterName)
  })

  const activityData = (activity.data as any) || {}
  const existingLogs = activityData.logs || []

  const logMap = new Map<string, any>()
  const existingFiltered = existingLogs.filter((log: any) => {
    const logDateOnly = log.date?.split('T')[0] || new Date(log.date).toISOString().split('T')[0]
    return logDateOnly >= activityDateOnly
  })

  existingFiltered.forEach((log: any) => {
    const logDateOnly = log.date?.split('T')[0] || new Date(log.date).toISOString().split('T')[0]
    const key = `${log.characterId}-${log.typeId}-${log.solarSystemId || 0}-${logDateOnly}`
    logMap.set(key, log)
  })

  logger.info('SYNC-MINING', 'Existing logs loaded', {
    syncId,
    totalLogs: existingFiltered.length
  })

  const CONCURRENT_PARTICIPANTS = 8
  const results = await batchPromiseAll(participants, CONCURRENT_PARTICIPANTS, (p) =>
    fetchMiningLedgerForCharacter(p.characterId, p.characterName, activityDateOnly, startTimeManual)
  )

  logger.info('SYNC-MINING', 'Ledger fetch per participant', {
    syncId,
    activityId,
    requestedCharacterIds: participants.map((p: any) => p.characterId),
    fetchedCharacterIds: results.map((r) => r.charId),
    entryCounts: results.map((r) => ({ characterId: r.charId, entries: r.entries.length })),
  })

  if (mode === 'initial') {
    const baselines = buildDailyBaselines(results, activityDateOnly)
    let totalEntriesFetched = 0

    for (const result of results) {
      const { entries } = result
      totalEntriesFetched += entries.length
    }

    logger.info('SYNC-MINING', 'Mining baseline captured', {
      syncId,
      activityId,
      totalEntriesFetched,
      baselineCount: Object.keys(baselines).length
    })

    return prisma.activity.update({
      where: { id: activityId },
      data: {
        data: {
          ...activityData,
          baselines,
          hasInitialBaseline: true,
          lastSyncAt: new Date().toISOString()
        }
      }
    })
  }

  let totalFetched = 0
  let totalNew = 0
  let baselines = activityData.baselines || {}
  // Check if we have a baseline. We only bootstrap if hasInitialBaseline is explicitly false/missing.
  // We no longer check Object.keys(baselines).length > 0 because an empty baseline is a valid
  // state (meaning the character hasn't mined anything yet today).
  if (!activityData.hasInitialBaseline) {
    baselines = buildDailyBaselines(results, activityDateOnly)
    logger.info('SYNC-MINING', 'Baseline captured during sync', {
      syncId,
      activityId,
      baselineCount: Object.keys(baselines).length,
    })
  }

  for (const result of results) {
    const { entries, charId, charName } = result

    totalFetched += entries.length

    const validEntries = entries.filter(isValidMiningEntry)

    for (const entry of validEntries) {
      if (entry.date < activityDateOnly) continue

      const compositeKey = `${charId}-${entry.type_id}-${entry.solar_system_id}`
      const logKey = `${compositeKey}-${entry.date}`

      let effectiveQuantity = entry.quantity

      if (entry.date === activityDateOnly) {
        const dateKey = `${compositeKey}-${entry.date}`
        // Try new date-aware format first, then fallback to old format
        const baselineQty = baselines[dateKey] ?? baselines[compositeKey] ?? 0
        effectiveQuantity = Math.max(0, entry.quantity - baselineQty)
      }

      if (effectiveQuantity <= 0) continue

      if (!logMap.has(logKey)) {
        logMap.set(logKey, {
          date: entry.date,
          quantity: effectiveQuantity,
          typeId: entry.type_id,
          characterId: charId,
          characterName: charName,
          solarSystemId: entry.solar_system_id
        })
        totalNew++
      } else {
        const existing = logMap.get(logKey)
        existing.quantity = Math.max(existing.quantity, effectiveQuantity)
        if (entry.date > existing.date) {
          existing.date = entry.date
        }
        logMap.set(logKey, existing)
      }
    }
  }

  const allLogs = Array.from(logMap.values()).filter(log => log.quantity > 0)
  const oreBreakdown: Record<number, any> = {}
  const participantBreakdown: Record<number, any> = {}

  allLogs.forEach(log => {
    if (!oreBreakdown[log.typeId]) {
      oreBreakdown[log.typeId] = { typeId: log.typeId, quantity: 0, estimatedValue: 0, volumeValue: 0 }
    }
    oreBreakdown[log.typeId].quantity += log.quantity

    if (!participantBreakdown[log.characterId]) {
      participantBreakdown[log.characterId] = { characterId: log.characterId, characterName: log.characterName, quantity: 0, estimatedValue: 0, volumeValue: 0 }
    }
  })

  const typeIdsList = Object.keys(oreBreakdown).map(Number)

  const sdeMetadata = await prisma.eveType.findMany({
    where: { id: { in: typeIdsList } },
    select: { id: true, name: true, volume: true, basePrice: true, groupId: true },
  })

  const metaMap: Record<number, { name: string; volume: number; basePrice: number; groupId: number }> = {}
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
      name: { in: oreNames.map(name => `Compressed ${name}`) }
    },
    select: { id: true, name: true }
  })

  const compressedMap: Record<number, number> = {}
  const extraTypeIds: number[] = []

  compressedOres.forEach(co => {
    const originalName = co.name.replace('Compressed ', '')
    const originalType = sdeMetadata.find(m => m.name === originalName)
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
            groupId: details.group_id || 0
          }
          metaMap[typeIdNum] = meta

          await prisma.eveType.upsert({
            where: { id: typeIdNum },
            update: { name: details.name, volume: details.volume },
            create: {
              id: typeIdNum,
              name: details.name,
              volume: details.volume,
              groupId: details.group_id || 0
            }
          }).catch(() => {})
        }
      } catch (e) {
        logger.error('SYNC-MINING', `Failed to fetch metadata for type ${typeIdNum}`, e)
      }
    }

    log.oreName = meta?.name || 'Unknown Ore'

    const unitVolume = meta?.volume || 1
    log.volumeValue = log.quantity * unitVolume

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

    const estimatedValue = log.quantity * price

    log.estimatedValue = estimatedValue
    log.unitPrice = price
    log.priceBasis = basis
    log.priceConfidence = confidence

    if (oreBreakdown[typeIdNum]) {
      oreBreakdown[typeIdNum].name = log.oreName
      oreBreakdown[typeIdNum].icon = `https://images.evetech.net/types/${typeIdNum}/icon?size=64`
      oreBreakdown[typeIdNum].estimatedValue += estimatedValue
      oreBreakdown[typeIdNum].volumeValue = (oreBreakdown[typeIdNum].volumeValue || 0) + log.volumeValue
      oreBreakdown[typeIdNum].buy = rawBuy
      oreBreakdown[typeIdNum].sell = rawSell
      oreBreakdown[typeIdNum].compressedBuy = compressedBuy
      oreBreakdown[typeIdNum].compressedSell = compressedSell
      oreBreakdown[typeIdNum].priceBasis = basis
      oreBreakdown[typeIdNum].priceConfidence = confidence
    }

    if (participantBreakdown[log.characterId]) {
      participantBreakdown[log.characterId].estimatedValue += estimatedValue
      participantBreakdown[log.characterId].quantity += log.quantity
      participantBreakdown[log.characterId].volumeValue = (participantBreakdown[log.characterId].volumeValue || 0) + log.volumeValue
    }
  }

  const totalQuantity = Object.values(oreBreakdown).reduce((sum, o: any) => sum + (o.volumeValue || 0), 0)
  const totalEstimatedValue = Object.values(oreBreakdown).reduce((sum, o) => sum + o.estimatedValue, 0)

  const participantEarnings: Record<number, number> = {}
  Object.keys(participantBreakdown).forEach(charId => {
    participantEarnings[parseInt(charId)] = participantBreakdown[parseInt(charId)].estimatedValue
  })

  allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const startTimeMs = new Date(activity.startTime).getTime()
  const hoursElapsed = (Date.now() - startTimeMs) / 3600000
  const currentM3PerHour = totalQuantity / Math.max(0.1, hoursElapsed)

  const previousM3PerHour = activityData.currentM3PerHour || 0
  let m3Trend = 'stable'

  if (previousM3PerHour > 0) {
    const diff = currentM3PerHour - previousM3PerHour
    const threshold = previousM3PerHour * 0.02
    if (diff > threshold) m3Trend = 'up'
    else if (diff < -threshold) m3Trend = 'down'
  }

  const updatedData = {
    ...activityData,
    baselines,
    hasInitialBaseline: true,
    oreBreakdown,
    totalQuantity,
    totalEstimatedValue,
    miningValue: totalEstimatedValue,
    participantBreakdown,
    participantEarnings,
    logs: allLogs,
    currentM3PerHour,
    m3Trend,
    lastSyncAt: new Date().toISOString(),
    lastDataAt: totalNew > 0 ? new Date().toISOString() : activityData.lastDataAt,
  }

  logger.info('SYNC-MINING', 'End sync summary', {
    results: `${totalNew} New | ${allLogs.length} Total Logs`,
    value: `${totalEstimatedValue.toLocaleString()} ISK | Volume: ${totalQuantity.toLocaleString()} m3`
  })

  logger.info('SYNC-MINING', 'Sync mining complete', {
    syncId,
    mode: 'regular',
    totalQuantity,
    totalEstimatedValue,
    logsCount: allLogs.length,
    totalFetched,
    totalNew
  })

  return prisma.activity.update({
    where: { id: activityId },
    data: { data: updatedData }
  })
}
