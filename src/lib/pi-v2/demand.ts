/**
 * Modelo de demanda — o que a colônia produz, consome, importa e exporta por hora,
 * DERIVADO das rotas e dos schematics da ESI. Nada aqui é configurado pelo jogador.
 *
 * Porte de `demand-model.ts` do v1 (as funções de throughput saíram para
 * `routes.ts`, onde são derivação pura de rota). Duas visões por colônia:
 *
 *  - **designed** ("o desenho"): a colônia rodando como foi montada, assumindo
 *    que o insumo importado está lá. É o alvo, não a realidade.
 *  - **current** ("o que roda agora"): limitado pela extração corrente (extrator
 *    decaído/vencido derruba a cadeia inteira) e descontado pelo que se perde em
 *    store lotado. É o número honesto.
 */

import type { PiColonyLayout } from '@/lib/pi-v2/esi'
import {
  extractorCurrentUnitsPerHour,
  extractorProgramTotal,
  isExtractorExpired,
} from '@/lib/pi-v2/extractor'
import {
  buildRouteEdges,
  exportableTypeIds,
  importedTypeIds,
  incomingThroughput,
  terminalExportTypeIds,
  type ThroughputByPin,
} from '@/lib/pi-v2/routes'
import { buildStoreNodes } from '@/lib/pi-v2/stores'
import {
  getCommodityName,
  getCommodityTier,
  getSchematicById,
  isProcessorRole,
  pinRole,
  resolveSchematicId,
  type PiCommodityTier,
} from '@/lib/pi-v2/sde'

export interface CommodityBalance {
  typeId: number
  name: string
  tier?: PiCommodityTier
  /** Consumo das fábricas locais (unidades/hora). */
  demandPerHour: number
  extractionPerHour: number
  productionPerHour: number
  /** extração + produção local. */
  localSupplyPerHour: number
  /** Déficit que precisa vir do mercado — a base da lista de compra. */
  importNeededPerHour: number
  surplusPerHour: number
  /** Sobra fisicamente roteada até um store terminal — a receita real. */
  exportedPerHour: number
  /** Produção que não cabe em lugar nenhum e se perde. */
  wastedPerHour: number
  isImported: boolean
  isExportable: boolean
}

export interface DemandModel {
  designed: CommodityBalance[]
  current: CommodityBalance[]
  producedTypeIds: Set<number>
  recipeInputTypeIds: Set<number>
  localSupplyTypeIds: Set<number>
  exportableTypeIds: Set<number>
  importedTypeIds: Set<number>
}

function tierRank(tier?: PiCommodityTier): number {
  return tier ?? -1
}

function schematicOutputPerHour(schematicId: number, factoryCount = 1): number {
  const sch = getSchematicById(schematicId)
  if (!sch || sch.cycleTimeSec <= 0) return 0
  return (sch.output.qty / sch.cycleTimeSec) * 3_600 * factoryCount
}

/** Saída de uma fábrica limitada pelo que as rotas de entrada conseguem entregar. */
function factoryOutputCappedByRoutes(
  pinId: number,
  schematicId: number,
  factoryCount: number,
  incoming: ThroughputByPin
): number {
  const sch = getSchematicById(schematicId)
  if (!sch) return 0

  let capped = schematicOutputPerHour(schematicId, factoryCount)
  const pinIncoming = incoming.get(pinId)
  if (!pinIncoming) return capped

  for (const inp of sch.inputs) {
    const routeLimit = pinIncoming.get(inp.typeId)
    if (routeLimit == null) continue
    capped = Math.min(capped, (routeLimit / inp.qty) * sch.output.qty)
  }

  return Math.max(0, capped)
}

function computeExtractionRates(
  layout: PiColonyLayout,
  nowMs: number
): { designed: Map<number, number>; current: Map<number, number> } {
  const designed = new Map<number, number>()
  const current = new Map<number, number>()

  for (const pin of layout.pins) {
    if (pinRole(pin.type_id) !== 'extractor') continue
    const details = pin.extractor_details
    const productTypeId = details?.product_type_id ?? 0
    const qtyPerCycle = details?.qty_per_cycle ?? 0
    const cycleTimeSec = details?.cycle_time ?? 0
    if (productTypeId <= 0 || qtyPerCycle <= 0 || cycleTimeSec <= 0) continue

    const programHours =
      pin.install_time && pin.expiry_time
        ? (Date.parse(pin.expiry_time) - Date.parse(pin.install_time)) / 3_600_000
        : 0

    const programTotal =
      programHours > 0
        ? extractorProgramTotal(qtyPerCycle, cycleTimeSec, pin.install_time, pin.expiry_time)
        : 0

    const designedRate = programHours > 0 ? programTotal / programHours : 0
    const currentRate = isExtractorExpired(pin.expiry_time, nowMs)
      ? 0
      : extractorCurrentUnitsPerHour(
          qtyPerCycle,
          cycleTimeSec,
          pin.install_time,
          pin.expiry_time,
          nowMs
        )

    designed.set(productTypeId, (designed.get(productTypeId) ?? 0) + designedRate)
    current.set(productTypeId, (current.get(productTypeId) ?? 0) + currentRate)
  }

  return { designed, current }
}

