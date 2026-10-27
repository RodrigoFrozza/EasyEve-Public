import { prisma } from '@/lib/prisma'
import { getCharacterAssets } from '@/lib/esi'
import { logger } from '@/lib/server-logger'

/**
 * Aggregate "how much of each item do I already own" across every character on
 * the account, for the Industry cost calculator's "já tenho" (owned) column.
 *
 * ALL-LOCATIONS DECISION: we intentionally sum quantities across every location
 * an asset can be in (stations, structures, containers, ship cargo, etc.), not
 * just the chosen build station. ESI's asset endpoint gives no reliable, cheap
 * way to resolve arbitrary `location_id`s to "is this at my build station" without
 * a chain of extra calls per asset (and many location_ids are containers/ships
 * that themselves need resolving). Rather than guess or silently under/over-count,
 * we count everything and label it honestly in the UI ("todas as localizações e
 * personagens" — see IndustryCalculator.tsx). This can overstate what's usable
 * at a specific station; the user reviews/edits the prefilled quantity before
 * relying on it.
 *
 * GOLDEN RULE (CLAUDE.md): a per-character ESI failure must never be silently
 * zeroed into the aggregate. `getCharacterAssets` is called with
 * `{ throwOnError: true }` specifically so a failure surfaces here instead of
 * silently resolving to `[]` (its default behavior). Failures are isolated per
 * character (Promise.all + try/catch) and returned in `failed[]`; the caller
 * (UI) is responsible for telling the user the count may be understated. On
 * TOTAL failure (every character failed) we serve a still-usable cache (<30min)
 * flagged `stale`, or otherwise return an EMPTY stock with `failed` populated —
 * never a fabricated/estimated stock.
 *
 * Cache: SdeCache row keyed by `industry_asset_stock_<userId>`, mirroring the
 * shape used by src/lib/industry/industry-jobs.ts (short TTL because assets can
 * change, but 5 min is plenty since this isn't a live-timer dashboard).
 */

const LOG_TAG = 'INDUSTRY_ASSET_STOCK'

const CACHE_KEY_PREFIX = 'industry_asset_stock_'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min — assets change slowly, short cache is fine
const STALE_SERVE_MAX_AGE_MS = 30 * 60 * 1000 // serve a stale cache on total ESI failure if <30min old

interface EsiAssetItem {
  item_id: number
  type_id: number
  quantity: number
  location_id: number
  location_flag: string
  is_singleton: boolean
}

export interface AssetStockResult {
  stock: Record<number, number> // type_id -> total quantity summed across ALL characters & ALL locations
  failed: number[] // character ids whose asset fetch failed (surfaced, never zeroed silently)
  fetchedAt: number
  stale?: boolean
}

interface CachedPayload {
  stock: Record<number, number>
  fetchedAt: number
}

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

async function readCache(userId: string): Promise<CachedPayload | null> {
  const row = await prisma.sdeCache.findUnique({ where: { key: cacheKey(userId) } })
  if (!row) return null
  const value = row.value as unknown as CachedPayload
  if (!value || typeof value.stock !== 'object' || value.stock === null || typeof value.fetchedAt !== 'number') return null
  return value
}

async function writeCache(userId: string, payload: CachedPayload): Promise<void> {
  const key = cacheKey(userId)
  await prisma.sdeCache.upsert({
    where: { key },
    create: { key, value: payload as any, expiresAt: new Date(payload.fetchedAt + CACHE_TTL_MS) },
    update: { value: payload as any, expiresAt: new Date(payload.fetchedAt + CACHE_TTL_MS) },
  })
}

/**
 * Fetch every character's assets, aggregate quantity by type_id across all
 * characters and locations, and cache the result. A per-character ESI failure
 * is collected in `failed` and never hides the others (degrade per-item, per
 * CLAUDE.md). On TOTAL ESI failure (every character failed) we fall back to a
 * cache that's still reasonably fresh (<30 min) and flag it `stale`; otherwise
 * we return whatever succeeded (possibly empty) — never a silently-defaulted
 * value.
 */
export async function getUserAssetStock(
  userId: string,
  characterIds: number[],
  opts?: { forceRefresh?: boolean }
): Promise<AssetStockResult> {
  if (characterIds.length === 0) return { stock: {}, failed: [], fetchedAt: Date.now() }

  if (!opts?.forceRefresh) {
    const cached = await readCache(userId)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { stock: cached.stock, failed: [], fetchedAt: cached.fetchedAt }
    }
  }

  const failed: number[] = []
  const stock: Record<number, number> = {}

  await Promise.all(
    characterIds.map(async (characterId) => {
      try {
        const assets = (await getCharacterAssets(characterId, { throwOnError: true })) as EsiAssetItem[]
        for (const asset of assets) {
          const typeId = asset?.type_id
          const quantity = asset?.quantity
          if (typeof typeId !== 'number' || !Number.isFinite(typeId)) continue
          if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) continue
          stock[typeId] = (stock[typeId] ?? 0) + quantity
        }
      } catch (error) {
        logger.warn(LOG_TAG, `Asset fetch failed for character ${characterId}`, error)
        failed.push(characterId)
      }
    })
  )

  // Total failure (every requested character errored, nothing fetched at all):
  // serve a still-usable cache instead of a fabricated/empty result, flagged stale.
  if (failed.length === characterIds.length) {
    const cached = await readCache(userId)
    if (cached && Date.now() - cached.fetchedAt < STALE_SERVE_MAX_AGE_MS) {
      return { stock: cached.stock, failed, fetchedAt: cached.fetchedAt, stale: true }
    }
    return { stock: {}, failed, fetchedAt: Date.now() }
  }

  const fetchedAt = Date.now()
  // Cache even a partial result (some characters failed) — better than hammering
  // ESI again within the TTL for the characters that DID succeed. `failed` itself
  // is never cached; it's always recomputed from the live attempt.
  await writeCache(userId, { stock, fetchedAt })

  return { stock, failed, fetchedAt }
}
