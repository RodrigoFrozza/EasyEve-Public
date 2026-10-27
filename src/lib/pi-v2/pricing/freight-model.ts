/**
 * O modelo de frete do jogador: **uma base central e N hubs**, cada hub com duas
 * direções independentes.
 *
 * As etapas anteriores puseram o formulário de contrato só nas estruturas e
 * deixaram Região/Jita como caixinha de número. Isso não é como se movimenta
 * carga: o jogador tem UMA base onde junta o PI, compra em vários hubs, e cada
 * hub é alcançado por um método que ele escolhe. O modelo tem que ser uniforme —
 * uma estrutura e Jita são a mesma coisa aqui: uma origem com um custo de trazer.
 *
 * | direção | trajeto | alimenta |
 * |---|---|---|
 * | **entrada** (`inbound`)  | hub → base | lista de compra |
 * | **saída** (`outbound`)   | base → hub | P&L / venda |
 *
 * A saída existe no modelo desde já, mas **não tem UI nesta etapa**: ela entra
 * junto do P&L. O tipo nasce completo para a migração não ter que rodar duas
 * vezes.
 *
 * A regra que atravessa tudo, herdada da Parte A e mantida:
 *
 *  - **escolha de hub por item** → taxa MARGINAL (ISK/m³)
 *  - **total do hub**           → custo completo do envio (teto, piso, viagens)
 *
 * Se o teto do full load ou o custo fixo de uma viagem de JF entrassem na escolha
 * por item, um item mudaria de origem conforme o resto da lista crescesse.
 *
 * Puro e sem dependências de servidor: o formulário importa daqui no navegador.
 */

import {
  contractReward,
  marginalRatePerM3,
  type ContractFreight,
  type RewardBinding,
} from '@/lib/pi-v2/pricing/freight'
import { getJumpFreighter } from '@/lib/pi-v2/jf-data'

/**
 * Ids reservados dos dois hubs públicos. Não são estruturas (não têm
 * `structureId`), mas no modelo são hubs iguais aos outros: têm método e custo.
 */
export const REGION_HUB_ID = 'region'
export const JITA_HUB_ID = 'jita'

export function isPublicHubId(id: string): boolean {
  return id === REGION_HUB_ID || id === JITA_HUB_ID
}

/**
 * A chave do hub de uma cotação — o que liga um preço à perna que o traz.
 *
 * Estrutura é identificada pelo `structureId`; as fontes públicas, pelos ids
 * reservados. Uma função única porque a lista de compra e a UI precisam chegar na
 * MESMA chave: se divergissem, a tela mostraria o frete de um hub no total de
 * outro.
 */
export function hubKeyFor(origin: string, stationId?: string): string {
  if (stationId) return stationId
  if (origin === 'region') return REGION_HUB_ID
  if (origin === 'jita') return JITA_HUB_ID
  return origin
}

export type FreightMethod = 'local' | 'courier' | 'jf'

/** A própria base: nada a mover, custo 0 de verdade (não é 0 por falta de dado). */
export interface LocalLeg {
  method: 'local'
}

/** Contrato de courier. Os campos são os da tabela da transportadora. */
export interface CourierLeg extends ContractFreight {
  method: 'courier'
}

/**
 * JF do próprio jogador.
 *
 * O app **não faz jump planning**: a quantidade de isótopos ida-e-volta é a que o
 * DOTLAN calculou para a rota e as skills dele. O que o app faz é o que ele não
 * tem como fazer à mão sem erro: andar o book do isótopo, dizer onde abastecer
 * mais barato, e transformar isso em ISK/m³ comparável com o courier.
 */
export interface JfLeg {
  method: 'jf'
  /** Casco escolhido. Isótopo e cargo base vêm do SDE por este id. */
  jfTypeId: number
  /** Isótopos da viagem completa (ida e volta), do DOTLAN. */
  isotopeQtyRoundTrip: number
  /** Carga real em m³. Default = cargo do casco; menor se ele não enche. */
  cargoM3: number
  /** Onde ele abastece. Ausente = seguir a recomendação (o mais barato). */
  refuelAt?: 'origin' | 'destination'
}

export type FreightLeg = LocalLeg | CourierLeg | JfLeg

/**
 * Um hub. `id` é o `structureId` da ESI, ou um dos ids públicos reservados.
 *
 * `inbound` ausente = **frete não configurado**: entra como 0 e a tela avisa.
 * Nunca é "de graça" em silêncio — é o mesmo default das etapas anteriores
 * (`regionFreightPerM3: 0`), agora rotulado.
 *
 * `outbound` ausente = ele não vende ali (0 no P&L daquele hub).
 */
export interface FreightHub {
  id: string
  name: string
  inbound?: FreightLeg
  outbound?: FreightLeg
}

/** A base central: onde o PI se junta. Destino da entrada, origem da saída. */
export interface BaseHub {
  id: string
  name: string
}

