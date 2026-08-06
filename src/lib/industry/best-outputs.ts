import { iskPerHour as computeIskPerHour } from '@/lib/industry/build-time'

/**
 * Rank the items a user can build from their OWNED blueprints by opportunity =
 * net ISK/h × sell-hub demand. Same two-axis idea as the deficit scanner
 * (deficit-scan.ts), but the candidate set is "blueprints you own" (not market
 * deficits) and the output is valued at your configured sell hub. v1 costs
 * materials only — job cost, taxes and skills live in the per-item calculator
 * (opened from the row); the labels say so.
 */

export interface BestOutputRowInput {
  productTypeId: number
  productName: string
  bestMe: number
  bestTe: number
  /** Per-unit material cost to build (already ME-adjusted at the buy hub). */
  materialCost: number
  /** Per-unit sell price at the sell hub (best sell, or best buy when unlisted). */
  sellPrice: number
  /** Whole-job build time in seconds for one run (null when unknown). */
  buildTimeSeconds: number | null
  /** Units produced per run. */
  outputPerRun: number
  /** Absorbable demand: total buy-order volume for this item at the sell hub. */
  sellDemand: number
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

export interface BestOutputRow {
  productTypeId: number
  productName: string
  bestMe: number
  bestTe: number
  materialCost: number
  sellPrice: number
  unitProfit: number
  margin: number
  buildTimeSeconds: number | null
  iskPerHour: number | null
  sellDemand: number
  opportunityScore: number | null
  reliable: boolean
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

export function rankBestOutputs(inputs: BestOutputRowInput[]): BestOutputRow[] {
  const rows: BestOutputRow[] = inputs.map((i) => {
    const unitProfit = i.sellPrice - i.materialCost
    const margin = i.materialCost > 0 ? unitProfit / i.materialCost : 0
    const reliable = !i.anyNoPrice && i.materialCost > 0 && i.sellPrice > 0
    const iskPerHour =
      reliable && i.buildTimeSeconds != null && i.buildTimeSeconds > 0
        ? computeIskPerHour(unitProfit * Math.max(1, i.outputPerRun), i.buildTimeSeconds)
        : null
    const opportunityScore = iskPerHour != null ? iskPerHour * Math.max(0, i.sellDemand) : null
    return {
      productTypeId: i.productTypeId,
      productName: i.productName,
      bestMe: i.bestMe,
      bestTe: i.bestTe,
      materialCost: i.materialCost,
      sellPrice: i.sellPrice,
      unitProfit,
      margin,
      buildTimeSeconds: i.buildTimeSeconds,
      iskPerHour,
      sellDemand: i.sellDemand,
      opportunityScore,
      reliable,
      anyThin: i.anyThin,
      anyNoPrice: i.anyNoPrice,
      anyStale: i.anyStale,
    }
  })

  // Scored rows first (desc); then reliable-but-unscored by margin; then the rest.
  return rows.sort((a, b) => {
    const aHas = a.opportunityScore != null
    const bHas = b.opportunityScore != null
    if (aHas && bHas) return b.opportunityScore! - a.opportunityScore!
    if (aHas !== bHas) return aHas ? -1 : 1
    if (a.reliable !== b.reliable) return a.reliable ? -1 : 1
    return b.margin - a.margin
  })
}
