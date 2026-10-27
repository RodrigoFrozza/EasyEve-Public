import type { MarketDepth } from '@/lib/market-prices'
import { fillFromOrders } from '@/lib/market-prices'
import type { PiPriceMap } from '@/lib/pi/pi-pricing'
import type { PiSellSource } from '@/lib/pi/pi-config-store'
import type { PriceOrigin } from '@/lib/pi/demand-model'

export type { PriceOrigin }

export interface PriceProvenance {
  buy: PriceOrigin
  sell: PriceOrigin
}

export interface PriceSources {
  /** Home-region order-book depth (may itself be Jita when no region is set). */
  regionDepth: Record<number, MarketDepth>
  /** Scalar Jita buy/sell per type (top-of-book), for fallback and Jita sell modes. */
  jita: Record<number, { buy: number; sell: number }>
  /** Optional private structure depth to buy inputs from. */
  buyStructureDepth?: Record<number, MarketDepth> | null
  /** Optional SECOND private structure depth — now a real buy candidate (used to
   * be display-only in the Shopping List). */
  secondaryStructureDepth?: Record<number, MarketDepth> | null
  /** Optional private structure depth to sell outputs into (sellSource='structure'). */
  sellStructureDepth?: Record<number, MarketDepth> | null
  sellSource: PiSellSource
  /** Manual reference price per type, used only as a final fallback. */
  referencePrices?: Record<number, number>
}

/** One hub competing to source an imported input, with its walked buy cost. */
interface BuyCandidate {
  origin: PriceOrigin
  /** Average unit price to buy the demand here (walks the ask book). */
  cost: number
  /** Best buy-order price at this hub (used by import_buy_export_sell mode). */
  topBid: number
  /** Full depth to walk; absent for Jita (scalar top-of-book only). */
  depth?: MarketDepth
  /** Whether this hub's ask book covers 100% of the demand. */
  sufficient: boolean
}

function bestBid(depth: MarketDepth | undefined): number {
  return depth?.buy[0]?.price ?? 0
}
function bestAsk(depth: MarketDepth | undefined): number {
  return depth?.sell[0]?.price ?? 0
}

/**
 * Build the PiPriceMap composing an independent BUY source (inputs) and SELL
 * source (outputs), each with a graceful fallback chain, plus per-type provenance
 * so the UI can show whether a number is live/reference and from which market.
 *
 * Default config (sellSource='home_region', no structures) reproduces the
 * region→Jita behavior exactly, so existing users are unaffected.
 *
 * `hubSourcingEnabled` (flag PI_HUB_SOURCING, default OFF) gates the BUY side:
 *  - OFF → comportamento pré-c503a29d: primeiro hub COM BOOK, por disponibilidade
 *    (structure → region → Jita → reference). Ignora a estrutura secundária.
 *  - ON  → escolhe o hub mais BARATO que cobre a demanda (c503a29d).
 * Default false: um caller que esquecer cai no comportamento antigo (seguro).
 */
