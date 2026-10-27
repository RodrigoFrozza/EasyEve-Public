/**
 * Tipos da lista de compra.
 *
 * Ficam separados da implementação porque o CLIENTE precisa deles (a tabela, o
 * CSV, o multibuy) e a implementação alcança `market-prices` → `prisma`. Um
 * arquivo só de tipos some no build, então importar daqui nunca arrasta servidor
 * para dentro do bundle.
 */

import type { PiCommodityTier } from '@/lib/pi-v2/sde'
import type { HubQuote } from '@/lib/pi-v2/pricing/hub-quotes'
import type { ContractRewardResult } from '@/lib/pi-v2/pricing/freight'
import type { FreightRateNote, LegFreight } from '@/lib/pi-v2/pricing/freight-model'
import type { ColonyPnl } from '@/lib/pi-v2/pnl'

export type { HubQuote, ContractRewardResult, LegFreight, ColonyPnl }

export interface DemandBreakdown {
  characterId: number
  characterName: string
  planetId: number
  planetName?: string
  /** Unidades deste item que ESTE planeta consome no período. */
  quantity: number
}

export interface ShoppingLine {
  typeId: number
  name: string
  tier?: PiCommodityTier
  /**
   * Unidades a COMPRAR nesta lista, arredondadas para cima (não se compra 0,4 de
   * um insumo). Igual a `grossQuantity` na lista bruta; igual a
   * `max(0, grossQuantity − warehouseQuantity)` na lista líquida do armazém.
   *
   * **Não desconta o que está no launchpad da colônia.** A ESI de PI só
   * recalcula a colônia quando o jogador abre o planeta no jogo — em planetas
   * que ficam dias sem abrir, o "estoque em mãos" projetado pode ser um
   * snapshot velho já consumido. O único desconto que existe vem do Armazém de
   * PI (`esi-assets`, estado real do container), e só quando o jogador escolhe
   * ver a lista líquida.
   */
  quantity: number
  /** Consumo bruto do período — igual nas duas listas (bruta e líquida). */
  grossQuantity: number
  /**
   * Quanto tem no Armazém de PI agora, deste item. Sempre presente (mesmo na
   * lista bruta, onde é só informativo) — vem de `esi-assets`, não de projeção.
   * Ausente Armazém configurado = 0.
   */
  warehouseQuantity: number
  /** true quando o Armazém já cobre o período inteiro NESTA lista (quantity = 0). */
  coveredByStock: boolean
  volumePerUnit: number
  totalVolumeM3: number
  /** O hub escolhido — o mais barato por custo efetivo que cobre a quantidade. */
  chosen: HubQuote | null
  /** Todas as cotações, para a UI mostrar a decomposição e a comparação. */
  quotes: HubQuote[]
  /** `quantity × effectiveUnitPrice`. 0 quando nenhum hub tem book nem referência. */
  totalCost: number
  /**
   * true quando NENHUM hub cobre a quantidade inteira. A UI é obrigada a
   * sinalizar: comprar tudo aqui vai andar o book além do que foi cotado.
   */
  short: boolean
  /** De onde veio a demanda — por personagem e planeta. */
  breakdown: DemandBreakdown[]
}

export interface HubBucket {
  origin: HubQuote['origin']
  label?: string
  stationId?: string
  /** Chave do hub (`structureId`, `region` ou `jita`) — liga o bucket à perna. */
  hubKey: string
  lines: ShoppingLine[]
  /** Mercadoria, sem frete. */
  goodsCost: number
  /**
   * Frete somado linearmente (`Σ qtd × frete/un`) — é o que a escolha de hub por
   * item usou. Serve de comparação com o custo real do envio.
   */
  linearFreight: number
  /**
   * Frete REAL do envio pela perna de ENTRADA deste hub: reward do contrato (com
   * teto e piso) ou combustível × viagens do JF. Ausente quando o hub não tem
   * perna configurada — aí o linear é o melhor que se sabe.
   */
  freight?: LegFreight
  /** Como a carga vem deste hub. Ausente = não configurado. */
  method?: 'local' | 'courier' | 'jf'
  /** Por que a taxa por item é o que é — a tela rotula 0 em vez de esconder. */
  rateNote?: FreightRateNote
  /** O frete que entra no total: o real do envio quando há, senão o linear. */
  freightCost: number
  /** `goodsCost + freightCost` — o dinheiro que sai de fato para este hub. */
  cost: number
  volumeM3: number
}

/**
 * O que o app calculou para uma perna de JF — a conta que o jogador vai conferir.
 *
 * Existe para a tela poder mostrar de onde saiu o ISK/m³ do JF: o app não faz
 * jump planning (a quantidade de isótopos vem do DOTLAN), mas o preço do
 * combustível e a decisão de onde abastecer são dele.
 *
 * Fica aqui, e não na camada de dados, porque o CLIENTE o consome.
 */
export interface JfPlanInfo {
  hubKey: string
  hubName: string
  /**
   * Qual direção esta conta descreve. A saída inverte o trajeto (base → hub), e
   * com ele quem é origem e quem é destino no conselho de abastecimento.
   */
  direction: 'inbound' | 'outbound'
  jfTypeId: number
  jfName: string
  isotopeTypeId: number
  isotopeName: string
  isotopeQtyRoundTrip: number
  /** Carga declarada, m³. */
  loadM3: number
  /** Preço andado no book do isótopo na ORIGEM (o hub). */
  originPrice: number | null
  /** Preço andado no book do isótopo no DESTINO (a base). */
  destinationPrice: number | null
  /** Onde o app recomenda abastecer. */
  adviseAt: 'origin' | 'destination'
  /** Onde a conta foi feita: a escolha do jogador, ou a recomendação. */
  refuelAt: 'origin' | 'destination'
  /** Economia por viagem ao seguir a recomendação. */
  savingsPerTrip: number
  /** Combustível de uma viagem ida-e-volta. `null` = sem book do isótopo. */
  fuelCostPerTrip: number | null
  /** `combustível ÷ carga`. `null` quando o combustível é desconhecido. */
  ratePerM3: number | null
  note: FreightRateNote
}

/**
 * O P&L de uma colônia, nas duas visões.
 *
 * `current` é o número honesto (limitado pela extração real agora); `designed` é o
 * alvo se tudo estivesse no lugar. A diferença entre os dois É o custo de não ter
 * visitado a colônia.
 *
 * Fica aqui, e não na camada de dados, porque o CLIENTE o consome.
 */
export interface ColonyPnlEntry {
  characterId: number
  characterName: string
  planetId: number
  planetName?: string
  current: ColonyPnl
  designed: ColonyPnl
}

export interface ShoppingList {
  periodHours: number
  lines: ShoppingLine[]
  /** Mercadoria + frete real, somando os hubs. É o dinheiro da rodada. */
  totalCost: number
  goodsCost: number
  freightCost: number
  totalVolumeM3: number
  /** Agrupado por hub — é assim que a compra é executada (uma ida por hub). */
  byHub: HubBucket[]
  /** Itens sem book nem preço de referência: aparecem, mas sem custo. */
  unpricedTypeIds: number[]
}
