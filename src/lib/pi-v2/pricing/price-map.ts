/**
 * Preço por order book real — o diferencial do EasyEve.
 *
 * Duas regras que este arquivo existe para cumprir, ambas aprendidas errando:
 *
 *  1. **Primeira linha não é preço.** O book é ANDADO com a quantidade real que
 *     se vai comprar (`fillFromOrders`). Quatro compras reais validaram o modelo
 *     com desvio máximo de +0,8% em cargas de 4-6 bilhões.
 *  2. **Preço é por ESTAÇÃO, não por região.** Consultar a região inteira
 *     subestimou P4 em até 9,3%.
 *
 * E a lição que virou este porte: **escolher hub por disponibilidade é escolher
 * errado.** O v1 encadeava `structure → region → jita` com `if/else if` por
 * PRESENÇA de ordem, então a estrutura configurada vencia sempre — precificando
 * todo o insumo no hub mais caro (Construction Blocks 66% acima de Jita). Aqui a
 * escolha é sempre pelo **custo efetivo mais barato entre os hubs que cobrem a
 * quantidade**. No v1 isso vive atrás da flag `PI_HUB_SOURCING` porque mudaria o
 * NET de todo mundo em produção; o v2 inteiro já está atrás de `PI_V2`, então o
 * ramo legado não foi portado.
 *
 * A escolha de hub e o frete vivem em `hub-quotes.ts`, compartilhados com a lista
 * de compra: se o P&L escolhesse um hub e a lista outro, a tela mandaria comprar
 * num lugar e contabilizaria noutro.
 *
 * ⚠️ **Server-only.** `market-prices` importa `prisma`, então nada deste arquivo
 * (nem de `pricing/`) pode ser importado como VALOR por componente de cliente —
 * só como tipo. É por isso que o order book não passa por `sde.ts`, que precisa
 * continuar client-safe para o motor de projeção rodar no navegador.
 */

import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'
import { getCommodityVolume } from '@/lib/pi-v2/sde'
import { chooseHub, quoteHubs, type PriceOrigin } from '@/lib/pi-v2/pricing/hub-quotes'

export type { PriceOrigin }

/** Uma estação cadastrada, com o book por tipo e o frete até a base. */
export interface StationSource {
  id: string
  label: string
  depth: Record<number, MarketDepth>
  freightPerM3: number
}

export interface PriceProvenance {
  buy: PriceOrigin
  sell: PriceOrigin
}

export interface MarketPrice {
  buy: number
  sell: number
  /**
   * Preços de execução instantânea para a quantidade real do portfólio:
   * `weightedAsk` = médio para COMPRAR a demanda andando as ordens de venda;
   * `weightedBid` = médio para VENDER a oferta nas ordens de compra.
   */
  weightedAsk: number
  weightedBid: number
  /** false quando nenhum hub cobria 100% da quantidade — a UI precisa sinalizar. */
  buyCoversDemand: boolean
}

export type PriceMap = Record<number, MarketPrice>

/** Onde o produto acabado é valorado. */
export type SellSource = 'home_region' | 'jita_sell' | 'jita_buy' | 'jita_split' | 'structure'

export type PricingMode = 'import_buy_export_sell' | 'mid_price' | 'pessimistic' | 'realistic'

export const DEFAULT_PRICING_MODE: PricingMode = 'import_buy_export_sell'

export interface PriceSources {
  /** Book da região de casa (pode ser o próprio Jita se nenhuma foi configurada). */
  regionDepth: Record<number, MarketDepth>
  regionFreightPerM3?: number
  /** Buy/sell escalar de Jita (topo de book), para fallback e modos jita_*. */
  jita: Record<number, { buy: number; sell: number }>
  jitaFreightPerM3?: number
  /**
   * Estações cadastradas pelo jogador. **Todas concorrem** — não existe mais
   * "estrutura principal" e "secundária só para comparação".
   */
  stations?: StationSource[]
  /** Estrutura privada de venda (usada quando sellSource='structure'). */
  sellStructureDepth?: Record<number, MarketDepth> | null
  sellSource: SellSource
  /** Preço de referência manual — último fallback, nunca um chute do sistema. */
  referencePrices?: Record<number, number>
}

