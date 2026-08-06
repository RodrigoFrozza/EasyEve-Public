/**
 * Camada de dados da lista de compra: busca os books e entrega a lista pronta.
 *
 * Roda sobre o portfólio que a pergunta 1 já monta — a economia CONSOME o estado
 * projetado, nunca o contrário. Se a lista de compra fosse calculada sobre um
 * snapshot de idade desconhecida, seria a compra ótima para uma colônia que não
 * existe mais.
 *
 * **O modelo é base central + hubs.** A base é onde o PI se junta (entrada
 * `local`, custo 0 de verdade). Cada hub — estrutura onde ele pode atracar, ou uma
 * das duas fontes públicas — tem uma perna de ENTRADA com método próprio: courier
 * ou JF do próprio jogador. Todas concorrem na escolha por custo efetivo.
 *
 * Estação sem mercado ou sem acesso cai fora **com aviso** — nunca vira preço
 * inventado. O mesmo vale para o preço do isótopo do JF: sem book, o custo do
 * combustível é declarado desconhecido em vez de virar zero.
 */

import { buildPortfolio, type Portfolio } from '@/lib/pi-v2/portfolio'
import { buildShoppingList, type ShoppingList } from '@/lib/pi-v2/shopping'
import type { ColonyPnlEntry, JfPlanInfo } from '@/lib/pi-v2/shopping-types'
import {
  chooseHub,
  quoteHubs,
  type HubBooks,
  type HubQuote,
  type StationBook,
} from '@/lib/pi-v2/pricing/hub-quotes'
import { composePriceMap, exportUnitPrice, type SellSource } from '@/lib/pi-v2/pricing/price-map'
import { computeColonyPnl, sumPnl, type PnlTotals } from '@/lib/pi-v2/pnl'
import { readWarehouse, type WarehouseView } from '@/lib/pi-v2/warehouse-service'
import type { WarehouseContainerConfig } from '@/lib/pi-v2/warehouse'
import { getCommodityVolume } from '@/lib/pi-v2/sde'
import {
  adviseRefuel,
  chooseSellHub,
  hubKeyFor,
  isPublicHubId,
  jfLoadM3,
  jfTripFuelCost,
  legMarginalRatePerM3,
  JITA_HUB_ID,
  REGION_HUB_ID,
  type BaseHub,
  type FreightHub,
  type FreightRateNote,
  type JfFuelQuote,
  type ResolvedLeg,
  type SellHubChoice,
} from '@/lib/pi-v2/pricing/freight-model'
import { getJumpFreighter } from '@/lib/pi-v2/jf-data'
import {
  fillFromOrders,
  getJitaPricesPersistent,
  getRegionalMarketDepth,
  getStructureMarketDepth,
  JITA_REGION_ID,
  loadPiUserConfig,
  loadReferencePrices,
  logger,
} from '@/lib/pi-v2/host'
import type { MarketDepth } from '@/lib/market-prices'

export interface BuildShoppingInput {
  userId: string
  characters: Array<{ id: number; name: string; accessToken?: string | null }>
  characterIdFilter?: number
  periodHours: number
  /**
   * A base central. Ausente → ninguém configurou ainda: os hubs continuam
   * concorrendo, e a tela pede a base.
   */
  base?: BaseHub | null
  /**
   * Hubs de compra. Ids de estrutura (ESI) ou os reservados `region`/`jita`.
   * Vazio → só as fontes públicas, sem frete configurado.
   */
  hubs?: FreightHub[]
  /**
   * Containers designados como Armazém de PI. Vazio/ausente → a feature fica
   * desligada e nada muda (nem leitura de assets, nem número na tela).
   */
  warehouse?: WarehouseContainerConfig[]
  forceRefresh?: boolean
  nowMs?: number
}

export interface StationWarning {
  id: string
  name: string
  /** `no_market`: sem book acessível (sem mercado, sem docking, ou ESI fora). */
  reason: 'no_market'
}

export type { ColonyPnlEntry, JfPlanInfo }

