/**
 * Turn a structure's raw order book into market-deficit signals for the
 * "what to produce" scanner, and rank manufacturable deficits by how worth-building
 * they are. Pure — every signal comes from the real order book (regra de ouro): no
 * invented price history. The only thresholds are "demand outweighs supply" and
 * the demand floor MIN_DEMAND_ISK (a product decision, applied by the caller).
 */

import type { ProductionActivity } from '@/lib/industry/get-blueprint'

export interface StationOrderAggregate {
  typeId: number
  /** Units currently on sell orders (supply). */
  sellVolume: number
  /** Units currently on buy orders (demand). */
  buyVolume: number
  /** Best (lowest) sell price — what a buyer pays for the finished item here. */
  bestSell: number
  /** Best (highest) buy price — immediate sale price here. */
  bestBuy: number
}

/** Aggregate a flat order list (one structure) into per-type supply/demand. */
export function aggregateStationOrders(
  orders: { type_id: number; is_buy_order: boolean; price: number; volume_remain: number }[]
): Map<number, StationOrderAggregate> {
  const byType = new Map<number, StationOrderAggregate>()
  for (const o of orders) {
    if (!(o.price > 0) || !(o.volume_remain > 0)) continue
    const agg =
      byType.get(o.type_id) ??
      { typeId: o.type_id, sellVolume: 0, buyVolume: 0, bestSell: 0, bestBuy: 0 }
    if (o.is_buy_order) {
      agg.buyVolume += o.volume_remain
      if (o.price > agg.bestBuy) agg.bestBuy = o.price
    } else {
      agg.sellVolume += o.volume_remain
      if (agg.bestSell === 0 || o.price < agg.bestSell) agg.bestSell = o.price
    }
    byType.set(o.type_id, agg)
  }
  return byType
}

/**
 * Is this a market deficit? True when there's real demand the current supply
 * can't meet: buy orders exist and outweigh sell stock (or nobody is selling at
 * all). Pure order-book fact, labeled as such in the UI.
 */
export function isDeficit(agg: StationOrderAggregate): boolean {
  return agg.buyVolume > 0 && agg.buyVolume > agg.sellVolume
}

export interface DeficitCandidate extends StationOrderAggregate {
  /** buyVolume / (sellVolume + 1) — higher = scarcer relative to demand. */
  scarcityRatio: number
}

/**
 * From all aggregated types, keep the manufacturable ones in deficit and pre-rank
 * them (scarcity × the price of the finished item) so the caller only pays for the
 * expensive production-cost pricing on the most promising `limit` candidates.
 */
export function pickDeficitCandidates(
  aggregates: Map<number, StationOrderAggregate>,
  isManufacturable: (typeId: number) => boolean,
  limit: number
): DeficitCandidate[] {
  const candidates: DeficitCandidate[] = []
  for (const agg of aggregates.values()) {
    if (!isManufacturable(agg.typeId)) continue
    if (!isDeficit(agg)) continue
    candidates.push({ ...agg, scarcityRatio: agg.buyVolume / (agg.sellVolume + 1) })
  }
  // Pre-rank by scarcity weighted by the item's value (a scarce cheap item matters
  // less than a scarce expensive one). Uses bestBuy as the value proxy (there may
  // be no sell orders at all in a deficit).
  candidates.sort((a, b) => b.scarcityRatio * b.bestBuy - a.scarcityRatio * a.bestBuy)
  return candidates.slice(0, limit)
}

export type BuildVsBuy = 'make' | 'buy' | 'neutral'

export interface DeficitRow {
  productTypeId: number
  productName: string
  /** How the item is made: a manufacturing blueprint or a reaction formula. */
  activity: ProductionActivity
  stationId: string
  stationName: string

  sellVolume: number
  buyVolume: number
  scarce: boolean

  /** Price of the finished item here (best sell; falls back to best buy). */
  itemPrice: number
  /** Cost to build one unit from materials at the buy hubs. */
  productionCost: number
  /**
   * Job installation cost per unit (local EIV × cost-index formula, no structure
   * bonus). Null when not configured or not computable — see jobCostMissing.
   */
  jobCostPerUnit: number | null
  /** A manufacturing system is configured but this row's job cost couldn't be computed. */
  jobCostMissing: boolean
  /** itemPrice after the configured sales tax + broker fee (= itemPrice when none configured). */
  netItemPrice: number
  /** netItemPrice − productionCost − jobCostPerUnit (per unit). */
  unitProfit: number
  /** unitProfit / (productionCost + jobCostPerUnit). 0 when cost is 0. */
  margin: number
  /** Cheaper to build than to buy the finished item here, or vice-versa. */
  buildVsBuy: BuildVsBuy

  /** Whole-job build time (seconds) for one blueprint run; null when unknown. */
  buildTimeSeconds: number | null
  /** Net ISK/h = unitProfit × output/run ÷ build hours; null when time/profit unknown. */
  iskPerHour: number | null

  /**
   * Absorbable demand at this structure (units): the mean buy-order volume over
   * the snapshot days we have, or the live buy volume when there's no history.
   * The liquidity axis — how much actually sells here.
   */
  demandVolume: number
  /** How many snapshot days informed demandVolume (0 = live only, no history yet). */
  demandDays: number
  /** demandVolume × best buy price: the ISK the buyers here are actually offering. */
  demandValueIsk: number
  /**
   * Combined opportunity: iskPerHour × demandVolume (a scarce, high-ISK/h item
   * with real demand ranks above a fat-margin item nobody buys). Null when ISK/h
   * is unknown. Shown as two honest columns (ISK/h + demand), not this raw number.
   */
  opportunityScore: number | null

