import { fillFromOrders, type MarketDepth, type MarketDepthLevel } from '@/lib/market-prices'
import type { AppraisalLineItem, AppraisalResult } from './types'

/** Matches the depth caches' refresh TTL (getRegionalMarketDepth / getStructureMarketDepth). */
const STALE_THRESHOLD_MS = 20 * 60 * 1000

/**
 * Volume fraction defining the reference price. Evepraisal's long-standing default:
 * take the top 5% of the order set by volume, so a single 1-unit troll order at the
 * top can't set the whole appraisal, while the number still tracks the real top of
 * market (and lines up with Janice within a fraction of a percent).
 */
const REFERENCE_PERCENTILE = 0.05

export interface ResolvedAppraisalItem {
  typeId: number
  name: string
  quantity: number
  /** Optional — display-only (icon/group aren't part of the pricing math), so tests
   * that don't care about them can omit these. */
  volume?: number | null
  groupName?: string | null
}

/**
 * Ecosystem-standard reference unit price (Janice / Evepraisal style): the
 * volume-weighted average over the top {@link REFERENCE_PERCENTILE} of the order
 * set, after dropping absurd outliers (Evepraisal's guard: buy orders under 1% of
 * the best bid, sell orders over 100× the best ask). `levels` must be best-first
 * (sell ascending / buy descending). Returns 0 for an empty book.
 *
 * This is a per-unit REFERENCE, not an order-book walk — a contract is priced at a
 * reference, not by depleting the live book.
 */
export function referenceUnitPrice(levels: MarketDepthLevel[], side: 'buy' | 'sell'): number {
  if (levels.length === 0) return 0
  const best = levels[0].price
  const usable = levels.filter((l) =>
    side === 'buy' ? l.price >= best * 0.01 : l.price <= best * 100
  )
  const pool = usable.length > 0 ? usable : levels

  const totalVolume = pool.reduce((sum, l) => sum + l.volume, 0)
  if (totalVolume <= 0) return pool[0].price

  const target = totalVolume * REFERENCE_PERCENTILE
  let taken = 0
  let cost = 0
  for (const level of pool) {
    const take = Math.min(level.volume, target - taken)
    if (take <= 0) break
    cost += take * level.price
    taken += take
    if (taken >= target) break
  }
  return taken > 0 ? cost / taken : pool[0].price
}

/**
 * Narrow region-wide depth down to specific stations (e.g. the Jita trade-hub
 * location ids) so a "Jita 4-4" appraisal isn't skewed by cheap sell orders
 * parked in remote stations elsewhere in The Forge. Preserves best-first order
 * and the snapshot timestamp. An empty result for a type keeps an entry (empty
 * book) so the caller still knows the type was looked up.
 */
export function filterDepthByLocations(
  depthByType: Record<number, MarketDepth>,
  locationIds: ReadonlySet<number>
): Record<number, MarketDepth> {
  const out: Record<number, MarketDepth> = {}
  for (const [id, depth] of Object.entries(depthByType)) {
    out[Number(id)] = {
      sell: depth.sell.filter((l) => locationIds.has(l.locationId)),
      buy: depth.buy.filter((l) => locationIds.has(l.locationId)),
      updatedAt: depth.updatedAt,
    }
  }
  return out
}

/**
 * Price a resolved item list against pre-fetched order-book depth (Jita region or a
 * private structure). Pure — the caller fetches depth.
 *
 * Headline = REFERENCE price × quantity (buy = top-of-market bid, sell = top-of-market
 * ask, 5% percentile), matching the ecosystem convention (Janice/Evepraisal) so
 * contract cross-checks line up. Separately, the real book is walked for the full
 * quantity to detect thinness: a book that can't absorb the full quantity surfaces
 * as `!sufficient` (regra de ouro #5) — the reference total is never shown as if it
 * were guaranteed fillable without that signal.
 */
export function appraiseItems(
  items: ResolvedAppraisalItem[],
  depthByType: Record<number, MarketDepth>,
  now: number = Date.now()
): AppraisalResult {
  const lineItems: AppraisalLineItem[] = items.map((item) => {
    const depth = depthByType[item.typeId]
    const sell = depth?.sell ?? []
    const buy = depth?.buy ?? []

    // Reference unit prices (ecosystem convention) → headline totals.
    const buyUnit = referenceUnitPrice(buy, 'buy')
    const sellUnit = referenceUnitPrice(sell, 'sell')
    const splitUnit = (buyUnit + sellUnit) / 2

    const buyTotal = buyUnit * item.quantity
    const sellTotal = sellUnit * item.quantity
    const splitTotal = (buyTotal + sellTotal) / 2

    // Execution reality (walks the real book) → thin-book warning only.
    // Sell side of the appraisal = buying from asks; buy side = selling into bids.
    const sellFill = fillFromOrders(sell, item.quantity)
    const buyFill = fillFromOrders(buy, item.quantity)

    const noOrders = sell.length === 0 && buy.length === 0
    const stale = depth != null && depth.updatedAt > 0 && now - depth.updatedAt > STALE_THRESHOLD_MS

    return {
      typeId: item.typeId,
      name: item.name,
      quantity: item.quantity,
      volume: item.volume ?? null,
      groupName: item.groupName ?? null,
      buyUnit,
      sellUnit,
      splitUnit,
      buyTotal,
      sellTotal,
      splitTotal,
      buyFilledQty: buyFill.filledQty,
      sellFilledQty: sellFill.filledQty,
      // An item with no orders on a side isn't "sufficient" — only claim sufficiency
      // when there were real orders that covered the full quantity.
      buySufficient: buy.length > 0 && buyFill.sufficient,
      sellSufficient: sell.length > 0 && sellFill.sufficient,
      stale,
      noOrders,
    }
  })

  const totalBuy = lineItems.reduce((sum, i) => sum + i.buyTotal, 0)
  const totalSell = lineItems.reduce((sum, i) => sum + i.sellTotal, 0)
  const totalSplit = lineItems.reduce((sum, i) => sum + i.splitTotal, 0)

  return { items: lineItems, unresolvedNames: [], totalBuy, totalSell, totalSplit }
}
