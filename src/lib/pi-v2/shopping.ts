/**
 * Lista de compra — a resposta à pergunta 2: **o que compro, quanto, e onde?**
 *
 * É o diferencial do EasyEve. Os rastreadores mostram o estado da colônia; os
 * planejadores calculam cadeias sobre "market value" teórico e admitem que não
 * substituem a checagem in-game. Ninguém liga o estado projetado ao dinheiro —
 * é o quadrante que este módulo ocupa.
 *
 * A quantidade é DERIVADA: sai do `importNeededPerHour` que o modelo de demanda
 * já calculou das rotas e das receitas da ESI, multiplicado pelo período. Nada
 * de o jogador digitar quanto consome.
 *
 * O preço é REAL: book andado com a quantidade que se vai comprar de fato, por
 * estação, e o hub escolhido pelo custo efetivo (mercadoria + frete).
 */

import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import { getCommodityName, getCommodityTier, getCommodityVolume } from '@/lib/pi-v2/sde'
import { chooseHub, quoteHubs, type HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
import {
  hubKeyFor,
  legMarginalRatePerM3,
  legShipmentFreight,
  type ResolvedLeg,
} from '@/lib/pi-v2/pricing/freight-model'
import type {
  DemandBreakdown,
  HubBucket,
  ShoppingLine,
  ShoppingList,
} from '@/lib/pi-v2/shopping-types'

// Tipos e formatação vivem separados porque o CLIENTE os consome e este arquivo
// alcança `market-prices` → `prisma`. Reexportados para quem já está no servidor.
export type { DemandBreakdown, HubBucket, ShoppingLine, ShoppingList }
export { SHOPPING_PERIODS_HRS, toCsv, toMultibuy } from '@/lib/pi-v2/shopping-format'

/**
 * Quanto o portfólio precisa comprar de cada insumo no período.
 *
 * Usa o balanço de DESENHO: a pergunta é "o que preciso para a colônia rodar
 * como foi montada", não "o que ela está conseguindo rodar agora". Comprar pela
 * taxa degradada compraria de menos e perpetuaria a degradação.
 *
 * **Não desconta o estoque projetado no launchpad — de propósito.** A ESI de PI
 * só recalcula a colônia quando o jogador ABRE o planeta no cliente; entre uma
 * abertura e outra o snapshot fica congelado, e planetas que não visitam o
 * jogo com frequência ficam com `last_update` velho por dias. Acima de 72h a
 * projeção suspende e devolve o estoque MEDIDO cru — que pode ser de uma
 * launchpad que estava cheia quando foi vista pela última vez e está vazia
 * agora. Descontar esse número fez a lista pedir para comprar quase nada de
 * insumo que na verdade não existe mais no planeta (confirmado contra o jogo:
 * 05/ago/2026, várias colônias com Water "em mãos" na tela e zero no launchpad
 * real). Regra de ouro do projeto: número que pode estar errado não abate
 * compra — comprar de mais é capital parado, comprar de menos para a colônia.
 */
export interface ImportDemandEntry {
  /** Consumo do período — é a quantidade a comprar, sem desconto de estoque. */
  quantity: number
  breakdown: DemandBreakdown[]
}

export function aggregateImportDemand(
  colonies: PortfolioColony[],
  periodHours: number
): Map<number, ImportDemandEntry> {
  const demand = new Map<number, ImportDemandEntry>()

  for (const colony of colonies) {
    for (const balance of colony.projection.balances.designed) {
      if (balance.importNeededPerHour <= 0) continue
      const quantity = balance.importNeededPerHour * periodHours
      const entry = demand.get(balance.typeId) ?? { quantity: 0, breakdown: [] }
      entry.quantity += quantity
      entry.breakdown.push({
        characterId: colony.characterId,
        characterName: colony.characterName,
        planetId: colony.planetId,
        planetName: colony.planetName,
        quantity,
      })
      demand.set(balance.typeId, entry)
    }
  }

  return demand
}

export interface BuildShoppingListInput {
  colonies: PortfolioColony[]
  periodHours: number
  /**
   * Books por typeId, já com o frete de cada hub embutido. Quem busca é a camada
   * de dados; aqui só se decide.
   */
  booksByType: Map<number, HubBooks>
  /**
   * Perna de ENTRADA por hub (chave → perna resolvida). Só afeta o TOTAL do hub —
   * a escolha de hub por item continua na taxa marginal, que já veio embutida nos
   * books como `freightPerM3`.
   */
  legs?: Map<string, ResolvedLeg>
  /**
   * typeId → quantidade no Armazém de PI agora (assets reais, não projeção).
   * Ausente/vazio = nenhum container designado. Sempre exposto em
   * `warehouseQuantity`, independente de `netOfWarehouse` — é a coluna
   * informativa "em estoque" que a tela mostra mesmo na visão bruta.
   */
  warehouseStock?: Record<number, number>
  /**
   * true: desconta `warehouseStock` da quantidade a comprar (cotando o preço
   * pela quantidade líquida de fato). false (default): pede o bruto do período,
   * como a lista sempre pediu.
   *
   * É diferente do desconto por estoque de launchpad que existiu e foi removido
   * (ver histórico em `aggregateImportDemand`): aquele vinha de uma PROJEÇÃO que
   * podia congelar por dias sem avisar; este vem de `esi-assets`, que é o estado
   * real do container agora. Mesmo assim, o jogador escolhe — nunca é aplicado
   * em silêncio.
   */
  netOfWarehouse?: boolean
}

export function buildShoppingList(input: BuildShoppingListInput): ShoppingList {
  const { colonies, periodHours, booksByType, legs, warehouseStock, netOfWarehouse } = input
  const demand = aggregateImportDemand(colonies, periodHours)

  const lines: ShoppingLine[] = []
  const unpricedTypeIds: number[] = []

  for (const [typeId, { quantity: rawQuantity, breakdown }] of demand) {
    // Arredonda para cima: comprar 0,4 de um Polyaramid não existe, e arredondar
    // para baixo deixaria a colônia sem insumo no fim do período.
    const grossQuantity = Math.ceil(rawQuantity)
    if (grossQuantity <= 0) continue

    const warehouseQuantity = Math.floor(Math.max(0, warehouseStock?.[typeId] ?? 0))
    const quantity = netOfWarehouse
      ? Math.max(0, grossQuantity - warehouseQuantity)
      : grossQuantity
    const coveredByStock = Boolean(netOfWarehouse) && quantity === 0 && warehouseQuantity > 0

    const volumePerUnit = getCommodityVolume(typeId)
    const books = booksByType.get(typeId) ?? {}
    // Cota pela quantidade que ESTA lista de fato pede — bruta ou líquida do
    // armazém — nunca pelo bruto quando a intenção é comprar menos: andar o book
    // além do que se vai comprar pagaria por faixas de preço que a compra nem
    // chega a tocar.
    const quotes = coveredByStock ? [] : quoteHubs(books, quantity, volumePerUnit)
    const chosen = coveredByStock ? null : chooseHub(quotes, books.reference)

    if (!chosen && !coveredByStock) unpricedTypeIds.push(typeId)

    lines.push({
      typeId,
      name: getCommodityName(typeId),
      tier: getCommodityTier(typeId),
      quantity,
      grossQuantity,
      warehouseQuantity,
      coveredByStock,
      volumePerUnit,
      totalVolumeM3: quantity * volumePerUnit,
      chosen,
      quotes: [...quotes].sort((a, b) => a.effectiveUnitPrice - b.effectiveUnitPrice),
      totalCost: chosen ? quantity * chosen.effectiveUnitPrice : 0,
      short: chosen != null && !chosen.coversDemand,
      breakdown: breakdown.sort((a, b) => b.quantity - a.quantity),
    })
  }

  // Maior gasto primeiro: é onde uma decisão de hub errada custa mais.
  lines.sort((a, b) => b.totalCost - a.totalCost || a.name.localeCompare(b.name))

  const byHub = new Map<string, HubBucket>()
  for (const line of lines) {
    if (!line.chosen) continue
    const key = hubKeyFor(line.chosen.origin, line.chosen.stationId)
    const bucket = byHub.get(key) ?? {
      origin: line.chosen.origin,
      label: line.chosen.label,
      stationId: line.chosen.stationId,
      hubKey: key,
      lines: [],
      goodsCost: 0,
      linearFreight: 0,
      freightCost: 0,
      cost: 0,
      volumeM3: 0,
    }
    bucket.lines.push(line)
    bucket.goodsCost += line.quantity * line.chosen.unitPrice
    bucket.linearFreight += line.quantity * line.chosen.freightPerUnit
    bucket.volumeM3 += line.totalVolumeM3
    byHub.set(key, bucket)
  }

  // O frete do hub é o custo REAL do envio pela perna de entrada dele: reward do
  // contrato (com teto e piso) ou combustível × viagens do JF. A soma linear das
  // linhas ignora teto, piso e o custo fixo por viagem, e por isso não é o que se
  // paga. A escolha de hub por item continua no marginal: se o teto entrasse lá,
  // um item mudaria de origem conforme o resto da lista crescesse.
  for (const bucket of byHub.values()) {
    const resolved = legs?.get(bucket.hubKey)
    bucket.method = resolved?.leg.method
    bucket.rateNote = legMarginalRatePerM3(resolved?.leg, resolved?.fuel).note
    if (resolved) {
      const freight = legShipmentFreight({
        leg: resolved.leg,
        fuel: resolved.fuel,
        volumeM3: bucket.volumeM3,
        collateralValue: bucket.goodsCost,
        linearFreight: bucket.linearFreight,
      })
      bucket.freight = freight
      bucket.freightCost = freight.cost
    } else {
      bucket.freightCost = bucket.linearFreight
    }
    bucket.cost = bucket.goodsCost + bucket.freightCost
  }

  const buckets = [...byHub.values()].sort((a, b) => b.cost - a.cost)
  const goodsCost = buckets.reduce((sum, b) => sum + b.goodsCost, 0)
  const freightCost = buckets.reduce((sum, b) => sum + b.freightCost, 0)

  return {
    periodHours,
    lines,
    goodsCost,
    freightCost,
    totalCost: goodsCost + freightCost,
    totalVolumeM3: lines.reduce((sum, l) => sum + l.totalVolumeM3, 0),
    byHub: buckets,
    unpricedTypeIds,
  }
}

