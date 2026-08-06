/** Shared loot intelligence helpers (cross-activity v2). */

export const LOOT_INTEL_ALL_SPACES = ''

export const MIN_GLOBAL_SAMPLE_EVENTS = 20

/** @deprecated Use MIN_GLOBAL_SAMPLE_EVENTS */
export const MIN_GLOBAL_SAMPLE_BATCHES = MIN_GLOBAL_SAMPLE_EVENTS

export type LootIntelDimensionRow = {
  key: string
  label: string
  subLabel?: string
  totalEvents: number
  totalValue: number
  avgValuePerEvent: number
  avgIskPerHour: number | null
  sampleSufficient: boolean
}

export type LootIntelItemRow = {
  typeId: number
  itemName: string
  dropRatePct: number
  eventsWithItem: number
  totalQuantity: number
  avgValuePerAppearance: number
  totalValue: number
}

export type LootIntelRegionRow = {
  regionId: number
  regionName: string
  totalEvents: number
  totalValue: number
  avgValuePerEvent: number
  avgIskPerHour: number | null
  sampleSufficient: boolean
}

export type LootIntelResponse = {
  meta: {
    minSampleEvents: number
    generatedAt: string
    scope: 'global' | 'me'
    sampleSufficient: boolean
    totalEvents: number
  }
  dimensionRanking: LootIntelDimensionRow[]
  items: LootIntelItemRow[]
  regionRanking?: LootIntelRegionRow[]
  filters: Record<string, string[]>
}

export function rollupSpaceKey(spaceType: string | null | undefined): string {
  return spaceType?.trim() || LOOT_INTEL_ALL_SPACES
}

/**
 * Sanity ceiling for a single loot-intel event/item/session value (ISK). These values
 * come from client-controlled `activity.data` (edited via PATCH) with no server-side
 * appraisal check, and are summed directly into rollups shared by every user — an
 * absurd value (a client bug, or a malicious edit) would otherwise permanently corrupt
 * the community average until that one session is deleted. 50B ISK is comfortably above
 * any real single event/session in these activities (ratting, mining, exploration,
 * abyssal, escalations) while still catching orders-of-magnitude bugs.
 */
export const LOOT_INTEL_MAX_EVENT_VALUE = 50_000_000_000

export function clampLootIntelValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value, LOOT_INTEL_MAX_EVENT_VALUE)
}

export function decimalToNumber(value: { toNumber?: () => number } | number | bigint): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (value && typeof value.toNumber === 'function') return value.toNumber()
  return Number(value)
}

export function computeDropRatePct(eventsWithItem: number, totalEvents: number): number {
  if (totalEvents <= 0) return 0
  return (eventsWithItem / totalEvents) * 100
}

export type DurationSplitBucket = {
  key: string | number
  value: number
}

/**
 * Split totalDurationMs across buckets proportionally by value (ISK).
 * When all values are zero, splits duration equally.
 * Sum of returned durations equals totalDurationMs.
 */
export function splitDurationByValue(
  totalDurationMs: number,
  buckets: DurationSplitBucket[]
): Map<string | number, number> {
  const result = new Map<string | number, number>()
  if (totalDurationMs <= 0 || buckets.length === 0) return result

  const totalValue = buckets.reduce((sum, bucket) => sum + Math.max(0, bucket.value), 0)

  if (totalValue <= 0) {
    const base = Math.floor(totalDurationMs / buckets.length)
    let remainder = totalDurationMs - base * buckets.length
    for (const bucket of buckets) {
      const extra = remainder > 0 ? 1 : 0
      if (remainder > 0) remainder -= 1
      result.set(bucket.key, base + extra)
    }
    return result
  }

  let assigned = 0
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]
    if (i === buckets.length - 1) {
      result.set(bucket.key, totalDurationMs - assigned)
    } else {
      const share = Math.floor((totalDurationMs * Math.max(0, bucket.value)) / totalValue)
      result.set(bucket.key, share)
      assigned += share
    }
  }
  return result
}

/** Use snapshot duration from ingestion when available (symmetric retract). */
export function resolveIngestedDurationMs(
  stored: bigint | null | undefined,
  fallbackMs: number
): number {
  if (stored != null) return Number(stored)
  return fallbackMs
}

export function buildDimensionRows<T extends {
  totalEvents: number
  totalValue: { toNumber?: () => number } | number | bigint
  totalDurationMs: bigint | number
}>(
  rollups: T[],
  mapRow: (r: T) => { key: string; label: string; subLabel?: string },
  options?: { minSample?: number; sortBy?: 'avgPerEvent' | 'iskPerHour' }
): LootIntelDimensionRow[] {
  const minSample = options?.minSample ?? MIN_GLOBAL_SAMPLE_EVENTS
  const rows = rollups.map((r) => {
    const totalEvents = r.totalEvents
    const totalValue = decimalToNumber(r.totalValue)
    const durationMs = decimalToNumber(r.totalDurationMs)
    const hours = durationMs > 0 ? durationMs / 3_600_000 : 0
    const mapped = mapRow(r)
    return {
      ...mapped,
      totalEvents,
      totalValue,
      avgValuePerEvent: totalEvents > 0 ? totalValue / totalEvents : 0,
      avgIskPerHour: hours > 0 ? totalValue / hours : null,
      sampleSufficient: totalEvents >= minSample,
    }
  })

  if (options?.sortBy === 'iskPerHour') {
    return rows.sort((a, b) => (b.avgIskPerHour ?? 0) - (a.avgIskPerHour ?? 0))
  }
  return rows.sort((a, b) => b.avgValuePerEvent - a.avgValuePerEvent)
}

export function buildItemRows<T extends {
  typeId: number
  itemName: string
  eventsWithItem: number
  totalQuantity: number
  totalValue: { toNumber?: () => number } | number | bigint
}>(
  itemRollups: T[],
  totalEvents: number
): LootIntelItemRow[] {
  return itemRollups
    .map((r) => {
      const eventsWithItem = r.eventsWithItem
      const totalValue = decimalToNumber(r.totalValue)
      return {
        typeId: r.typeId,
        itemName: r.itemName,
        dropRatePct: computeDropRatePct(eventsWithItem, totalEvents),
        eventsWithItem,
        totalQuantity: r.totalQuantity,
        avgValuePerAppearance: eventsWithItem > 0 ? totalValue / eventsWithItem : 0,
        totalValue,
      }
    })
    .sort((a, b) => b.dropRatePct - a.dropRatePct || b.totalValue - a.totalValue)
}