  reliable: boolean
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

export interface DeficitRowInput {
  productTypeId: number
  productName: string
  /** Defaults to manufacturing. */
  activity?: ProductionActivity
  stationId: string
  stationName: string
  sellVolume: number
  buyVolume: number
  itemPrice: number
  productionCost: number
  /**
   * Sales tax + broker fee, in percent, applied to itemPrice. Null/absent = the
   * user hasn't configured taxes: profit stays gross and the caller must label it.
   */
  revenueTaxPct?: number | null
  /** Per-unit job installation cost; null/absent = not included (see jobCostMissing). */
  jobCostPerUnit?: number | null
  /** Job cost was configured but couldn't be computed for this item. */
  jobCostMissing?: boolean
  /** Whole-job build time in seconds for one run (null when unknown). */
  buildTimeSeconds: number | null
  /** Units produced per run (to turn per-unit profit into per-job ISK/h). */
  outputPerRun: number
  /** Mean buy volume over snapshot history, or live buy volume when none. */
  demandVolume: number
  /** Snapshot days behind demandVolume (0 = live only). */
  demandDays: number
  /** Best buy price at the station, to value the demand (see MIN_DEMAND_ISK). */
  bestBuy: number
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

/**
 * Minimum ISK of buy-side demand for an item to be worth listing (Rodrigo,
 * 2026-10-26). Units alone mislead — 50 rounds of ammo and 50 ships are both
 * "50" — so demand is valued at the best buy price. Rows below it are hidden
 * from the scanner, and the response says how many, so nothing vanishes silently.
 */
export const MIN_DEMAND_ISK = 10_000_000

export function demandValueIsk(demandVolume: number, bestBuy: number): number {
  return Math.max(0, demandVolume) * Math.max(0, bestBuy)
}

/**
 * Finish and rank the deficit rows once production cost, build time, and demand
 * are known. Trustworthy rows come first, ranked by **opportunity score** =
 * net ISK/h × absorbable demand — the two axes of "what's worth building": how
 * fast it earns AND how much the market will actually take. This sinks both
 * tiny-margin/huge-build items (via ISK/h) and fat-margin items nobody buys (via
 * demand), which raw margin % rewarded. Rows we couldn't price/time/score fully
 * sink to the bottom rather than being dropped. buildVsBuy compares building vs
 * just buying the finished item at the station.
 */
export function rankDeficits(inputs: DeficitRowInput[]): DeficitRow[] {
  const rows: DeficitRow[] = inputs.map((i) => {
    const jobCostPerUnit = i.jobCostPerUnit ?? null
    const netItemPrice =
      i.revenueTaxPct != null ? i.itemPrice * (1 - i.revenueTaxPct / 100) : i.itemPrice
    const costBasis = i.productionCost + (jobCostPerUnit ?? 0)
    const unitProfit = netItemPrice - costBasis
    const margin = costBasis > 0 ? unitProfit / costBasis : 0
    const reliable = !i.anyNoPrice && i.productionCost > 0 && i.itemPrice > 0
    // Build vs buy the finished item here: what it costs to make (materials + job)
    // against what it costs to buy ready-made (gross price — buying pays no sales tax).
    let buildVsBuy: BuildVsBuy = 'neutral'
    if (i.productionCost > 0 && i.itemPrice > 0) {
      if (costBasis < i.itemPrice) buildVsBuy = 'make'
      else buildVsBuy = 'buy'
    }
    // Per-job net profit over the build hours. Null unless both time and a
    // reliable profit exist — never a fabricated 0/Infinity.
    const iskPerHour =
      reliable && i.buildTimeSeconds != null && i.buildTimeSeconds > 0
        ? (unitProfit * Math.max(1, i.outputPerRun)) / (i.buildTimeSeconds / 3600)
        : null
    // Combined opportunity. Demand weights ISK/h so a scarce, profitable item the
    // market actually buys beats a fat-margin one with near-zero demand. Both
    // inputs are shown as columns, so the ordering is always explicable.
    const opportunityScore = iskPerHour != null ? iskPerHour * Math.max(0, i.demandVolume) : null
    return {
      productTypeId: i.productTypeId,
      productName: i.productName,
      activity: i.activity ?? 'manufacturing',
      stationId: i.stationId,
      stationName: i.stationName,
      sellVolume: i.sellVolume,
      buyVolume: i.buyVolume,
      scarce: i.buyVolume > 0 && i.buyVolume > i.sellVolume,
      itemPrice: i.itemPrice,
      productionCost: i.productionCost,
      jobCostPerUnit,
      jobCostMissing: i.jobCostMissing ?? false,
      netItemPrice,
      unitProfit,
      margin,
      buildVsBuy,
      buildTimeSeconds: i.buildTimeSeconds,
      iskPerHour,
      demandVolume: i.demandVolume,
      demandDays: i.demandDays,
      demandValueIsk: demandValueIsk(i.demandVolume, i.bestBuy),
      opportunityScore,
      reliable,
      anyThin: i.anyThin,
      anyNoPrice: i.anyNoPrice,
      anyStale: i.anyStale,
    }
  })

  // Rank: rows with a real opportunity score first (desc); then reliable-but-
  // untimed rows by margin; then everything else. A row we couldn't fully
  // price/time/score never outranks one we could.
  return rows.sort((a, b) => {
    const aHas = a.opportunityScore != null
    const bHas = b.opportunityScore != null
    if (aHas && bHas) return b.opportunityScore! - a.opportunityScore!
    if (aHas !== bHas) return aHas ? -1 : 1
    if (a.reliable !== b.reliable) return a.reliable ? -1 : 1
    return b.margin - a.margin
  })
}