function bestBid(depth: MarketDepth | undefined): number {
  return depth?.buy[0]?.price ?? 0
}
function bestAsk(depth: MarketDepth | undefined): number {
  return depth?.sell[0]?.price ?? 0
}

/**
 * Monta o mapa de preços compondo uma fonte de COMPRA (insumos) e uma de VENDA
 * (produto), cada uma com fallback próprio, mais a proveniência por tipo para a
 * UI poder dizer de onde cada número veio.
 */
export function composePriceMap(
  typeIds: number[],
  sources: PriceSources,
  importDemandByType: Map<number, number>,
  exportSupplyByType: Map<number, number>
): { priceMap: PriceMap; provenance: Record<number, PriceProvenance> } {
  const priceMap: PriceMap = {}
  const provenance: Record<number, PriceProvenance> = {}
  const {
    regionDepth,
    regionFreightPerM3,
    jita,
    jitaFreightPerM3,
    stations = [],
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

    // ---- COMPRA: o hub mais barato por CUSTO EFETIVO (preço andado + frete) ----
    // Mesma função que a lista de compra usa. Se o P&L escolhesse um hub e a
    // lista outro, a tela mandaria comprar num lugar e contabilizaria noutro.
    const quotes = quoteHubs(
      {
        stations: stations.map((s) => ({
          id: s.id,
          label: s.label,
          book: s.depth[id],
          freightPerM3: s.freightPerM3,
        })),
        region,
        regionFreightPerM3,
        jita: j,
        jitaFreightPerM3,
      },
      demand,
      getCommodityVolume(id)
    )
    const chosenBuy = chooseHub(quotes, ref)

    let buyOrigin: PriceOrigin = 'none'
    let buy = 0
    let weightedAsk = 0
    let buyCoversDemand = true

    if (chosenBuy) {
      buyOrigin = chosenBuy.origin
      // O custo do insumo é o EFETIVO: o frete é dinheiro gasto para o material
      // chegar no planeta, então pertence ao custo, não a um rodapé.
      weightedAsk = chosenBuy.effectiveUnitPrice
      // import_buy_export_sell precifica na melhor ordem de compra; cai para o
      // efetivo quando ninguém está comprando no hub escolhido.
      buy = chosenBuy.topBid > 0 ? chosenBuy.topBid + chosenBuy.freightPerUnit : chosenBuy.effectiveUnitPrice
      buyCoversDemand = chosenBuy.coversDemand
    }

    // ---- VENDA: depende do sellSource configurado ----
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

    // Venda instantânea anda as ordens de compra do mercado escolhido.
    const walkedBid =
      supply > 0 && sellDepthForWalk ? fillFromOrders(sellDepthForWalk.buy, supply).avgUnitPrice : 0
    const weightedBid = walkedBid || bestBid(sellDepthForWalk) || j?.buy || sell

    priceMap[id] = { buy, sell, weightedAsk, weightedBid, buyCoversDemand }
    provenance[id] = { buy: buyOrigin, sell: sellOrigin }
  }

  return { priceMap, provenance }
}

/** Preço unitário de COMPRA de um insumo no modo escolhido. */
export function importUnitPrice(
  prices: PriceMap,
  typeId: number,
  mode: PricingMode = DEFAULT_PRICING_MODE
): number {
  const price = prices[typeId]
  if (!price) return 0
  switch (mode) {
    case 'import_buy_export_sell':
      return price.buy
    case 'mid_price':
      return (price.buy + price.sell) / 2
    case 'pessimistic':
    case 'realistic':
      // Custo real de um multibuy: andar o book de venda. Idêntico ao pessimista
      // do lado da compra.
      return price.weightedAsk || price.sell
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

/** Preço unitário de VENDA do produto no modo escolhido. */
export function exportUnitPrice(
  prices: PriceMap,
  typeId: number,
  mode: PricingMode = DEFAULT_PRICING_MODE
): number {
  const price = prices[typeId]
  if (!price) return 0
  switch (mode) {
    case 'import_buy_export_sell':
      return price.sell
    case 'mid_price':
      return (price.buy + price.sell) / 2
    case 'pessimistic':
      // Despejo instantâneo nas ordens de compra.
      return price.weightedBid || price.buy
    case 'realistic':
      // Respeita a fonte de venda configurada (composePriceMap já resolveu `sell`
      // conforme o sellSource, inclusive jita_split).
      return price.sell
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