export interface ShoppingResult {
  /** A lista de compra BRUTA — o consumo do período, sem descontar o Armazém. */
  list: ShoppingList
  /**
   * A mesma lista, com o Armazém de PI descontado (cotada pela quantidade
   * líquida de fato, não pela bruta) — `null` quando nenhum container foi
   * designado. A tela deixa o jogador escolher qual ver; nenhuma das duas é
   * aplicada em silêncio sobre a outra.
   */
  listNetOfWarehouse: ShoppingList | null
  /** O portfólio que originou a demanda — a UI mostra a mesma verdade nas duas telas. */
  portfolio: Portfolio
  /** Estações que não entraram no cálculo, para a UI avisar em vez de sumir. */
  stationWarnings: StationWarning[]
  /** Contas dos JFs configurados (preço do isótopo, onde abastecer, ISK/m³). */
  jfPlans: JfPlanInfo[]
  /** P&L por colônia, casado por (characterId, planetId). */
  pnl: ColonyPnlEntry[]
  /** Soma dos NET por colônia — o número do topo da tela. */
  pnlTotals: PnlTotals
  /** Onde o produto é entregue para vender, e o que custa chegar lá. */
  sellHub: SellHubChoice
  /**
   * O Armazém de PI. Ausente quando nenhum container foi designado.
   *
   * Alimenta `warehouseQuantity` em cada linha e `listNetOfWarehouse` — mas
   * `list` (a bruta) nunca depende dele.
   */
  warehouse?: WarehouseView
  /**
   * Estruturas configuradas no perfil (v1) — usadas UMA vez pelo cliente para
   * semear a config nova de quem ainda não a montou, sem perder a antiga.
   */
  legacyStations: Array<{ id: string; name: string }>
}

/** Preço andado no book para a quantidade que se vai comprar de fato. */
function walkedPrice(depth: MarketDepth | null | undefined, qty: number): number | null {
  if (!depth || qty <= 0) return null
  const fill = fillFromOrders(depth.sell, qty)
  const price = fill.avgUnitPrice || fill.bestUnitPrice
  return price > 0 ? price : null
}

