import type { MarketDepth } from '@/lib/market-prices'

/** How old a source's data is allowed to look "live" before the UI flags it. Matches
 * the depth caches' own refresh TTL (structure: STRUCT_DEPTH_TTL, region: MARKET_DEPTH_TTL). */
const STALE_THRESHOLD_MS = 20 * 60 * 1000

export interface ShoppingPriceSource {
  /** Best (top-of-book) sell-order price — what you'd pay for the next unit. */
  price: number
  /** Total sell-order volume available across the book (0 = no orders posted). */
  available: number
  /** True when this snapshot is older than one refresh cycle — e.g. the source kept
   * serving expired cache because live ESI fetches have been failing. Never hide this;
   * the UI must warn instead of presenting old numbers as current (regra de ouro). */
  stale: boolean
}

export interface ShoppingPriceRow {
  /** undefined = source not configured for this user (not "zero stock"). */
  primary?: ShoppingPriceSource
  secondary?: ShoppingPriceSource
  jita: ShoppingPriceSource
}

function sourceFromDepth(depth: MarketDepth | undefined): ShoppingPriceSource {
  const sell = depth?.sell ?? []
  return {
    price: sell[0]?.price ?? 0,
    available: sell.reduce((sum, level) => sum + level.volume, 0),
    stale: depth != null && Date.now() - depth.updatedAt > STALE_THRESHOLD_MS,
  }
}

/**
 * Per-item buy price + available sell-order volume from up to three sources
 * (primary structure, secondary structure, Jita), for the Shopping List's price
 * comparison columns. Pure — depths are pre-fetched by the caller (API route).
 */
export function buildShoppingPriceRows(
  typeIds: number[],
  sources: {
    primaryDepth?: Record<number, MarketDepth> | null
    secondaryDepth?: Record<number, MarketDepth> | null
    jitaDepth: Record<number, MarketDepth>
  }
): Record<number, ShoppingPriceRow> {
  const result: Record<number, ShoppingPriceRow> = {}
  for (const id of new Set(typeIds)) {
    result[id] = {
      primary: sources.primaryDepth ? sourceFromDepth(sources.primaryDepth[id]) : undefined,
      secondary: sources.secondaryDepth ? sourceFromDepth(sources.secondaryDepth[id]) : undefined,
      jita: sourceFromDepth(sources.jitaDepth[id]),
    }
  }
  return result
}

/**
 * A shopping-list row is a deficit at the primary hub when a primary source is
 * configured and its available stock can't cover the needed quantity. No primary
 * configured => never flagged (nothing to compare against).
 */
export function isDeficientAtPrimary(row: ShoppingPriceRow | undefined, quantity: number): boolean {
  if (!row?.primary) return false
  return row.primary.available < quantity
}

export type ShoppingPriceSourceKey = 'primary' | 'secondary' | 'jita'

/**
 * Which source is cheapest/priciest for a row, for a subtle buy-here/avoid-here
 * indicator. Ignores sources with no real orders (price/available <= 0) and stale
 * sources (a "buy here, it's cheapest" signal built on an old snapshot could send
 * someone to a price that no longer exists) — and needs at least 2 comparable
 * sources to mean anything (a single source is neither cheap nor expensive).
 */
export function findCheapestAndPriciest(row: ShoppingPriceRow | undefined): {
  cheapest?: ShoppingPriceSourceKey
  priciest?: ShoppingPriceSourceKey
} {
  if (!row) return {}
  const entries = (
    [
      ['primary', row.primary],
      ['secondary', row.secondary],
      ['jita', row.jita],
    ] as const
  ).filter(
    (entry): entry is [ShoppingPriceSourceKey, ShoppingPriceSource] =>
      entry[1] != null && entry[1].price > 0 && entry[1].available > 0 && !entry[1].stale
  )

  if (entries.length < 2) return {}

  let cheapest = entries[0]!
  let priciest = entries[0]!
  for (const entry of entries) {
    if (entry[1].price < cheapest[1].price) cheapest = entry
    if (entry[1].price > priciest[1].price) priciest = entry
  }
  if (cheapest[1].price === priciest[1].price) return {}

  return { cheapest: cheapest[0], priciest: priciest[0] }
}
