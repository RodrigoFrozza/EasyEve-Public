import { iskPerHour as computeIskPerHour } from '@/lib/industry/build-time'
import { techTier, type TechTier } from '@/lib/industry/meta-group'

/**
 * The unified "what to produce" ranking engine, driven by the player's NPC trade
 * hubs. Supersedes the separate deficit scanner (Fase 2) and best-outputs
 * (Fase 3): one list of candidate manufacturable items, each priced against the
 * configured buy hub and valued/velocity-checked against the sell hub, ranked by
 * **opportunity = net ISK/h × real sales velocity (SVR)**.
 *
 * The SVR axis is the point of the whole feature: an item can be profitable and
 * even in short supply, but if it barely trades (`dailyVolume` tiny) it would sit
 * on the market — so velocity weights the score and a `wouldFlood` flag warns
 * when your own build rate would exceed what the market absorbs.
 *
 * Pure — prices/velocity come pre-resolved (from the RegionMarketDaily cache).
 */

export interface WhatToProduceInput {
  productTypeId: number
  productName: string
  metaGroupId: number | null
  /** True when the player owns a blueprint for this item (faction gate). */
  owned: boolean
  bestMe: number
  bestTe: number
  /** Per-unit material cost to build (ME-adjusted, priced at the buy hub). */
  materialCost: number
  /** Per-unit sell price at the sell hub. */
  sellPrice: number
  /** Units the market trades per day at the sell hub (velocity / SVR numerator). */
  dailyVolume: number
  /** Whole-job build time in seconds for one run (null when unknown). */
  buildTimeSeconds: number | null
  /** Units produced per run. */
  outputPerRun: number
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

export interface WhatToProduceRow {
  productTypeId: number
  productName: string
  tier: TechTier
  owned: boolean
  bestMe: number
  bestTe: number
  materialCost: number
  sellPrice: number
  unitProfit: number
  margin: number
  buildTimeSeconds: number | null
  iskPerHour: number | null
  dailyVolume: number
  /** Your build rate (units/day at 24h uptime) exceeds market velocity → oversupply risk. */
  wouldFlood: boolean
  opportunityScore: number | null
  reliable: boolean
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

function unitsPerDay(outputPerRun: number, buildTimeSeconds: number | null): number | null {
  if (buildTimeSeconds == null || !(buildTimeSeconds > 0)) return null
  const runsPerDay = 86400 / buildTimeSeconds
  return runsPerDay * Math.max(1, outputPerRun)
}

export function rankWhatToProduce(inputs: WhatToProduceInput[]): WhatToProduceRow[] {
  const rows: WhatToProduceRow[] = inputs.map((i) => {
    const unitProfit = i.sellPrice - i.materialCost
    const margin = i.materialCost > 0 ? unitProfit / i.materialCost : 0
    const reliable = !i.anyNoPrice && i.materialCost > 0 && i.sellPrice > 0
    const iskPerHour =
      reliable && i.buildTimeSeconds != null && i.buildTimeSeconds > 0
        ? computeIskPerHour(unitProfit * Math.max(1, i.outputPerRun), i.buildTimeSeconds)
        : null

    // Velocity weights ISK/h: a profitable item nobody buys sinks. Score is null
    // when ISK/h is unknown. Both ISK/h and daily volume are shown as columns, so
    // the ordering is always explicable.
    const opportunityScore = iskPerHour != null ? iskPerHour * Math.max(0, i.dailyVolume) : null

    // Oversupply warning: if you could build more per day than the market trades.
    const buildPerDay = unitsPerDay(i.outputPerRun, i.buildTimeSeconds)
    const wouldFlood = buildPerDay != null && i.dailyVolume > 0 && buildPerDay > i.dailyVolume

    return {
      productTypeId: i.productTypeId,
      productName: i.productName,
      tier: techTier(i.metaGroupId),
      owned: i.owned,
      bestMe: i.bestMe,
      bestTe: i.bestTe,
      materialCost: i.materialCost,
      sellPrice: i.sellPrice,
      unitProfit,
      margin,
      buildTimeSeconds: i.buildTimeSeconds,
      iskPerHour,
      dailyVolume: i.dailyVolume,
      wouldFlood,
      opportunityScore,
      reliable,
      anyThin: i.anyThin,
      anyNoPrice: i.anyNoPrice,
      anyStale: i.anyStale,
    }
  })

  return rows.sort((a, b) => {
    const aHas = a.opportunityScore != null
    const bHas = b.opportunityScore != null
    if (aHas && bHas) return b.opportunityScore! - a.opportunityScore!
    if (aHas !== bHas) return aHas ? -1 : 1
    if (a.reliable !== b.reliable) return a.reliable ? -1 : 1
    return b.margin - a.margin
  })
}
