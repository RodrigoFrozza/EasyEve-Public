import { getValidAccessToken } from '@/lib/token-manager'
import { ESI_BASE_URL } from '@/lib/sde'
import { logger } from '@/lib/server-logger'
import { prisma } from '@/lib/prisma'

export interface MiningLedgerEntry {
  date: string
  quantity: number
  type_id: number
  solar_system_id: number
  corporation_id?: number
}

export type MiningDetectionCacheValue = {
  entries: Record<string, number>
  aggregateQty: number
  timestamp: string
}

const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const MAX_CONCURRENT_PAGES = 5

export function miningDetectionCacheKey(characterId: number, date: string): string {
  return `mining_baseline_${characterId}_${date}`
}

export function isValidMiningEntry(entry: unknown): entry is MiningLedgerEntry {
  return (
    !!entry &&
    typeof (entry as MiningLedgerEntry).date === 'string' &&
    typeof (entry as MiningLedgerEntry).quantity === 'number' &&
    (entry as MiningLedgerEntry).quantity > 0 &&
    typeof (entry as MiningLedgerEntry).type_id === 'number' &&
    typeof (entry as MiningLedgerEntry).solar_system_id === 'number'
  )
}

export function baselineKeyForEntry(
  charId: number,
  entry: Pick<MiningLedgerEntry, 'type_id' | 'solar_system_id' | 'date'>
): string {
  return `${charId}-${entry.type_id}-${entry.solar_system_id}-${entry.date}`
}

export function buildEntryMapForDate(
  characterId: number,
  entries: MiningLedgerEntry[],
  dateOnly: string
): Record<string, number> {
  const map: Record<string, number> = {}
  for (const entry of entries) {
    if (!isValidMiningEntry(entry) || entry.date !== dateOnly) continue
    map[baselineKeyForEntry(characterId, entry)] = entry.quantity
  }
  return map
}

export function sumEntryQuantities(entries: Record<string, number>): number {
  return Object.values(entries).reduce((sum, qty) => sum + qty, 0)
}

/**
 * Builds per-key baselines from ESI ledger results for the activity start date.
 */
export function buildDailyBaselines(
  results: Array<{ entries: MiningLedgerEntry[]; charId: number }>,
  activityDateOnly: string,
  characterIds?: number[]
): Record<string, number> {
  const allowed =
    characterIds && characterIds.length > 0 ? new Set(characterIds) : null
  const baselines: Record<string, number> = {}

  for (const result of results) {
    if (allowed && !allowed.has(result.charId)) continue
    const entryMap = buildEntryMapForDate(result.charId, result.entries, activityDateOnly)
    Object.assign(baselines, entryMap)
  }

  return baselines
}

/**
 * Merges baselines for late-join: preserves existing participant keys, adds keys for new chars only.
 */
export function mergeBaselinesForLateJoin(
  existing: Record<string, number>,
  incoming: Record<string, number>,
  newCharacterIds: number[]
): Record<string, number> {
  const merged = { ...existing }
  const allowed = new Set(newCharacterIds)

  for (const [key, qty] of Object.entries(incoming)) {
    const charId = parseInt(key.split('-')[0], 10)
    if (!allowed.has(charId)) continue
    if (merged[key] === undefined) {
      merged[key] = qty
    }
  }

  return merged
}

/**
 * Aggregates excluded baseline quantities by ore typeId for UI diagnostics.
 */
export function aggregateBaselinesByTypeId(
  baselines: Record<string, number>,
  activityDateOnly: string
): Record<number, number> {
  const byType: Record<number, number> = {}
  for (const [key, qty] of Object.entries(baselines)) {
    const parts = key.split('-')
    if (parts.length < 4) continue
    const date = parts.slice(3).join('-')
    if (date !== activityDateOnly) continue
    const typeId = parseInt(parts[1], 10)
    if (!Number.isFinite(typeId)) continue
    byType[typeId] = (byType[typeId] || 0) + qty
  }
  return byType
}

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }
      logger.info('MINING-LEDGER', `Retry ${i + 1}/${retries} for ${url} (status ${response.status})`)
    } catch (error) {
      lastError = error as Error
    }

    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (i + 1)))
    }
  }

  throw lastError || new Error('Fetch failed after retries')
}

/**
 * Ledger fetch result that distinguishes "no mining today" (ok, empty) from
 * "fetch failed" (token/scope/ESI error). Silent `[]` on failure is exactly the
 * class of bug that hides a broken character behind a partial total, so callers
 * that surface per-character sync errors must use this instead of the plain array.
 */
export type MiningLedgerFetchResult = {
  entries: MiningLedgerEntry[]
  ok: boolean
  error?: string
}

