import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'

/**
 * Local (non-EVE Ref) manufacturing job cost fallback. Used when EVE Ref is
 * unreachable but the user configured a manufacturing system + facility tax —
 * we still compute a job cost rather than silently showing nothing, but it
 * EXCLUDES structure job-cost bonuses (couldn't be confirmed from a primary
 * source — see F:\Brain\Easy-Eve). Callers must label this as approximate.
 *
 * Verified 2026-07-16 against ESI + EVE Ref:
 *   total = EIV × [(system_cost_index × structure_bonus) + facility_tax + SCC]
 *   EIV = Σ(material base quantity at ME0, per run) × adjusted_price × runs
 *   SCC surcharge = 4% of EIV (current since 2024-02-01 patch)
 */

const ADJUSTED_PRICES_CACHE_KEY = 'industry_adjusted_prices'
const ADJUSTED_PRICES_TTL_MS = 6 * 60 * 60 * 1000 // 6h
const COST_INDICES_CACHE_KEY = 'industry_cost_indices_v2'
const COST_INDICES_TTL_MS = 60 * 60 * 1000 // 1h
const MAX_FALLBACK_AGE_MS = 24 * 60 * 60 * 1000 // 24h — beyond this, stop trusting the cache

const SCC_SURCHARGE_RATE = 0.04

interface AdjustedPriceEntry {
  type_id: number
  adjusted_price?: number
}

interface CachedAdjustedPrices {
  prices: Record<number, number>
  updatedAt: number
}

/**
 * Adjusted (EIV) prices for the given type ids, from ESI /markets/prices/. Fetches
 * and caches the FULL list (that's what the endpoint returns — no per-id query),
 * serving requested ids out of it. On ESI failure, serves the cached list while
 * it's under 24h old; otherwise throws so the caller surfaces "unavailable"
 * instead of inventing a price (regra de ouro).
 */
export async function getAdjustedPrices(typeIds: number[]): Promise<Record<number, number>> {
  const uniqueIds = Array.from(new Set(typeIds))
  if (uniqueIds.length === 0) return {}

  const now = Date.now()
  const cached = await prisma.sdeCache.findUnique({ where: { key: ADJUSTED_PRICES_CACHE_KEY } })
  const cachedValue = cached?.value as unknown as CachedAdjustedPrices | undefined

  if (cachedValue && now - cachedValue.updatedAt < ADJUSTED_PRICES_TTL_MS) {
    return pickIds(cachedValue.prices, uniqueIds)
  }

  try {
    const res = await esiClient.get('/markets/prices/')
    const data = Array.isArray(res.data) ? (res.data as AdjustedPriceEntry[]) : []
    const prices: Record<number, number> = {}
    for (const entry of data) {
      if (typeof entry.type_id === 'number' && typeof entry.adjusted_price === 'number') {
        prices[entry.type_id] = entry.adjusted_price
      }
    }
    const value: CachedAdjustedPrices = { prices, updatedAt: now }
    await prisma.sdeCache.upsert({
      where: { key: ADJUSTED_PRICES_CACHE_KEY },
      create: { key: ADJUSTED_PRICES_CACHE_KEY, value: value as any, expiresAt: new Date(now + ADJUSTED_PRICES_TTL_MS) },
      update: { value: value as any, expiresAt: new Date(now + ADJUSTED_PRICES_TTL_MS) },
    })
    return pickIds(prices, uniqueIds)
  } catch (error) {
    if (cachedValue && now - cachedValue.updatedAt < MAX_FALLBACK_AGE_MS) {
      logger.warn('INDUSTRY_JOB_COST', 'ESI /markets/prices/ failed, serving expired cache', error)
      return pickIds(cachedValue.prices, uniqueIds)
    }
    logger.error('INDUSTRY_JOB_COST', 'ESI /markets/prices/ failed and no usable cache', error)
    throw error
  }
}

function pickIds(prices: Record<number, number>, ids: number[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const id of ids) {
    if (prices[id] != null) out[id] = prices[id]
  }
  return out
}

interface CostIndexEntry {
  solar_system_id: number
  cost_indices?: { activity: string; cost_index: number }[]
}

export type CostIndexActivity = 'manufacturing' | 'reaction'

/**
 * Both activities we care about, keyed separately inside ONE cached document —
 * a single ESI /industry/systems/ call already returns every activity's index
 * per system, so we cache the whole per-activity breakdown rather than issuing
 * a second HTTP call per activity. This is also how a reaction request is kept
 * from ever being served a manufacturing index or vice versa: each activity has
 * its own nested map, looked up by key, never merged/flattened together.
 */
interface CachedCostIndices {
  indices: Record<CostIndexActivity, Record<number, number>>
  updatedAt: number
}

function emptyIndices(): Record<CostIndexActivity, Record<number, number>> {
  return { manufacturing: {}, reaction: {} }
}