export function composePriceMap(
  typeIds: number[],
  sources: PriceSources,
  importDemandByType: Map<number, number>,
  exportSupplyByType: Map<number, number>,
  hubSourcingEnabled = false
): { priceMap: PiPriceMap; provenance: Record<number, PriceProvenance> } {
  const priceMap: PiPriceMap = {}
  const provenance: Record<number, PriceProvenance> = {}
  const {
    regionDepth,
    jita,
    buyStructureDepth,
    secondaryStructureDepth,
    sellStructureDepth,
    sellSource,
    referencePrices,
  } = sources

  for (const id of new Set(typeIds)) {
    const region = regionDepth[id]
    const j = jita[id]
    const ref = referencePrices?.[id]
    const demand = importDemandByType.get(id) ?? 0
    const supply = exportSupplyByType.get(id) ?? 0

    // ---- BUY side (importing inputs). Gated by the PI_HUB_SOURCING flag. ----
    const buyStruct = buyStructureDepth?.[id]
    const secondaryStruct = secondaryStructureDepth?.[id]

    let buyOrigin: PriceOrigin = 'none'
    let buy = 0
    let weightedAsk = 0

    if (hubSourcingEnabled) {
      // Flag ON (c503a29d): pick the CHEAPEST hub that can source the demand, not
      // merely the first one that has any order. Each candidate walks its own ask
      // book for the demand; the lowest instant cost wins. Hubs that cannot cover
      // 100% of the demand are set aside first — this delivery prices the whole
      // demand at a single hub (no cross-hub fractioning yet; the UI flags this).
      // Fallback: any hub with a book, then the manual reference price, then nothing.
      const depthCandidate = (
        origin: PriceOrigin,
        depthForId: MarketDepth | undefined
      ): BuyCandidate | null => {
        if (!depthForId) return null
        const fill = fillFromOrders(depthForId.sell, demand)
        const cost = fill.avgUnitPrice || fill.bestUnitPrice
        if (cost <= 0) return null // no ask book at this hub
        return {
          origin,
          cost,
          topBid: bestBid(depthForId),
          depth: depthForId,
          sufficient: fill.sufficient,
        }
      }

      const buyCandidates: BuyCandidate[] = []
      for (const candidate of [
        depthCandidate('structure', buyStruct),
        depthCandidate('structure', secondaryStruct),
        depthCandidate('region', region),
      ]) {
        if (candidate) buyCandidates.push(candidate)
      }
      // Jita is scalar top-of-book only (no depth to walk) — assume it is deep enough.
      if (j?.sell && j.sell > 0) {
        buyCandidates.push({ origin: 'jita', cost: j.sell, topBid: j.buy ?? 0, sufficient: true })
      }

      const cheapest = (list: BuyCandidate[]): BuyCandidate | null =>
        list.reduce<BuyCandidate | null>(
          (best, c) => (best == null || c.cost < best.cost ? c : best),
          null
        )
      const sufficientCandidates = buyCandidates.filter((c) => c.sufficient)
      const chosenBuy = cheapest(sufficientCandidates) ?? cheapest(buyCandidates)

      if (chosenBuy) {
        buyOrigin = chosenBuy.origin
        weightedAsk = chosenBuy.cost
        // import_buy_export_sell prices at the best buy order; fall back to the ask
        // when nobody is bidding at the chosen hub.
        buy = chosenBuy.topBid > 0 ? chosenBuy.topBid : chosenBuy.cost
      } else if (ref != null && ref > 0) {
        buy = ref
        weightedAsk = ref
        buyOrigin = 'reference'
      }
    } else {
      // Flag OFF (padrão): comportamento pré-c503a29d — primeiro hub COM BOOK, por
      // disponibilidade (structure → region → Jita → reference). NÃO considera a
      // estrutura secundária (era display-only). Reproduzido byte a byte.
      let buyDepthForWalk: MarketDepth | undefined
      if (bestBid(buyStruct) > 0) {
        buy = bestBid(buyStruct)
        buyDepthForWalk = buyStruct
        buyOrigin = 'structure'
      } else if (bestBid(region) > 0) {
        buy = bestBid(region)
        buyDepthForWalk = region
        buyOrigin = 'region'
      } else if (j?.buy) {
        buy = j.buy
        buyOrigin = 'jita'
      } else if (ref != null && ref > 0) {
        buy = ref
        buyOrigin = 'reference'
      }
      // Instant-execution buy walks the chosen buy market's sell orders (asks).
      const walkedAsk =
        demand > 0 && buyDepthForWalk
          ? fillFromOrders(buyDepthForWalk.sell, demand).avgUnitPrice
          : 0
      weightedAsk = walkedAsk || bestAsk(buyDepthForWalk) || j?.sell || buy
    }

    // ---- SELL side (exporting output): depends on sellSource ----
    let sell = 0
    let sellOrigin: PriceOrigin = 'none'
    let sellDepthForWalk: MarketDepth | undefined

    const applyRegionSell = () => {
      if (bestAsk(region) > 0) {
        sell = bestAsk(region)
        sellDepthForWalk = region
        sellOrigin = 'region'
      } else if (j?.sell) {
        sell = j.sell
        sellOrigin = 'jita'
      } else if (ref != null && ref > 0) {
        sell = ref
        sellOrigin = 'reference'
      }
    }

    switch (sellSource) {
      case 'structure': {
        const s = sellStructureDepth?.[id]
        if (bestAsk(s) > 0) {
          sell = bestAsk(s)
          sellDepthForWalk = s
          sellOrigin = 'structure'
        } else {
          applyRegionSell()
        }
        break
      }
      case 'jita_sell':
        sell = j?.sell || bestAsk(region) || (ref ?? 0)
        sellOrigin = j?.sell ? 'jita' : bestAsk(region) > 0 ? 'region' : ref ? 'reference' : 'none'
        break
      case 'jita_buy':
        sell = j?.buy || bestBid(region) || (ref ?? 0)
        sellOrigin = j?.buy ? 'jita' : bestBid(region) > 0 ? 'region' : ref ? 'reference' : 'none'
        break
      case 'jita_split': {
        const jb = j?.buy || bestBid(region)
        const js = j?.sell || bestAsk(region)
        sell = jb && js ? (jb + js) / 2 : jb || js || (ref ?? 0)
        sellOrigin = jb || js ? 'jita' : ref ? 'reference' : 'none'
        break
      }
      case 'home_region':
      default:
        applyRegionSell()
        break
    }

    // Instant-execution sell walks the chosen sell market's buy orders (bids).
    const walkedBid =
      supply > 0 && sellDepthForWalk
        ? fillFromOrders(sellDepthForWalk.buy, supply).avgUnitPrice
        : 0
    const weightedBid = walkedBid || bestBid(sellDepthForWalk) || j?.buy || sell

    priceMap[id] = { buy, sell, weightedAsk, weightedBid }
    provenance[id] = { buy: buyOrigin, sell: sellOrigin }
  }

  return { priceMap, provenance }
}