function computeFactoryDemand(
  layout: PiColonyLayout,
  incoming: ThroughputByPin
): {
  demandPerHour: Map<number, number>
  productionPerHour: Map<number, number>
  producedTypeIds: Set<number>
  recipeInputTypeIds: Set<number>
  schematicCounts: Map<number, number>
} {
  const demandPerHour = new Map<number, number>()
  const productionPerHour = new Map<number, number>()
  const producedTypeIds = new Set<number>()
  const recipeInputTypeIds = new Set<number>()
  const schematicCounts = new Map<number, number>()

  for (const pin of layout.pins) {
    if (!isProcessorRole(pinRole(pin.type_id))) continue
    const schematicId = resolveSchematicId(pin)
    if (!schematicId) continue

    schematicCounts.set(schematicId, (schematicCounts.get(schematicId) ?? 0) + 1)

    const sch = getSchematicById(schematicId)
    if (!sch) continue

    const outputRate = factoryOutputCappedByRoutes(pin.pin_id, schematicId, 1, incoming)
    productionPerHour.set(
      sch.output.typeId,
      (productionPerHour.get(sch.output.typeId) ?? 0) + outputRate
    )
    producedTypeIds.add(sch.output.typeId)

    for (const inp of sch.inputs) {
      recipeInputTypeIds.add(inp.typeId)
      const inputRate = (outputRate / sch.output.qty) * inp.qty
      demandPerHour.set(inp.typeId, (demandPerHour.get(inp.typeId) ?? 0) + inputRate)
    }
  }

  return { demandPerHour, productionPerHour, producedTypeIds, recipeInputTypeIds, schematicCounts }
}

/**
 * Cascata do que roda AGORA: parte da extração corrente e sobe tier a tier,
 * cada receita limitada pelo insumo que a anterior de fato entregou. É assim que
 * um extrator vencido derruba a P4 no fim da cadeia, e não só o P1.
 */