/**
 * System cost index for a solar system + activity, from ESI
 * /industry/systems/. Fetches and caches the full list (1h TTL, expired cache
 * served up to 24h). Returns null when the system/activity isn't in the list or
 * on total failure — null means "unknown", never defaulted to 0 (regra de ouro).
 *
 * Cache key bumped to `_v2` on this change: the cached value shape changed from
 * a flat `Record<systemId, number>` (manufacturing only) to the nested
 * per-activity map above. Bumping the key guarantees a stale flat-shaped cache
 * entry from before this deploy can never be misread as the new shape (it would
 * otherwise silently resolve to "index not found" instead of crashing, which is
 * still safe per regra de ouro, but the version bump avoids relying on that).
 */
export async function getCostIndex(solarSystemId: number, activity: CostIndexActivity): Promise<number | null> {
  const now = Date.now()
  const cached = await prisma.sdeCache.findUnique({ where: { key: COST_INDICES_CACHE_KEY } })
  const cachedValue = cached?.value as unknown as CachedCostIndices | undefined

  if (cachedValue && now - cachedValue.updatedAt < COST_INDICES_TTL_MS) {
    return cachedValue.indices[activity]?.[solarSystemId] ?? null
  }

  try {
    const res = await esiClient.get('/industry/systems/')
    const data = Array.isArray(res.data) ? (res.data as CostIndexEntry[]) : []
    const indices = emptyIndices()
    for (const entry of data) {
      if (typeof entry.solar_system_id !== 'number') continue
      for (const act of Object.keys(indices) as CostIndexActivity[]) {
        const found = entry.cost_indices?.find((c) => c.activity === act)
        if (found) indices[act][entry.solar_system_id] = found.cost_index
      }
    }
    const value: CachedCostIndices = { indices, updatedAt: now }
    await prisma.sdeCache.upsert({
      where: { key: COST_INDICES_CACHE_KEY },
      create: { key: COST_INDICES_CACHE_KEY, value: value as any, expiresAt: new Date(now + COST_INDICES_TTL_MS) },
      update: { value: value as any, expiresAt: new Date(now + COST_INDICES_TTL_MS) },
    })
    return indices[activity][solarSystemId] ?? null
  } catch (error) {
    if (cachedValue && now - cachedValue.updatedAt < MAX_FALLBACK_AGE_MS) {
      logger.warn('INDUSTRY_JOB_COST', 'ESI /industry/systems/ failed, serving expired cache', error)
      return cachedValue.indices[activity]?.[solarSystemId] ?? null
    }
    logger.error('INDUSTRY_JOB_COST', 'ESI /industry/systems/ failed and no usable cache', error)
    return null
  }
}

/** Thin wrapper — existing callers (manufacturing-only) keep working unchanged. */
export async function getManufacturingCostIndex(solarSystemId: number): Promise<number | null> {
  return getCostIndex(solarSystemId, 'manufacturing')
}

export interface LocalJobCost {
  total: number
  sccSurcharge: number
  facilityTax: number
  indexCost: number
}

/**
 * Pure job-cost math (no structure bonus — see file header):
 *   indexCost = eiv × costIndex
 *   sccSurcharge = eiv × 4%
 *   facilityTax = eiv × (facilityTaxPct / 100)
 *   total = sum of the three
 */
export function computeLocalJobCost(params: {
  eiv: number
  costIndex: number
  facilityTaxPct: number
}): LocalJobCost {
  const eiv = Math.max(0, params.eiv)
  const costIndex = Math.max(0, params.costIndex)
  const facilityTaxPct = Math.max(0, params.facilityTaxPct)

  const indexCost = eiv * costIndex
  const sccSurcharge = eiv * SCC_SURCHARGE_RATE
  const facilityTax = eiv * (facilityTaxPct / 100)

  return {
    total: indexCost + sccSurcharge + facilityTax,
    sccSurcharge,
    facilityTax,
    indexCost,
  }
}

export interface EivMaterial {
  typeId: number
  baseQuantity: number
}

export interface EivResult {
  eiv: number
  missingPrices: number[]
}

/**
 * Estimated Item Value for a manufacturing job: Σ(base quantity at ME0, per run)
 * × adjusted_price × runs. ME does NOT reduce EIV — always use the ME0 base
 * quantities, never the ME-reduced required quantities. Materials without an
 * adjusted price are surfaced in missingPrices rather than silently priced at 0.
 */
export function computeEiv(materials: EivMaterial[], runs: number, adjusted: Record<number, number>): EivResult {
  const safeRuns = Math.max(1, Math.floor(runs))
  let eiv = 0
  const missingPrices: number[] = []
  for (const m of materials) {
    const price = adjusted[m.typeId]
    if (price == null) {
      missingPrices.push(m.typeId)
      continue
    }
    eiv += m.baseQuantity * safeRuns * price
  }
  return { eiv, missingPrices }
}
