/**
 * Cotação por hub — a decisão de ONDE comprar.
 *
 * Três regras, todas aprendidas errando:
 *
 *  1. **Primeira linha não é preço.** O book é andado com a quantidade real que
 *     se vai comprar. Validado em quatro compras de bilhões com desvio máximo de
 *     +0,8%.
 *  2. **Preço é por estação, não por região.** Consultar a região inteira
 *     subestimou P4 em até 9,3%.
 *  3. **Escolher hub por disponibilidade é escolher errado** — e escolher pelo
 *     preço da mercadoria também. O que decide é o **custo efetivo**:
 *     `preço andado + frete × m³ por unidade`.
 *
 * O caso que prova a regra 3 (medido pelo Rodrigo em 21/07, Water):
 *
 * | hub | preço andado | frete (ISK/m³ × 0,19 m³) | efetivo |
 * |---|---|---|---|
 * | UALX-3 | 487,41 | 0 | **487,41** |
 * | Jita   | 468,00 | 800 × 0,19 = 152 | 620,00 |
 *
 * A mercadoria é mais barata em Jita. Comprar lá custaria **27,7M a mais** nas
 * 208.850 unidades da rodada. Um motor que compara só preço escolhe errado com
 * confiança — por isso o frete entra no critério, não num rodapé.
 *
 * **Qualquer número de estações concorre.** Não há hub "principal" nem
 * "secundário só para comparação": toda estação que o jogador cadastrou (e onde
 * ele pode atracar) é fonte real de compra, com o frete dela. Region e Jita são
 * as duas fontes públicas, com frete próprio.
 *
 * Este módulo é a ÚNICA fonte de "qual hub e a que preço": o P&L e a lista de
 * compra consomem os dois a mesma função. Se divergissem, a tela mandaria
 * comprar num hub e contabilizaria noutro.
 */

import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'

/** De onde veio o preço. A UI mostra isto; número sem origem mente. */
export type PriceOrigin = 'structure' | 'region' | 'jita' | 'reference' | 'none'

/** Uma estação cadastrada pelo jogador, com o book e o frete dela. */
export interface StationBook {
  /** structureId da ESI — docking já verificado na busca. */
  id: string
  /** Nome real retornado pela ESI. É o rótulo que a tela mostra. */
  label: string
  book?: MarketDepth | null
  /** ISK por m³ para trazer daqui até a base. 0 = já estou nesta estação. */
  freightPerM3: number
}

export interface HubBooks {
  /** Estações cadastradas. Todas concorrem; nenhuma é "só comparação". */
  stations?: StationBook[]
  /** Book da região de casa. */
  region?: MarketDepth | null
  regionFreightPerM3?: number
  /** Jita escalar (topo de book) quando não há profundidade. */
  jita?: { buy: number; sell: number }
  jitaFreightPerM3?: number
  /** Preço de referência manual — último recurso, nunca um chute do sistema. */
  reference?: number
}

export interface HubQuote {
  origin: PriceOrigin
  /** structureId, quando o hub é uma estação cadastrada. */
  stationId?: string
  /** Rótulo da origem para a UI (nome real da estação, quando houver). */
  label?: string
  /** Preço unitário ANDANDO o book para a quantidade pedida. */
  unitPrice: number
  /** Frete por unidade: ISK/m³ × m³ por unidade. 0 quando não configurado. */
  freightPerUnit: number
  /** `unitPrice + freightPerUnit`. É por este número que se escolhe. */
  effectiveUnitPrice: number
  /** Melhor ordem de COMPRA do hub (para o modo import_buy_export_sell). */
  topBid: number
  /** O book deste hub cobre 100% da quantidade pedida? */
  coversDemand: boolean
  /** Quanto o book realmente cobre. Menor que a demanda quando `coversDemand` é false. */
  filledQty: number
}

function bestBid(depth: MarketDepth | null | undefined): number {
  return depth?.buy[0]?.price ?? 0
}