/** Preço do isótopo no local de abastecimento — resolvido no servidor, no book. */
export interface JfFuelQuote {
  /** ISK por unidade de isótopo. `null` = sem book: não inventa preço. */
  isotopeUnitPrice: number | null
}

/** Uma perna já com o que o servidor descobriu (hoje: preço do isótopo). */
export interface ResolvedLeg {
  leg: FreightLeg
  fuel?: JfFuelQuote
}

/** Por que a taxa por item é o que é — a tela precisa dizer isto ao jogador. */
export type FreightRateNote =
  /** Taxa calculada normalmente. */
  | 'ok'
  /** Não há perna configurada para este hub: 0, mas rotulado. */
  | 'unconfigured'
  /** Contrato sem `per m³` nem volume da carga cheia: não dá para ratear. */
  | 'not_attributable'
  /** JF sem preço de isótopo no book: o custo do combustível é desconhecido. */
  | 'no_isotope_price'

export interface LegRate {
  /** ISK/m³ que decide de onde vem cada item. 0 quando não se sabe. */
  ratePerM3: number
  note: FreightRateNote
}

/** Custo de combustível de UMA viagem completa (ida e volta). */
export function jfTripFuelCost(leg: JfLeg, fuel: JfFuelQuote | undefined): number | null {
  const price = fuel?.isotopeUnitPrice
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(leg.isotopeQtyRoundTrip) || leg.isotopeQtyRoundTrip <= 0) return null
  return leg.isotopeQtyRoundTrip * price
}

/** Carga que o jogador declarou; sem número válido, cai no cargo do casco. */
export function jfLoadM3(leg: JfLeg): number {
  if (Number.isFinite(leg.cargoM3) && leg.cargoM3 > 0) return leg.cargoM3
  return getJumpFreighter(leg.jfTypeId)?.cargoM3 ?? 0
}

/**
 * Taxa marginal da perna, em ISK/m³ — o número que escolhe o hub de cada item.
 *
 * No JF o custo é fixo por viagem, então a taxa é `combustível ÷ carga`: quem não
 * enche o navio paga mais por m³, e isso aparece no número em vez de ficar
 * escondido numa média.
 */
export function legMarginalRatePerM3(
  leg: FreightLeg | undefined,
  fuel?: JfFuelQuote
): LegRate {
  if (!leg) return { ratePerM3: 0, note: 'unconfigured' }

  if (leg.method === 'local') return { ratePerM3: 0, note: 'ok' }

  if (leg.method === 'courier') {
    const rate = marginalRatePerM3(leg)
    // Sem `per m³` e sem o volume da carga cheia não há como dizer quanto do
    // frete cabe a cada unidade — e não inventamos uma taxa.
    if (rate == null) return { ratePerM3: 0, note: 'not_attributable' }
    return { ratePerM3: rate, note: 'ok' }
  }

  const cost = jfTripFuelCost(leg, fuel)
  const load = jfLoadM3(leg)
  if (cost == null) return { ratePerM3: 0, note: 'no_isotope_price' }
  if (load <= 0) return { ratePerM3: 0, note: 'not_attributable' }
  return { ratePerM3: cost / load, note: 'ok' }
}

/** Qual termo determinou o frete do envio. `jf_fuel` = combustível das viagens. */
export type FreightBinding = RewardBinding | 'jf_fuel'

export interface LegFreight {
  /** O frete do envio inteiro. É o que entra no total do hub. */
  cost: number
  binding: FreightBinding
  /** true = não foi possível precificar. Cai no linear e a tela avisa. */
  unpriced: boolean
  /** Viagens de JF necessárias para o volume. Só no método `jf`. */
  trips?: number
}

/**
 * Frete REAL do envio para uma perna.
 *
 *  - **local**: 0.
 *  - **courier**: o reward do contrato, com teto (full load) e piso (collateral /
 *    min reward) — a fórmula validada contra a ITL.
 *  - **jf**: `viagens × combustível`. O volume acima da carga declarada não viaja
 *    de graça: exige outra ida.
 *
 * `linearFreight` é a soma `Σ qtd × frete/un` que a escolha por item usou. É o
 * fallback quando a perna não dá para precificar — nunca zeramos em silêncio.
 */
export function legShipmentFreight(input: {
  leg?: FreightLeg
  fuel?: JfFuelQuote
  volumeM3: number
  /** Valor da mercadoria: base do termo de collateral do courier. */
  collateralValue: number
  linearFreight: number
}): LegFreight {
  const { leg, fuel, volumeM3, collateralValue, linearFreight } = input

  if (!leg) return { cost: linearFreight, binding: 'none', unpriced: false }
  if (leg.method === 'local') return { cost: 0, binding: 'none', unpriced: false }

  if (leg.method === 'courier') {
    const result = contractReward({ volumeM3, collateralValue, contract: leg })
    // Contrato em branco não zera o frete: cai no linear, que é o que se sabe.
    return {
      cost: result.unpriced ? linearFreight : result.reward,
      binding: result.binding,
      unpriced: result.unpriced,
    }
  }

  const fuelCost = jfTripFuelCost(leg, fuel)
  const load = jfLoadM3(leg)
  if (fuelCost == null || load <= 0) {
    // Sem preço de isótopo (ou sem carga declarada) o combustível é desconhecido.
    // Herda a incerteza em vez de virar zero: `unpriced` obriga a tela a avisar.
    return { cost: linearFreight, binding: 'jf_fuel', unpriced: true }
  }
  const trips = Math.max(1, Math.ceil(volumeM3 / load))
  return { cost: trips * fuelCost, binding: 'jf_fuel', unpriced: false, trips }
}