async function fetchMiningLedgerDetailed(
  charId: number,
  accessToken: string
): Promise<MiningLedgerFetchResult> {
  try {
    const firstResponse = await fetchWithRetry(`${ESI_BASE_URL}/characters/${charId}/mining/?page=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-User-Agent': 'EasyEve/1.0',
      },
    })

    if (!firstResponse.ok) {
      logger.error('MINING-LEDGER', 'Fetch error from ESI', null, {
        charId,
        status: firstResponse.status,
        error: firstResponse.statusText,
      })
      return { entries: [], ok: false, error: `esi_${firstResponse.status}` }
    }

    const pagesHeader = firstResponse.headers.get('x-pages')
    const totalPages = pagesHeader ? parseInt(pagesHeader, 10) : 1
    const allEntries: MiningLedgerEntry[] = []
    let anyPageFailed = false

    if (totalPages === 1) {
      const entries = await firstResponse.json()
      if (Array.isArray(entries)) allEntries.push(...entries)
    } else {
      for (let batchStart = 1; batchStart <= totalPages; batchStart += MAX_CONCURRENT_PAGES) {
        const batchEnd = Math.min(batchStart + MAX_CONCURRENT_PAGES - 1, totalPages)
        const pagePromises: Promise<Response>[] = []

        for (let page = batchStart; page <= batchEnd; page++) {
          pagePromises.push(
            fetchWithRetry(`${ESI_BASE_URL}/characters/${charId}/mining/?page=${page}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-User-Agent': 'EasyEve/1.0',
              },
            })
          )
        }

        const responses = await Promise.all(pagePromises)
        for (const response of responses) {
          if (!response.ok) {
            anyPageFailed = true
            continue
          }
          const entries = await response.json()
          if (Array.isArray(entries)) allEntries.push(...entries)
        }
      }
    }

    // A partial page failure means the total is understated — surface it rather
    // than passing an incomplete ledger off as complete.
    return {
      entries: allEntries,
      ok: !anyPageFailed,
      error: anyPageFailed ? 'esi_partial_pages' : undefined,
    }
  } catch (err) {
    logger.error('MINING-LEDGER', 'Fetch exception', err, { charId })
    return { entries: [], ok: false, error: 'esi_exception' }
  }
}

export async function fetchMiningLedgerWithToken(
  charId: number,
  accessToken: string
): Promise<MiningLedgerEntry[]> {
  const result = await fetchMiningLedgerDetailed(charId, accessToken)
  return result.entries
}

export async function fetchMiningLedgerForCharacter(
  charId: number,
  charName = ''
): Promise<{
  entries: MiningLedgerEntry[]
  charId: number
  charName: string
  ok: boolean
  error?: string
}> {
  const { accessToken } = await getValidAccessToken(charId)

  if (!accessToken) {
    logger.info('MINING-LEDGER', 'No access token found', { charId, charName })
    return { entries: [], charId, charName, ok: false, error: 'no_token' }
  }

  const result = await fetchMiningLedgerDetailed(charId, accessToken)
  return { entries: result.entries, charId, charName, ok: result.ok, error: result.error }
}

export async function readMiningDetectionCache(
  characterId: number,
  date: string
): Promise<MiningDetectionCacheValue | null> {
  const record = await prisma.sdeCache.findUnique({
    where: { key: miningDetectionCacheKey(characterId, date) },
  })
  if (!record?.value) return null

  const value = record.value as MiningDetectionCacheValue
  if (!value || typeof value !== 'object') return null

  return {
    entries: value.entries && typeof value.entries === 'object' ? value.entries : {},
    aggregateQty: typeof value.aggregateQty === 'number' ? value.aggregateQty : 0,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : '',
  }
}

export async function writeMiningDetectionCache(
  characterId: number,
  date: string,
  entries: Record<string, number>
): Promise<void> {
  const aggregateQty = sumEntryQuantities(entries)
  await prisma.sdeCache.upsert({
    where: { key: miningDetectionCacheKey(characterId, date) },
    update: {
      value: {
        entries,
        aggregateQty,
        timestamp: new Date().toISOString(),
      },
    },
    create: {
      key: miningDetectionCacheKey(characterId, date),
      value: {
        entries,
        aggregateQty,
        timestamp: new Date().toISOString(),
      },
    },
  })
}

/**
 * Refreshes detection cache from current ESI ledger (call when mining session ends/pauses).
 */
export async function refreshMiningDetectionCacheForCharacter(
  characterId: number,
  date?: string
): Promise<void> {
  const dateOnly = date ?? new Date().toISOString().split('T')[0]
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) return

  const ledger = await fetchMiningLedgerWithToken(characterId, accessToken)
  const entries = buildEntryMapForDate(characterId, ledger, dateOnly)
  await writeMiningDetectionCache(characterId, dateOnly, entries)
}

export async function refreshMiningDetectionCacheForActivity(
  participants: Array<{ characterId: number }>
): Promise<void> {
  const dateOnly = new Date().toISOString().split('T')[0]
  await Promise.allSettled(
    participants.map((p) => refreshMiningDetectionCacheForCharacter(p.characterId, dateOnly))
  )
}