function cascadeCurrentProduction(
  extractionCurrent: Map<number, number>,
  schematicCounts: Map<number, number>,
  layout: PiColonyLayout,
  incoming: ThroughputByPin
): { productionPerHour: Map<number, number>; demandPerHour: Map<number, number> } {
  const productionPerHour = new Map<number, number>()
  const demandPerHour = new Map<number, number>()
  const available = new Map<number, number>(extractionCurrent)

  const factoryPinsBySchematic = new Map<number, number[]>()
  for (const pin of layout.pins) {
    if (!isProcessorRole(pinRole(pin.type_id))) continue
    const schematicId = resolveSchematicId(pin)
    if (!schematicId) continue
    const list = factoryPinsBySchematic.get(schematicId) ?? []
    list.push(pin.pin_id)
    factoryPinsBySchematic.set(schematicId, list)
  }

  const recipes = [...schematicCounts.entries()]
    .map(([schematicId, count]) => {
      const sch = getSchematicById(schematicId)
      if (!sch) return null

      const pinIds = factoryPinsBySchematic.get(schematicId) ?? []
      const routeCappedPerPin = pinIds.map((pinId) =>
        factoryOutputCappedByRoutes(pinId, schematicId, 1, incoming)
      )
      const routeCappedTotal =
        routeCappedPerPin.length > 0
          ? routeCappedPerPin.reduce((sum, rate) => sum + rate, 0)
          : schematicOutputPerHour(schematicId, count)

      return {
        schematicId,
        count,
        sch,
        tier: getCommodityTier(sch.output.typeId) ?? 0,
        maxRate: Math.min(schematicOutputPerHour(schematicId, count), routeCappedTotal),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier))

  for (const recipe of recipes) {
    let limitingRate = recipe.maxRate
    for (const inp of recipe.sch.inputs) {
      const availableUnits = available.get(inp.typeId) ?? 0
      limitingRate = Math.min(limitingRate, (availableUnits / inp.qty) * recipe.sch.output.qty)
    }
    limitingRate = Math.max(0, limitingRate)

    productionPerHour.set(
      recipe.sch.output.typeId,
      (productionPerHour.get(recipe.sch.output.typeId) ?? 0) + limitingRate
    )

    for (const inp of recipe.sch.inputs) {
      const consumed = (limitingRate / recipe.sch.output.qty) * inp.qty
      available.set(inp.typeId, Math.max(0, (available.get(inp.typeId) ?? 0) - consumed))
      demandPerHour.set(inp.typeId, (demandPerHour.get(inp.typeId) ?? 0) + consumed)
    }

    available.set(
      recipe.sch.output.typeId,
      (available.get(recipe.sch.output.typeId) ?? 0) + limitingRate
    )
  }

  return { productionPerHour, demandPerHour }
}

/**
 * Fração (0..1) do throughput desenhado de cada commodity que hoje aponta para um
 * store JÁ LOTADO (freeM3 <= 0 no snapshot). Fábricas e extratores não guardam a
 * própria saída: destino sem espaço significa que aquela parcela é PERDIDA, não
 * adiada. Só desconta a visão `current`; a `designed` é a projeção sem restrição.
 *
 * ESCOPO: só contam rotas cujo destino é um store. Rota que entra em fábrica é
 * ela PUXANDO o próprio insumo — outro fluxo, não "a entrega do produtor coube".
 * Incluí-la no denominador diluiria a fração justamente na topologia padrão
 * (produtor → store → fábrica do tier seguinte → store).
 *
 * SIMPLIFICAÇÃO CONHECIDA: só olha o pin em que a commodity entra; não propaga a
 * contrapressão de um store intermediário cheio para a cascata do tier seguinte.
 */
function computeOverflowFractionByType(
  layout: PiColonyLayout,
  incoming: ThroughputByPin
): Map<number, number> {
  const stores = buildStoreNodes(layout)
  const storePinIds = new Set(stores.map((s) => s.pinId))
  const fullPinIds = new Set(
    stores.filter((s) => s.capacityM3 > 0 && s.usedM3 >= s.capacityM3).map((s) => s.pinId)
  )

  const totalByType = new Map<number, number>()
  const fullByType = new Map<number, number>()
  for (const [pinId, byType] of incoming) {
    if (!storePinIds.has(pinId)) continue
    for (const [typeId, rate] of byType) {
      totalByType.set(typeId, (totalByType.get(typeId) ?? 0) + rate)
      if (fullPinIds.has(pinId)) {
        fullByType.set(typeId, (fullByType.get(typeId) ?? 0) + rate)
      }
    }
  }

  const fraction = new Map<number, number>()
  for (const [typeId, total] of totalByType) {
    if (total <= 0) continue
    fraction.set(typeId, Math.min(1, Math.max(0, (fullByType.get(typeId) ?? 0) / total)))
  }
  return fraction
}

function highestProducedTier(producedTypeIds: Set<number>): number {
  let max = -1
  for (const typeId of producedTypeIds) max = Math.max(max, getCommodityTier(typeId) ?? -1)
  return max
}

function isFinalProductType(typeId: number, producedTypeIds: Set<number>): boolean {
  const tier = getCommodityTier(typeId) ?? -1
  if (tier < 0) return false
  return tier === highestProducedTier(producedTypeIds)
}

function buildBalances(input: {
  demandPerHour: Map<number, number>
  extractionPerHour: Map<number, number>
  productionPerHour: Map<number, number>
  exportableSet: Set<number>
  importedSet: Set<number>
  routedToExport: Set<number>
  producedTypeIds: Set<number>
  /** true = a visão assume que o insumo importado chega (a "designed"). */
  assumeImports: boolean
  overflowWastedByType?: Map<number, number>
}): CommodityBalance[] {
  const {
    demandPerHour,
    extractionPerHour,
    productionPerHour,
    exportableSet,
    importedSet,
    routedToExport,
    producedTypeIds,
    assumeImports,
    overflowWastedByType,
  } = input

  const allTypeIds = new Set<number>([
    ...demandPerHour.keys(),
    ...extractionPerHour.keys(),
    ...productionPerHour.keys(),
    ...exportableSet,
    ...importedSet,
    ...(overflowWastedByType?.keys() ?? []),
  ])

  const balances: CommodityBalance[] = []

  for (const typeId of allTypeIds) {
    const demand = demandPerHour.get(typeId) ?? 0
    const extraction = extractionPerHour.get(typeId) ?? 0
    const production = productionPerHour.get(typeId) ?? 0
    const overflowWasted = overflowWastedByType?.get(typeId) ?? 0
    const localSupply = extraction + production
    // "A demanda supera a oferta?" NÃO pode ser julgada pela oferta já descontada
    // do overflow: um store de destino cheio significa que esta commodity está
    // ABUNDANTE (é por isso que encheu), não escassa. Devolvemos a parcela perdida
    // só para esta checagem; `localSupply` (sem ela) continua limitando o lado de
    // exportação/sobra, já que o perdido de fato não vira sobra vendável.
    const localSupplyForDemand = localSupply + overflowWasted

    let importNeeded = Math.max(0, demand - localSupplyForDemand)
    let surplus = Math.max(0, localSupply - demand)

    if (!assumeImports) {
      importNeeded = importedSet.has(typeId) ? importNeeded : 0
      if (importNeeded <= 0 && demand > localSupply) surplus = 0
    }

    const isExportable = exportableSet.has(typeId)
    let exported = 0
    let wasted = 0

    if (isExportable && surplus > 0) {
      exported = routedToExport.has(typeId) ? surplus : 0
      const isFinal = isFinalProductType(typeId, producedTypeIds)
      wasted = isFinal && exported < surplus ? surplus - exported : 0
    }

    wasted += overflowWasted

    balances.push({
      typeId,
      name: getCommodityName(typeId),
      tier: getCommodityTier(typeId),
      demandPerHour: demand,
      extractionPerHour: extraction,
      productionPerHour: production,
      localSupplyPerHour: localSupply,
      importNeededPerHour: importNeeded,
      surplusPerHour: surplus,
      exportedPerHour: exported,
      wastedPerHour: wasted,
      isImported: importedSet.has(typeId),
      isExportable,
    })
  }

  balances.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name))
  return balances
}

