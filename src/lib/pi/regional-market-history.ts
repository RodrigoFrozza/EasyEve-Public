import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { withEsiRetry } from '@/lib/esi-retry'
import { logger } from '@/lib/server-logger'

// ESI's own /markets/{region_id}/history/ payload only refreshes once/day
// server-side (CCP docs), so a short client TTL would just churn cache for no
// benefit — 12h caps us at 2 ESI calls/day per (region, type) pair.
const HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000
const HISTORY_CACHE_KEY_PREFIX = 'pi_market_history_'
// Same rationale as MARKET_DEPTH_MAX_FALLBACK_AGE_MS in market-prices.ts: don't
// serve a stale fallback forever if ESI keeps failing — past this bound, treat
// it as no data rather than trust a week-plus-old snapshot.
const HISTORY_MAX_FALLBACK_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export interface RegionalHistoryPoint {
  date: string
  average: number
  highest: number
  lowest: number
  orderCount: number
  volume: number
}

interface CachedHistory {
  points: RegionalHistoryPoint[]
  updatedAt: number
}

export interface RegionalMarketHistoryResult {
  points: RegionalHistoryPoint[]
  updatedAt: number
  /** true when this is a fallback (cache survived an ESI error) rather than a fresh read. */
  stale: boolean
}

function cacheKey(regionId: number, typeId: number): string {
  return `${HISTORY_CACHE_KEY_PREFIX}${regionId}_${typeId}`
}

function isNotFound(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 404
}

async function writeCache(key: string, value: CachedHistory, now: number): Promise<void> {
  await prisma.sdeCache.upsert({
    where: { key },
    create: { key, value: value as any, expiresAt: new Date(now + HISTORY_CACHE_TTL_MS) },
    update: { value: value as any, expiresAt: new Date(now + HISTORY_CACHE_TTL_MS) },
  })
}

/**
 * Public, unauthenticated ESI region history for a single type — up to ~13
 * months of daily points (CCP publishes one refresh/day). No public history
 * endpoint exists for private structures (see StationMarketSnapshot for that
 * side); this only ever covers NPC region markets (e.g. Jita).
 *
 * Returns `null` only when we genuinely don't know (ESI failed and no cache,
 * or the cache aged past HISTORY_MAX_FALLBACK_AGE_MS) — callers must not
 * treat that the same as "confirmed zero history" (a type ESI has never seen
 * traded in that region returns 404, which this maps to a real, empty
 * `points: []` result, not `null`), per the project's rule against inventing
 * data or hiding the difference between "no data" and "couldn't check."
 */
export async function getRegionalMarketHistory(
  regionId: number,
  typeId: number
): Promise<RegionalMarketHistoryResult | null> {
  const key = cacheKey(regionId, typeId)
  const now = Date.now()

  const cached = await prisma.sdeCache.findUnique({ where: { key } })
  const cachedValue = cached?.value as unknown as CachedHistory | undefined

  if (cachedValue && now - cachedValue.updatedAt < HISTORY_CACHE_TTL_MS) {
    return { points: cachedValue.points, updatedAt: cachedValue.updatedAt, stale: false }
  }

  try {
    const res = await withEsiRetry(() =>
      esiClient.get(`/markets/${regionId}/history/`, { params: { type_id: typeId } })
    )
    const raw = Array.isArray(res.data) ? res.data : []
    const points: RegionalHistoryPoint[] = raw.map((p: Record<string, number | string>) => ({
      date: String(p.date),
      average: Number(p.average),
      highest: Number(p.highest),
      lowest: Number(p.lowest),
      orderCount: Number(p.order_count),
      volume: Number(p.volume),
    }))

    const value: CachedHistory = { points, updatedAt: now }
    await writeCache(key, value, now)
    return { points, updatedAt: now, stale: false }
  } catch (error) {
    if (isNotFound(error)) {
      // Confirmed: ESI has no order history for this type in this region ever.
      // That is real information (cache it), not a failure.
      const value: CachedHistory = { points: [], updatedAt: now }
      await writeCache(key, value, now)
      return { points: [], updatedAt: now, stale: false }
    }

    if (cachedValue) {
      const age = now - cachedValue.updatedAt
      if (age <= HISTORY_MAX_FALLBACK_AGE_MS) {
        logger.warn(
          'PI',
          `ESI error fetching region history (region ${regionId}, type ${typeId}) — serving stale cache`,
          error
        )
        return { points: cachedValue.points, updatedAt: cachedValue.updatedAt, stale: true }
      }
      logger.warn(
        'PI',
        `ESI error fetching region history (region ${regionId}, type ${typeId}) — cache too old (${Math.round(
          age / 3_600_000
        )}h), treating as no data`,
        error
      )
    } else {
      logger.error(
        'PI',
        `ESI error fetching region history (region ${regionId}, type ${typeId}) and no cache available`,
        error
      )
    }
    return null
  }
}
