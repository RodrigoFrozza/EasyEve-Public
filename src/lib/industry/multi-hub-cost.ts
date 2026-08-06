import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'
import { requiredMaterialQuantity, type ProductionMaterialInput } from './production-cost'

const STALE_THRESHOLD_MS = 20 * 60 * 1000

export interface HubDepthSet {
  hubId: string
  hubName: string
  /** This hub's depth keyed by typeId (sell side used to buy materials). */
  depth: Record<number, MarketDepth>
}

export interface MaterialHubQuote {
  hubId: string
  hubName: string
  /** Volume-weighted unit price to buy `toBuy` here (top-of-book if nothing to buy). */
  unitPrice: number
  cost: number
  sufficient: boolean
  noOrders: boolean
  stale: boolean
}

export interface MultiHubMaterialLine {
  typeId: number
  name: string
  requiredQuantity: number
  owned: number
  toBuy: number
  quotes: MaterialHubQuote[]
  /** Hub with the lowest cost that actually has orders (null if none do). */
  cheapestHubId: string | null
  /** Cost at the cheapest hub (0 when nothing to buy). */
  buyCost: number
}

export interface HubTotal {
  hubId: string
  hubName: string
  /** Total to buy every material here (missing items counted as 0). */
  total: number
  /** True when at least one material has no orders at this hub. */
  anyMissing: boolean
}

export interface MultiHubCostResult {
  materials: MultiHubMaterialLine[]
  /** Sum of the cheapest hub per material — the best-case buy-everywhere cost. */
  totalMaterialCost: number
  /** Per-hub cost of buying everything at one hub, for comparison. */
  hubTotals: HubTotal[]
  productTypeId: number
  productName: string
  outputQuantity: number
  revenueImmediate: number
  revenueListed: number
  outputNoOrders: boolean
  outputStale: boolean
  profit: number
  margin: number
  anyStale: boolean
  anyThin: boolean
  anyNoPrice: boolean
}

function isStale(depth: MarketDepth | undefined, now: number): boolean {
  return depth != null && depth.updatedAt > 0 && now - depth.updatedAt > STALE_THRESHOLD_MS
}

/**
 * Cost to build an item comparing several buy hubs for the inputs. Each material
 * is quoted at every configured hub (real order-book walk for the needed qty) and
 * the cheapest hub with stock wins; the totals also show what buying everything at
 * a single hub would cost. Output valued at the sell hub. Pure — the caller
 * pre-fetches each hub's depth. Thin books and missing prices are surfaced, never
 * hidden behind a cheaper false number (regra de ouro).
 */
export function computeMultiHubCost(params: {
  materials: ProductionMaterialInput[]
  runs: number
  me: number
  owned: Record<number, number>
  buyHubs: HubDepthSet[]
  output: { typeId: number; name: string; baseQuantity: number }
  sellDepth: MarketDepth | undefined
  now?: number
}): MultiHubCostResult {
  const now = params.now ?? Date.now()
  const runs = Math.max(1, Math.floor(params.runs))
  const hubs = params.buyHubs.length > 0 ? params.buyHubs : []

  const hubCostAcc = new Map<string, { total: number; anyMissing: boolean }>()
  for (const h of hubs) hubCostAcc.set(h.hubId, { total: 0, anyMissing: false })

  const materials: MultiHubMaterialLine[] = params.materials.map((m) => {
    const requiredQuantity = requiredMaterialQuantity(m.baseQuantity, runs, params.me)
    const owned = Math.max(0, Math.floor(params.owned[m.typeId] ?? 0))
    const toBuy = Math.max(0, requiredQuantity - owned)

    const quotes: MaterialHubQuote[] = hubs.map((h) => {
      const depth = h.depth[m.typeId]
      const sell = depth?.sell ?? []
      const fill = fillFromOrders(sell, toBuy)
      const cost = fill.avgUnitPrice * fill.filledQty
      const noOrders = toBuy > 0 && sell.length === 0
      const acc = hubCostAcc.get(h.hubId)!
      acc.total += cost
      if (noOrders) acc.anyMissing = true
      return {
        hubId: h.hubId,
        hubName: h.hubName,
        unitPrice: toBuy > 0 ? fill.avgUnitPrice : sell[0]?.price ?? 0,
        cost,
        sufficient: toBuy === 0 ? true : sell.length > 0 && fill.sufficient,
        noOrders,
        stale: isStale(depth, now),
      }
    })

    // Cheapest hub that has real orders for this item (cost > 0). If nothing to
    // buy, cost is 0 everywhere — pick the first hub arbitrarily.
    let cheapest: MaterialHubQuote | null = null
    if (toBuy === 0) {
      cheapest = quotes[0] ?? null
    } else {
      for (const q of quotes) {
        if (q.noOrders || q.cost <= 0) continue
        if (!cheapest || q.cost < cheapest.cost) cheapest = q
      }
    }

    return {
      typeId: m.typeId,
      name: m.name,
      requiredQuantity,
      owned,
      toBuy,
      quotes,
      cheapestHubId: cheapest?.hubId ?? null,
      buyCost: cheapest?.cost ?? 0,
    }
  })

  const totalMaterialCost = materials.reduce((s, m) => s + m.buyCost, 0)
  const hubTotals: HubTotal[] = hubs.map((h) => {
    const acc = hubCostAcc.get(h.hubId)!
    return { hubId: h.hubId, hubName: h.hubName, total: acc.total, anyMissing: acc.anyMissing }
  })

  const outputQuantity = params.output.baseQuantity * runs
  const outBuy = params.sellDepth?.buy ?? []
  const outSell = params.sellDepth?.sell ?? []
  const revenueImmediate = (outBuy[0]?.price ?? 0) * outputQuantity
  const revenueListed = (outSell[0]?.price ?? 0) * outputQuantity
  const profit = revenueListed - totalMaterialCost
  const margin = totalMaterialCost > 0 ? profit / totalMaterialCost : 0

  return {
    materials,
    totalMaterialCost,
    hubTotals,
    productTypeId: params.output.typeId,
    productName: params.output.name,
    outputQuantity,
    revenueImmediate,
    revenueListed,
    outputNoOrders: outBuy.length === 0 && outSell.length === 0,
    outputStale: isStale(params.sellDepth, now),
    profit,
    margin,
    anyStale: materials.some((m) => m.quotes.some((q) => q.stale)) || isStale(params.sellDepth, now),
    anyThin: materials.some((m) => {
      const c = m.quotes.find((q) => q.hubId === m.cheapestHubId)
      return c ? !c.sufficient : false
    }),
    anyNoPrice: materials.some((m) => m.cheapestHubId === null && m.toBuy > 0),
  }
}
