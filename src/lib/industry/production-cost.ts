import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'

/** Matches the depth caches' refresh TTL (region/structure). */
const STALE_THRESHOLD_MS = 20 * 60 * 1000

/** Round half-up to 2 decimals, the precision EVE's ME formula rounds at. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100
}

/**
 * Materials required for the whole job, per EVE's official ME formula:
 *   max(runs, ceil(round(runs × baseQuantity × (1 - ME/100), 2)))
 * A material needing 1 unit per run is never reduced below `runs` (the max()).
 * Structure/rig bonuses are NOT applied here (v1 prices a station job) — the UI
 * labels this so the number is honest about what it excludes (regra de ouro).
 * @see https://support.eveonline.com/hc/en-us/articles/203210542-Material-Efficiency-Research
 */
export function requiredMaterialQuantity(baseQuantity: number, runs: number, me: number): number {
  const clampedMe = Math.max(0, Math.min(10, me))
  const modifier = 1 - clampedMe / 100
  return Math.max(runs, Math.ceil(round2(runs * baseQuantity * modifier)))
}

export interface ProductionMaterialInput {
  typeId: number
  name: string
  /** Per-blueprint (ME 0) material quantity, straight from BlueprintMaterial. */
  baseQuantity: number
}

export interface ProductionMaterialLine {
  typeId: number
  name: string
  requiredQuantity: number
  owned: number
  toBuy: number
  /** Volume-weighted unit price to buy `toBuy` from sell orders (0 if nothing to buy). */
  unitBuyPrice: number
  buyCost: number
  /** Sell book couldn't cover `toBuy` — cost counts only what it could fill. */
  priceSufficient: boolean
  noOrders: boolean
  stale: boolean
}

export interface ProductionCostResult {
  materials: ProductionMaterialLine[]
  totalMaterialCost: number

  productTypeId: number
  productName: string
  outputQuantity: number
  /** Revenue selling the output into buy orders (immediate) and via sell orders (listed). */
  revenueImmediate: number
  revenueListed: number
  outputStale: boolean
  outputNoOrders: boolean

  /** profit/margin are against the "listed" (sell-order) revenue — the industry default. */
  profit: number
  /** profit ÷ total material cost, as a fraction (0.25 = +25%). 0 when cost is 0. */
  margin: number

  anyStale: boolean
  anyThin: boolean
  anyNoPrice: boolean
}

function isStale(depth: MarketDepth | undefined, now: number): boolean {
  return depth != null && depth.updatedAt > 0 && now - depth.updatedAt > STALE_THRESHOLD_MS
}

/**
 * Cost to build + resulting profit for a blueprint's manufacturing job. Pure —
 * the caller pre-fetches order-book depth. Materials are bought by walking the
 * real sell book for `toBuy` (thin books surface as !priceSufficient, never an
 * inflated cost). Output is valued two ways: immediate (into buy orders) and
 * listed (min sell). Excludes industry job cost/taxes and structure bonuses —
 * the UI must label those exclusions.
 */
export function computeProductionCost(params: {
  materials: ProductionMaterialInput[]
  runs: number
  me: number
  owned: Record<number, number>
  materialDepth: Record<number, MarketDepth>
  output: { typeId: number; name: string; baseQuantity: number }
  outputDepth: MarketDepth | undefined
  now?: number
}): ProductionCostResult {
  const now = params.now ?? Date.now()
  const runs = Math.max(1, Math.floor(params.runs))

  const materials: ProductionMaterialLine[] = params.materials.map((m) => {
    const requiredQuantity = requiredMaterialQuantity(m.baseQuantity, runs, params.me)
    const owned = Math.max(0, Math.floor(params.owned[m.typeId] ?? 0))
    const toBuy = Math.max(0, requiredQuantity - owned)

    const depth = params.materialDepth[m.typeId]
    const sell = depth?.sell ?? []
    const fill = fillFromOrders(sell, toBuy)
    const buyCost = fill.avgUnitPrice * fill.filledQty
    const unitBuyPrice = toBuy > 0 ? fill.avgUnitPrice : sell[0]?.price ?? 0

    return {
      typeId: m.typeId,
      name: m.name,
      requiredQuantity,
      owned,
      toBuy,
      unitBuyPrice,
      buyCost,
      // Nothing to buy → trivially sufficient. Otherwise the sell book must cover it.
      priceSufficient: toBuy === 0 ? true : sell.length > 0 && fill.sufficient,
      noOrders: toBuy > 0 && sell.length === 0,
      stale: isStale(depth, now),
    }
  })

  const totalMaterialCost = materials.reduce((s, m) => s + m.buyCost, 0)

  const outputQuantity = params.output.baseQuantity * runs
  const outBuy = params.outputDepth?.buy ?? []
  const outSell = params.outputDepth?.sell ?? []
  const bestBid = outBuy[0]?.price ?? 0
  const bestAsk = outSell[0]?.price ?? 0
  const revenueImmediate = bestBid * outputQuantity
  const revenueListed = bestAsk * outputQuantity

  const profit = revenueListed - totalMaterialCost
  const margin = totalMaterialCost > 0 ? profit / totalMaterialCost : 0

  return {
    materials,
    totalMaterialCost,
    productTypeId: params.output.typeId,
    productName: params.output.name,
    outputQuantity,
    revenueImmediate,
    revenueListed,
    outputStale: isStale(params.outputDepth, now),
    outputNoOrders: outBuy.length === 0 && outSell.length === 0,
    profit,
    margin,
    anyStale: materials.some((m) => m.stale) || isStale(params.outputDepth, now),
    anyThin: materials.some((m) => !m.priceSufficient),
    anyNoPrice: materials.some((m) => m.noOrders),
  }
}