function quoteFromDepth(input: {
  origin: PriceOrigin
  depth: MarketDepth | null | undefined
  demand: number
  freightPerUnit: number
  label?: string
  stationId?: string
}): HubQuote | null {
  const { origin, depth, demand, freightPerUnit, label, stationId } = input
  if (!depth) return null
  const fill = fillFromOrders(depth.sell, demand)
  const unitPrice = fill.avgUnitPrice || fill.bestUnitPrice
  if (unitPrice <= 0) return null // sem book de venda neste hub
  return {
    origin,
    stationId,
    label,
    unitPrice,
    freightPerUnit,
    effectiveUnitPrice: unitPrice + freightPerUnit,
    topBid: bestBid(depth),
    coversDemand: fill.sufficient,
    filledQty: fill.filledQty,
  }
}

/**
 * Cota todos os hubs que têm book para o item, já com o frete embutido.
 *
 * `volumePerUnit` vem do SDE (m³ do tipo) — nunca hardcode por tier: dentro de um
 * mesmo tier os volumes variam, e arredondar por tier erraria o frete.
 */
export function quoteHubs(
  books: HubBooks,
  demand: number,
  volumePerUnit: number
): HubQuote[] {
  const freightFor = (ratePerM3: number | undefined) => (ratePerM3 ?? 0) * volumePerUnit
  const quotes: HubQuote[] = []

  for (const station of books.stations ?? []) {
    const quote = quoteFromDepth({
      origin: 'structure',
      depth: station.book,
      demand,
      freightPerUnit: freightFor(station.freightPerM3),
      label: station.label,
      stationId: station.id,
    })
    if (quote) quotes.push(quote)
  }

  const region = quoteFromDepth({
    origin: 'region',
    depth: books.region,
    demand,
    freightPerUnit: freightFor(books.regionFreightPerM3),
  })
  if (region) quotes.push(region)

  // Jita entra como escalar de topo de book (não temos profundidade dela aqui);
  // assumimos que cobre a quantidade — é o book mais fundo do jogo. A premissa
  // está marcada em `coversDemand` para a UI poder qualificá-la.
  if (books.jita?.sell && books.jita.sell > 0) {
    const freightPerUnit = freightFor(books.jitaFreightPerM3)
    quotes.push({
      origin: 'jita',
      unitPrice: books.jita.sell,
      freightPerUnit,
      effectiveUnitPrice: books.jita.sell + freightPerUnit,
      topBid: books.jita.buy ?? 0,
      coversDemand: true,
      filledQty: demand,
    })
  }

  return quotes
}

/**
 * O hub escolhido: o mais barato **por custo efetivo** entre os que cobrem a
 * quantidade inteira. Hubs que não cobrem ficam para depois — esta entrega
 * precifica a demanda toda num único hub (fracionar entre hubs é fase futura).
 * Quando só sobra hub insuficiente, ele é escolhido com `coversDemand: false`
 * para a UI avisar em vez de mentir.
 */
export function chooseHub(quotes: HubQuote[], reference?: number): HubQuote | null {
  const cheapest = (list: HubQuote[]): HubQuote | null =>
    list.reduce<HubQuote | null>(
      (best, q) => (best == null || q.effectiveUnitPrice < best.effectiveUnitPrice ? q : best),
      null
    )

  const chosen = cheapest(quotes.filter((q) => q.coversDemand)) ?? cheapest(quotes)
  if (chosen) return chosen

  // Sem book em lugar nenhum: cai no preço de referência manual, se o usuário
  // cadastrou um. Nunca inventamos um número.
  if (reference != null && reference > 0) {
    return {
      origin: 'reference',
      unitPrice: reference,
      freightPerUnit: 0,
      effectiveUnitPrice: reference,
      topBid: 0,
      coversDemand: false,
      filledQty: 0,
    }
  }
  return null
}