export function computeDemandModel(layout: PiColonyLayout, nowMs: number): DemandModel {
  const { designed: extractionDesigned, current: extractionCurrent } = computeExtractionRates(
    layout,
    nowMs
  )
  const incoming = incomingThroughput(layout)
  const factory = computeFactoryDemand(layout, incoming)
  const currentCascade = cascadeCurrentProduction(
    extractionCurrent,
    factory.schematicCounts,
    layout,
    incoming
  )

  // Uma colônia-FÁBRICA (sem extrator) só roda com insumo comprado no mercado, e
  // seu "current" SEM imports seria um 0 sem significado. Para ela o current é a
  // taxa desenhada alimentada por import; colônias COM extrator mantêm o current
  // limitado pela extração (para extrator vencido/fraco aparecer baixo mesmo).
  const importDependent = !layout.pins.some((p) => pinRole(p.type_id) === 'extractor')
  const currentProduction = importDependent
    ? factory.productionPerHour
    : currentCascade.productionPerHour
  const currentDemand = importDependent ? factory.demandPerHour : currentCascade.demandPerHour

  const localSupplyDesigned = new Set<number>([
    ...extractionDesigned.keys(),
    ...factory.productionPerHour.keys(),
  ])
  const localSupplyCurrent = new Set<number>([
    ...extractionCurrent.keys(),
    ...currentProduction.keys(),
  ])

  const exportableSet = exportableTypeIds(
    layout,
    factory.producedTypeIds,
    factory.recipeInputTypeIds,
    getCommodityTier
  )
  const importedSetDesigned = importedTypeIds(layout, localSupplyDesigned)
  const importedSetCurrent = importedTypeIds(layout, localSupplyCurrent)
  const routedToExport = terminalExportTypeIds(buildRouteEdges(layout))

  const designed = buildBalances({
    demandPerHour: factory.demandPerHour,
    extractionPerHour: extractionDesigned,
    productionPerHour: factory.productionPerHour,
    exportableSet,
    importedSet: importedSetDesigned,
    routedToExport,
    producedTypeIds: factory.producedTypeIds,
    assumeImports: true,
  })

  // Desconta do CURRENT a parcela cujo store de destino já está cheio agora.
  // Nunca aplicado ao `designed`, que segue com os mapas originais intactos.
  const overflowFraction = computeOverflowFractionByType(layout, incoming)
  const overflowWastedByType = new Map<number, number>()
  const applyOverflowReduction = (source: Map<number, number>): Map<number, number> => {
    const adjusted = new Map<number, number>()
    for (const [typeId, rawRate] of source) {
      const wastedRate = rawRate * (overflowFraction.get(typeId) ?? 0)
      adjusted.set(typeId, rawRate - wastedRate)
      if (wastedRate > 0) {
        overflowWastedByType.set(typeId, (overflowWastedByType.get(typeId) ?? 0) + wastedRate)
      }
    }
    return adjusted
  }
  const currentProductionAdjusted = applyOverflowReduction(currentProduction)
  const extractionCurrentAdjusted = applyOverflowReduction(extractionCurrent)

  const current = buildBalances({
    demandPerHour: currentDemand,
    extractionPerHour: extractionCurrentAdjusted,
    productionPerHour: currentProductionAdjusted,
    exportableSet,
    importedSet: importedSetCurrent,
    routedToExport,
    producedTypeIds: factory.producedTypeIds,
    assumeImports: importDependent,
    overflowWastedByType,
  })

  return {
    designed,
    current,
    producedTypeIds: factory.producedTypeIds,
    recipeInputTypeIds: factory.recipeInputTypeIds,
    localSupplyTypeIds: localSupplyDesigned,
    exportableTypeIds: exportableSet,
    importedTypeIds: importedSetDesigned,
  }
}