export async function buildShopping(input: BuildShoppingInput): Promise<ShoppingResult> {
  const base = input.base ?? null
  const hubs = input.hubs ?? []

  const portfolio = await buildPortfolio({
    userId: input.userId,
    characters: input.characters,
    characterIdFilter: input.characterIdFilter,
    forceRefresh: input.forceRefresh,
    nowMs: input.nowMs,
  })

  const { preferences } = await loadPiUserConfig(input.userId)

  const legacyStations = [
    preferences.buyStructureId
      ? { id: preferences.buyStructureId, name: preferences.buyStructureName ?? preferences.buyStructureId }
      : null,
    preferences.buyStructureId2
      ? { id: preferences.buyStructureId2, name: preferences.buyStructureName2 ?? preferences.buyStructureId2 }
      : null,
  ].filter((s): s is { id: string; name: string } => s != null)

  // A base é um hub como os outros na hora de comprar — com entrada `local`, o
  // único frete 0 que é 0 de verdade. Vem primeiro para nunca ser cortada pelo
  // teto de estruturas.
  const structureHubs: FreightHub[] = [
    ...(base ? [{ id: base.id, name: base.name, inbound: { method: 'local' as const } }] : []),
    ...hubs.filter((hub) => !isPublicHubId(hub.id) && hub.id !== base?.id),
  ]
  const regionHub = hubs.find((hub) => hub.id === REGION_HUB_ID)
  const jitaHub = hubs.find((hub) => hub.id === JITA_HUB_ID)

  // Só os tipos que a colônia de fato COMPRA — não precificamos o que ela faz.
  const commodityTypeIds = [
    ...new Set(
      portfolio.colonies.flatMap((c) =>
        c.projection.balances.designed
          .filter((b) => b.importNeededPerHour > 0)
          .map((b) => b.typeId)
      )
    ),
  ]

  // O que a colônia VENDE. Precisa de preço para o P&L, e entra no mesmo lote de
  // book dos insumos — nenhuma chamada de ESI a mais.
  const exportTypeIds = [
    ...new Set(
      portfolio.colonies.flatMap((c) =>
        [...c.projection.balances.designed, ...c.projection.balances.current]
          .filter((b) => b.exportedPerHour > 0)
          .map((b) => b.typeId)
      )
    ),
  ]

  // Isótopos das pernas de JF configuradas — **as duas direções**: uma saída por
  // JF queima combustível igual à entrada. Entram na MESMA varredura de book (a
  // ESI cobra por chamada, não por type_id), então o JF não custa requisição nova.
  const allHubs = [...structureHubs, ...(regionHub ? [regionHub] : []), ...(jitaHub ? [jitaHub] : [])]
  const isotopeTypeIds = [
    ...new Set(
      allHubs
        .flatMap((hub) => [hub.inbound, hub.outbound])
        .map((leg) => (leg?.method === 'jf' ? getJumpFreighter(leg.jfTypeId) : null))
        .filter((jf): jf is NonNullable<typeof jf> => jf != null)
        .map((jf) => jf.isotopeTypeId)
    ),
  ]
  const fetchTypeIds = [
    ...new Set([...commodityTypeIds, ...exportTypeIds, ...isotopeTypeIds]),
  ]

  // Consumo por hora do portfólio: a base da autonomia do armazém ("meu Fertilizer
  // dura X dias"). Sai do portfólio, então já está disponível — o que permite
  // buscar os assets EM PARALELO com os books em vez de em série depois deles.
  const consumptionPerHour = new Map<number, number>()
  for (const colony of portfolio.colonies) {
    for (const balance of colony.projection.balances.designed) {
      if (balance.importNeededPerHour <= 0) continue
      consumptionPerHour.set(
        balance.typeId,
        (consumptionPerHour.get(balance.typeId) ?? 0) + balance.importNeededPerHour
      )
    }
  }

  const warehouseConfig = input.warehouse ?? []
  const warehousePromise: Promise<WarehouseView | undefined> =
    warehouseConfig.length > 0
      ? readWarehouse({
          characters: input.characters,
          config: warehouseConfig,
          consumptionPerHour,
          cadenceHrs: portfolio.cadenceHrs,
        })
      : // Sem container designado a feature fica desligada: nenhuma leitura de
        // assets, nenhum número novo na tela.
        Promise.resolve(undefined)

  const emptyResult = async (): Promise<ShoppingResult> => ({
    list: buildShoppingList({
      colonies: portfolio.colonies,
      periodHours: input.periodHours,
      booksByType: new Map(),
    }),
    listNetOfWarehouse: null,
    portfolio,
    stationWarnings: [],
    jfPlans: [],
    pnl: [],
    pnlTotals: sumPnl([]),
    sellHub: chooseSellHub({ base, hubs }),
    warehouse: await warehousePromise,
    legacyStations,
  })

  // Só sai cedo quando não há NADA a precificar. Uma colônia extratora pura não
  // compra insumo nenhum e ainda assim tem P&L (receita sem custo de insumo) —
  // cortar aqui pelo lado da compra apagaria o lucro dela.
  if (commodityTypeIds.length === 0 && exportTypeIds.length === 0) return await emptyResult()

  const regionId = preferences.homeRegionId ?? JITA_REGION_ID
  const isRegionJita = regionId === JITA_REGION_ID
  // Acesso de docagem/mercado a estrutura é por personagem: tenta todos da conta.
  const structAccessCharIds = input.characters.map((c) => c.id)

  const [regionDepth, jitaFallback, referencePrices, stationDepths, warehouse] = await Promise.all([
    getRegionalMarketDepth(regionId, fetchTypeIds),
    // Região silenciosa (null-sec) cai para Jita POR COMMODITY, para o preço
    // nunca colapsar em 0 e zerar a lista inteira.
    isRegionJita ? Promise.resolve(null) : getJitaPricesPersistent(fetchTypeIds),
    loadReferencePrices(input.userId, fetchTypeIds),
    Promise.all(
      structureHubs.map(async (hub) => {
        if (structAccessCharIds.length === 0) return { hub, depth: null }
        try {
          const depth = await getStructureMarketDepth(hub.id, structAccessCharIds, fetchTypeIds)
          // `{}` = nenhum personagem conseguiu ler o book (sem docking, sem
          // mercado, ou ESI fora). Vira aviso, nunca preço.
          return { hub, depth: Object.keys(depth).length > 0 ? depth : null }
        } catch (error) {
          logger.warn('PiV2Shopping', `Hub ${hub.id} ignorado — book indisponível`, error)
          return { hub, depth: null }
        }
      })
    ),
    // Os assets do armazém em paralelo com os books: eles não dependem de preço.
    warehousePromise,
  ])

  const stationWarnings: StationWarning[] = []
  const usableHubs: Array<{ hub: FreightHub; depth: Record<number, MarketDepth> }> = []
  for (const { hub, depth } of stationDepths) {
    if (!depth) {
      stationWarnings.push({ id: hub.id, name: hub.name, reason: 'no_market' })
      continue
    }
    usableHubs.push({ hub, depth })
  }

  const baseDepth = base ? usableHubs.find(({ hub }) => hub.id === base.id)?.depth : undefined

  /** Preço do isótopo NA ORIGEM, na fonte que aquele hub representa. */
  const originIsotopePrice = (hub: FreightHub, isotopeTypeId: number, qty: number): number | null => {
    if (hub.id === JITA_HUB_ID) {
      const sell = jitaFallback?.[isotopeTypeId]?.sell ?? regionDepth[isotopeTypeId]?.sell[0]?.price
      return typeof sell === 'number' && sell > 0 ? sell : null
    }
    if (hub.id === REGION_HUB_ID) return walkedPrice(regionDepth[isotopeTypeId], qty)
    const depth = usableHubs.find(({ hub: h }) => h.id === hub.id)?.depth
    return walkedPrice(depth?.[isotopeTypeId], qty)
  }

  /**
   * As duas pontas do trajeto de uma perna, para o conselho de abastecimento.
   *
   * A direção inverte quem é quem: a **entrada** sai do hub e chega na base; a
   * **saída** sai da base e chega no hub. Tratar as duas como "origem = o hub"
   * mandaria o jogador abastecer no lugar errado na metade dos casos.
   */
  const legRoutePrices = (
    hub: FreightHub,
    direction: 'inbound' | 'outbound',
    isotopeTypeId: number,
    qty: number
  ): { originPrice: number | null; destinationPrice: number | null } => {
    const atHub = originIsotopePrice(hub, isotopeTypeId, qty)
    const atBase = walkedPrice(baseDepth?.[isotopeTypeId], qty)
    return direction === 'inbound'
      ? { originPrice: atHub, destinationPrice: atBase }
      : { originPrice: atBase, destinationPrice: atHub }
  }

  /**
   * Resolve uma perna de um hub: taxa marginal + a conta do JF quando é o caso.
   *
   * O JF é onde o app agrega o que o jogador não faz de cabeça: anda o book do
   * isótopo nos dois pontos da rota, aponta o mais barato, e devolve ISK/m³
   * comparável com o courier.
   */
  const resolveLeg = (
    hub: FreightHub,
    direction: 'inbound' | 'outbound'
  ): { resolved?: ResolvedLeg; ratePerM3: number; note: FreightRateNote; plan?: JfPlanInfo } => {
    const leg = direction === 'inbound' ? hub.inbound : hub.outbound
    if (!leg) return { ratePerM3: 0, note: 'unconfigured' }
    if (leg.method !== 'jf') {
      const rate = legMarginalRatePerM3(leg)
      return { resolved: { leg }, ratePerM3: rate.ratePerM3, note: rate.note }
    }

    const jf = getJumpFreighter(leg.jfTypeId)
    if (!jf) {
      // Casco desconhecido (SDE regenerado, config antiga): não inventamos cargo
      // nem isótopo. A perna existe, mas sem taxa — e a tela diz isso.
      return { resolved: { leg }, ratePerM3: 0, note: 'not_attributable' }
    }

    const qty = leg.isotopeQtyRoundTrip
    const advice = adviseRefuel({
      isotopeQtyRoundTrip: qty,
      ...legRoutePrices(hub, direction, jf.isotopeTypeId, qty),
    })
    const refuelAt = leg.refuelAt ?? advice.at
    const price = refuelAt === 'origin' ? advice.originPrice : advice.destinationPrice
    const fuel: JfFuelQuote = { isotopeUnitPrice: price }
    const rate = legMarginalRatePerM3(leg, fuel)

    return {
      resolved: { leg, fuel },
      ratePerM3: rate.ratePerM3,
      note: rate.note,
      plan: {
        hubKey: hub.id,
        hubName: hub.name,
        direction,
        jfTypeId: jf.typeId,
        jfName: jf.name,
        isotopeTypeId: jf.isotopeTypeId,
        isotopeName: jf.isotopeName,
        isotopeQtyRoundTrip: qty,
        loadM3: jfLoadM3(leg),
        originPrice: advice.originPrice,
        destinationPrice: advice.destinationPrice,
        adviseAt: advice.at,
        refuelAt,
        savingsPerTrip: advice.savingsPerTrip,
        fuelCostPerTrip: jfTripFuelCost(leg, fuel),
        ratePerM3: rate.note === 'ok' ? rate.ratePerM3 : null,
        note: rate.note,
      },
    }
  }

  const legs = new Map<string, ResolvedLeg>()
  const jfPlans: JfPlanInfo[] = []
  const stationRates = new Map<string, number>()
  /** Combustível das pernas de SAÍDA, para a escolha do hub de venda. */
  const outboundFuel = new Map<string, JfFuelQuote>()

  /** A saída é resolvida junto da entrada: mesmo book, mesma passada. */
  const resolveOutbound = (hub: FreightHub) => {
    if (!hub.outbound) return
    const { resolved, plan } = resolveLeg(hub, 'outbound')
    if (resolved?.fuel) outboundFuel.set(hub.id, resolved.fuel)
    if (plan) jfPlans.push(plan)
  }

  for (const { hub } of usableHubs) {
    const { resolved, ratePerM3, plan } = resolveLeg(hub, 'inbound')
    stationRates.set(hub.id, ratePerM3)
    if (resolved) legs.set(hub.id, resolved)
    if (plan) jfPlans.push(plan)
    resolveOutbound(hub)
  }

  let regionFreightPerM3 = 0
  if (regionHub) {
    const { resolved, ratePerM3, plan } = resolveLeg(regionHub, 'inbound')
    regionFreightPerM3 = ratePerM3
    if (resolved) legs.set(REGION_HUB_ID, resolved)
    if (plan) jfPlans.push(plan)
    resolveOutbound(regionHub)
  }

  let jitaFreightPerM3 = 0
  if (jitaHub) {
    const { resolved, ratePerM3, plan } = resolveLeg(jitaHub, 'inbound')
    jitaFreightPerM3 = ratePerM3
    if (resolved) legs.set(JITA_HUB_ID, resolved)
    if (plan) jfPlans.push(plan)
    resolveOutbound(jitaHub)
  }

  // Onde ele entrega para vender. Sem saída configurada é a base: frete 0, e 0 de
  // verdade — não há nada a mover.
  const sellHub = chooseSellHub({ base, hubs: allHubs, fuelByHub: outboundFuel })

  const booksByType = new Map<number, HubBooks>()
  for (const typeId of commodityTypeIds) {
    const jitaScalar = jitaFallback?.[typeId]
      ? { buy: jitaFallback[typeId]!.buy, sell: jitaFallback[typeId]!.sell }
      : isRegionJita
        ? {
            buy: regionDepth[typeId]?.buy[0]?.price ?? 0,
            sell: regionDepth[typeId]?.sell[0]?.price ?? 0,
          }
        : undefined

    const stationBooks: StationBook[] = usableHubs.map(({ hub, depth }) => ({
      id: hub.id,
      label: hub.name,
      book: depth[typeId],
      freightPerM3: stationRates.get(hub.id) ?? 0,
    }))

    booksByType.set(typeId, {
      stations: stationBooks,
      // Quando a região JÁ é Jita, o book regional é o de Jita: não duplicar a
      // mesma fonte como dois hubs concorrendo entre si.
      region: isRegionJita ? undefined : regionDepth[typeId],
      regionFreightPerM3,
      jita: jitaScalar,
      jitaFreightPerM3,
      reference: referencePrices[typeId],
    })
  }

  const list = buildShoppingList({
    colonies: portfolio.colonies,
    periodHours: input.periodHours,
    booksByType,
    legs,
    warehouseStock: warehouse?.stock,
  })
  // Mesma cotação, mesmos books — só a quantidade líquida do Armazém muda. Não
  // custa ESI extra: os books já foram buscados uma vez.
  const listNetOfWarehouse = warehouse
    ? buildShoppingList({
        colonies: portfolio.colonies,
        periodHours: input.periodHours,
        booksByType,
        legs,
        warehouseStock: warehouse.stock,
        netOfWarehouse: true,
      })
    : null

  // ---------------------------------------------------------------------------
  // P&L
  //
  // O custo de insumo sai da MESMA cotação da lista de compra: `quoteHubs` +
  // `chooseHub` sobre o MESMO `booksByType`, com os MESMOS fretes de entrada. Não
  // existe segunda implementação de "onde comprar e por quanto".
  //
  // A quantidade é que difere, e de propósito: o P&L sempre cota **o consumo do
  // período** (bruto) — igual à lista BRUTA, nunca à líquida do Armazém —,
  // porque o que ele mede é o custo de RODAR. Um estoque cheio não deixa a
  // colônia mais lucrativa, só adia a compra. Para a mesma quantidade os dois
  // caminhos dão o mesmo número, e é isso que o teste de não-divergência trava.
  // ---------------------------------------------------------------------------
  const grossDemandByType = new Map<number, number>()
  const exportSupplyByType = new Map<number, number>()
  for (const colony of portfolio.colonies) {
    for (const balance of colony.projection.balances.designed) {
      if (balance.importNeededPerHour > 0) {
        grossDemandByType.set(
          balance.typeId,
          (grossDemandByType.get(balance.typeId) ?? 0) + balance.importNeededPerHour * input.periodHours
        )
      }
      if (balance.exportedPerHour > 0) {
        exportSupplyByType.set(
          balance.typeId,
          (exportSupplyByType.get(balance.typeId) ?? 0) + balance.exportedPerHour
        )
      }
    }
  }

  /** O hub e o preço efetivo de cada insumo — a cotação que o P&L consome. */
  const inputQuotes = new Map<number, HubQuote | null>()
  for (const typeId of commodityTypeIds) {
    const books = booksByType.get(typeId)
    if (!books) continue
    const qty = grossDemandByType.get(typeId) ?? 0
    if (qty <= 0) continue
    const quotes = quoteHubs(books, qty, getCommodityVolume(typeId))
    inputQuotes.set(typeId, chooseHub(quotes, books.reference))
  }

  // O preço de VENDA vem do `sellSource` configurado (o default do Rodrigo é
  // jita_split). Reusamos `composePriceMap`, que é onde essa regra vive — o P&L
  // não reimplementa fonte de venda nem inventa preço.
  const jitaScalars: Record<number, { buy: number; sell: number }> = {}
  for (const typeId of fetchTypeIds) {
    if (jitaFallback?.[typeId]) {
      jitaScalars[typeId] = { buy: jitaFallback[typeId]!.buy, sell: jitaFallback[typeId]!.sell }
    } else if (isRegionJita) {
      jitaScalars[typeId] = {
        buy: regionDepth[typeId]?.buy[0]?.price ?? 0,
        sell: regionDepth[typeId]?.sell[0]?.price ?? 0,
      }
    }
  }

  const sellStructureDepth =
    preferences.sellSource === 'structure' && preferences.sellStructureId
      ? (usableHubs.find(({ hub }) => hub.id === preferences.sellStructureId)?.depth ?? null)
      : null

  const { priceMap } = composePriceMap(
    fetchTypeIds,
    {
      regionDepth,
      regionFreightPerM3,
      jita: jitaScalars,
      jitaFreightPerM3,
      stations: usableHubs.map(({ hub, depth }) => ({
        id: hub.id,
        label: hub.name,
        depth,
        freightPerM3: stationRates.get(hub.id) ?? 0,
      })),
      sellStructureDepth,
      sellSource: preferences.sellSource as SellSource,
      referencePrices,
    },
    grossDemandByType,
    exportSupplyByType
  )

  const exportTaxRate = preferences.exportTaxRate
  const importTaxRate = preferences.importTaxRate ?? preferences.exportTaxRate
  const pnlArgs = {
    sellUnitPrice: (typeId: number) =>
      exportUnitPrice(priceMap, typeId, preferences.pricingMode),
    inputCost: (typeId: number) => {
      const quote = inputQuotes.get(typeId)
      if (!quote) return null
      return {
        effectiveUnitPrice: quote.effectiveUnitPrice,
        hubKey: hubKeyFor(quote.origin, quote.stationId),
        hubLabel: quote.label,
      }
    },
    volumePerUnit: getCommodityVolume,
    exportTaxRate,
    importTaxRate,
    outboundRatePerM3: sellHub.ratePerM3,
  }

  const pnl: ColonyPnlEntry[] = portfolio.colonies.map((colony) => ({
    characterId: colony.characterId,
    characterName: colony.characterName,
    planetId: colony.planetId,
    planetName: colony.planetName,
    current: computeColonyPnl({ ...pnlArgs, balances: colony.projection.balances.current }),
    designed: computeColonyPnl({ ...pnlArgs, balances: colony.projection.balances.designed }),
  }))

  return {
    list,
    listNetOfWarehouse,
    portfolio,
    stationWarnings,
    jfPlans,
    pnl,
    // O agregado é a SOMA dos por-colônia, nunca uma segunda conta sobre o
    // portfólio: se divergisse, o topo da tela contradiria o detalhe.
    pnlTotals: sumPnl(pnl.map((entry) => entry.current)),
    sellHub,
    warehouse,
    legacyStations,
  }
}