/**
 * Onde o PI pronto é entregue para vender — e o que custa levá-lo até lá.
 *
 * **O default é vender no lugar.** Quem não configura saída nenhuma vende na
 * própria base (contrato ali mesmo, sem mover carga), então o frete de saída é 0 —
 * e isso é 0 de verdade, não falta de dado. É o setup real do Rodrigo, e ele não
 * precisa configurar nada para o P&L refletir isso.
 *
 * Configurar uma saída é declarar "eu entrego ali". Havendo mais de uma, ganha a
 * mais barata por m³: o preço de venda vem do `sellSource` (global), então entre
 * dois destinos o NET só difere pelo frete.
 *
 * ⚠️ **Limitação conhecida e deliberada:** o preço de venda não é por hub. Não há
 * book de venda por destino no modelo ainda, então configurar uma saída só
 * ADICIONA custo — não traz o preço melhor que talvez exista lá. A tela diz isso.
 * Inventar um preço por destino seria exatamente o que a regra de ouro proíbe.
 */
export interface SellHubChoice {
  /** Chave do hub de venda. `null` = a base (vender no lugar). */
  hubKey: string | null
  hubName: string | null
  /** ISK/m³ para levar o produto da base até lá. 0 quando vende na base. */
  ratePerM3: number
  note: FreightRateNote
}

export function chooseSellHub(input: {
  base: BaseHub | null
  hubs: FreightHub[]
  /** Preço do isótopo por hub, para pernas de saída por JF. */
  fuelByHub?: Map<string, JfFuelQuote>
}): SellHubChoice {
  const { base, hubs, fuelByHub } = input

  const candidates = hubs
    .filter((hub) => hub.outbound != null)
    .map((hub) => {
      const rate = legMarginalRatePerM3(hub.outbound, fuelByHub?.get(hub.id))
      return { hub, rate }
    })

  const best = candidates.reduce<(typeof candidates)[number] | null>(
    (acc, c) => (acc == null || c.rate.ratePerM3 < acc.rate.ratePerM3 ? c : acc),
    null
  )

  // Sem saída configurada: vende na base. Frete 0 porque não há nada a mover.
  if (!best) {
    return { hubKey: null, hubName: base?.name ?? null, ratePerM3: 0, note: 'ok' }
  }

  return {
    hubKey: best.hub.id,
    hubName: best.hub.name,
    ratePerM3: best.rate.ratePerM3,
    note: best.rate.note,
  }
}

/**
 * Onde abastecer: o isótopo mais barato entre origem e destino.
 *
 * Empate → **origem**, porque abastecer antes de sair não depende de o destino
 * ter book na hora da chegada.
 */
export interface RefuelAdvice {
  at: 'origin' | 'destination'
  originPrice: number | null
  destinationPrice: number | null
  /** Preço no local recomendado. `null` = nenhum dos dois tem book. */
  price: number | null
  /** Quanto se economiza por viagem escolhendo o recomendado. 0 sem comparação. */
  savingsPerTrip: number
}

export function adviseRefuel(input: {
  isotopeQtyRoundTrip: number
  originPrice: number | null
  destinationPrice: number | null
}): RefuelAdvice {
  const { isotopeQtyRoundTrip } = input
  const origin = usablePrice(input.originPrice)
  const destination = usablePrice(input.destinationPrice)

  const base: Omit<RefuelAdvice, 'at' | 'price' | 'savingsPerTrip'> = {
    originPrice: origin,
    destinationPrice: destination,
  }

  if (origin == null && destination == null) {
    return { ...base, at: 'origin', price: null, savingsPerTrip: 0 }
  }
  if (destination == null) return { ...base, at: 'origin', price: origin, savingsPerTrip: 0 }
  if (origin == null) return { ...base, at: 'destination', price: destination, savingsPerTrip: 0 }

  // `<=` põe o empate na origem.
  const at = origin <= destination ? 'origin' : 'destination'
  const price = at === 'origin' ? origin : destination
  const qty = Number.isFinite(isotopeQtyRoundTrip) && isotopeQtyRoundTrip > 0 ? isotopeQtyRoundTrip : 0
  return {
    ...base,
    at,
    price,
    savingsPerTrip: Math.abs(origin - destination) * qty,
  }
}

function usablePrice(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}
