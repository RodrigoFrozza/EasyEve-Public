import {
  averageUnitsPerHour,
  calculateExtractorProgramTotalOutput,
  isExtractorExpired,
} from '@/lib/pi/extractor-decay'
import { buildPinNodes, simulateBufferStatus, simulatePinBufferStatuses } from '@/lib/pi/buffer-sim'
import { classifyColonyRole } from '@/lib/pi/colony-role'
import { computeDemandModel, exportRateForValuation, type PiCommodityBalance } from '@/lib/pi/demand-model'
import {
  computeColonyEconomics,
  collectMissingPriceWarnings,
  customsTaxPerHour,
  DEFAULT_PI_EXPORT_TAX_RATE,
  DEFAULT_PI_PRICING_MODE,
  exportUnitPrice,
  importUnitPrice,
  type PiPriceMap,
  type PiPricingOptions,
} from '@/lib/pi/pi-pricing'
import { highestExportTier, isFinalExportBalance } from '@/lib/pi/export-tiers'
import {
  getCommodityName,
  getPinRole,
  getSchematicById,
  PLANET_TYPES,
  type PiCommodityTier,
} from '@/lib/pi/pi-static-data'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import { computeColonyGrid } from '@/lib/pi/pi-grid'
import { buildRouteEdges, buildRoutingView, getTerminalExportTypeIds } from '@/lib/pi/route-graph'
import type {
  PiColonyAnalysis,
  PiColonyLayout,
  PiColonySummary,
  PiCommodityFlow,
  PiExtractorView,
  PiPlanetConfigView,
  PiRecipeView,
} from '@/lib/pi/types'

const STALE_MS = 24 * 60 * 60 * 1000

function schematicOutputPerHour(schematicId: number, factoryCount = 1): number {
  const sch = getSchematicById(schematicId)
  if (!sch || sch.cycleTimeSec <= 0) return 0
  return (sch.output.qty / sch.cycleTimeSec) * 3_600 * factoryCount
}

function resolveSchematicId(pin: {
  schematic_id?: number
  factory_details?: { schematic_id?: number }
}): number | undefined {
  const fromFactory = pin.factory_details?.schematic_id
  if (typeof fromFactory === 'number' && fromFactory > 0) return fromFactory
  if (typeof pin.schematic_id === 'number' && pin.schematic_id > 0) return pin.schematic_id
  return undefined
}

function isProcessorRole(role: ReturnType<typeof getPinRole>): boolean {
  return (
    role === 'basic_processor' ||
    role === 'advanced_processor' ||
    role === 'high_tech_processor'
  )
}

function tierRank(tier?: PiCommodityTier): number {
  return tier ?? -1
}

function defaultConfig(planetId: number): PiPlanetConfigView {
  return { planetId, surplusForSale: true }
}

function balancesToCommodities(
  potential: ReturnType<typeof computeDemandModel>['potential'],
  current: ReturnType<typeof computeDemandModel>['current']
): PiCommodityFlow[] {
  const byType = new Map<number, PiCommodityFlow>()

  for (const balance of potential) {
    let role: PiCommodityFlow['role'] = 'produced'
    if (balance.isImported) role = 'imported'
    else if (balance.extractionPerHour > 0 && balance.productionPerHour <= 0) role = 'extracted'
    else if (balance.exportedPerHour > 0) role = 'exported'
    else if (balance.demandPerHour > 0 && balance.productionPerHour > 0) role = 'internal'
    else if (balance.surplusPerHour > 0) role = 'surplus'
    else if (balance.wastedPerHour > 0) role = 'wasted'

    byType.set(balance.typeId, {
      typeId: balance.typeId,
      name: balance.name,
      tier: balance.tier,
      extractedPerHour: balance.extractionPerHour > 0 ? balance.extractionPerHour : undefined,
      producedPerHour: balance.productionPerHour > 0 ? balance.productionPerHour : undefined,
      usedInternallyPerHour: balance.demandPerHour > 0 ? balance.demandPerHour : undefined,
      exportedPerHour: balance.exportedPerHour > 0 ? balance.exportedPerHour : undefined,
      importNeededPerHour: balance.importNeededPerHour > 0 ? balance.importNeededPerHour : undefined,
      surplusPerHour: balance.surplusPerHour > 0 ? balance.surplusPerHour : undefined,
      wastedPerHour: balance.wastedPerHour > 0 ? balance.wastedPerHour : undefined,
      potentialExportedPerHour: balance.exportedPerHour > 0 ? balance.exportedPerHour : undefined,
      role,
    })
  }

  for (const balance of current) {
    const existing = byType.get(balance.typeId)
    if (existing) {
      existing.currentExportedPerHour =
        balance.exportedPerHour > 0 ? balance.exportedPerHour : undefined
    }
  }

  return [...byType.values()].sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name)
  )
}

export interface AnalyzeColonyInput {
  characterId: number
  characterName: string
  summary: PiColonySummary
  layout: PiColonyLayout
  solarSystemName: string
  config?: PiPlanetConfigView
  nowMs?: number
  /** Restock cadence (hours) driving the starving/overflow alert thresholds. */
  visitCadenceHrs?: number
  /**
   * Motor de projeção (Fase A). Quando ON, os buffers avançam o estoque do
   * snapshot até `nowMs`. OFF (padrão) = comportamento atual idêntico.
   */
  projectionEnabled?: boolean
}

export function analyzeColonyLayout(input: AnalyzeColonyInput): PiColonyAnalysis {
  const nowMs = input.nowMs ?? Date.now()
  const projectionEnabled = input.projectionEnabled ?? false
  const warnings: string[] = []
  const { layout, summary } = input
  const config = input.config ?? defaultConfig(summary.planet_id)

  const factoryPins = layout.pins.filter((p) => isProcessorRole(getPinRole(p.type_id)))
  const extractorPins = layout.pins.filter((p) => getPinRole(p.type_id) === 'extractor')

  const schematicCounts = new Map<number, number>()
  for (const pin of factoryPins) {
    const sid = resolveSchematicId(pin)
    if (sid) schematicCounts.set(sid, (schematicCounts.get(sid) ?? 0) + 1)
  }

  const extractors: PiExtractorView[] = extractorPins.map((pin) => {
    const details = pin.extractor_details
    const productTypeId = details?.product_type_id ?? 0
    const qtyPerCycle = details?.qty_per_cycle ?? 0
    const cycleTimeSec = details?.cycle_time ?? 0
    const expired = isExtractorExpired(pin.expiry_time, nowMs)

    const programHours =
      pin.install_time && pin.expiry_time
        ? (Date.parse(pin.expiry_time) - Date.parse(pin.install_time)) / 3_600_000
        : 0

    const programTotal =
      qtyPerCycle > 0 && cycleTimeSec > 0 && programHours > 0
        ? calculateExtractorProgramTotalOutput(
            qtyPerCycle,
            cycleTimeSec,
            pin.install_time,
            pin.expiry_time
          )
        : 0

    const designedUnitsPerHour = programHours > 0 ? programTotal / programHours : 0
    const currentUnitsPerHour = expired
      ? 0
      : averageUnitsPerHour(qtyPerCycle, cycleTimeSec, pin.install_time, pin.expiry_time, nowMs)

    if (expired) {
      warnings.push(`Extractor on pin ${pin.pin_id} program expired — current output is 0 until resurvey.`)
    }
    if (qtyPerCycle <= 0) {
      warnings.push(
        `Extractor on pin ${pin.pin_id} has no active program (qty_per_cycle missing). Open colony in-game and Submit.`
      )
    }

    return {
      pinId: pin.pin_id,
      productTypeId,
      productName: getCommodityName(productTypeId),
      qtyPerCycle,
      cycleTimeSec,
      installTime: pin.install_time,
      expiryTime: pin.expiry_time,
      isExpired: expired,
      designedUnitsPerHour,
      currentUnitsPerHour,
    }
  })

  const recipes: PiRecipeView[] = []
  for (const [schematicId, count] of schematicCounts) {
    const sch = getSchematicById(schematicId)
    if (!sch) {
      warnings.push(`Unknown schematic ${schematicId} — recipe data missing from SDE.`)
      continue
    }
    const samplePin = factoryPins.find((p) => resolveSchematicId(p) === schematicId)
    recipes.push({
      schematicId,
      name: sch.name,
      cycleTimeSec: sch.cycleTimeSec,
      pinId: samplePin?.pin_id ?? 0,
      pinRole: samplePin ? getPinRole(samplePin.type_id) : 'unknown',
      inputs: sch.inputs.map((i) => ({
        typeId: i.typeId,
        name: getCommodityName(i.typeId),
        qty: i.qty,
        tier: getCommodityTier(i.typeId),
      })),
      output: {
        typeId: sch.output.typeId,
        name: getCommodityName(sch.output.typeId),
        qty: sch.output.qty,
        tier: getCommodityTier(sch.output.typeId),
      },
      designedOutputPerHour: schematicOutputPerHour(schematicId, count),
    })
  }

  const demand = computeDemandModel(layout, nowMs)
  const edges = buildRouteEdges(layout)
  const routedToExport = getTerminalExportTypeIds(edges)

  for (const edge of edges) {
    if (edge.kind === 'extractorToFactory') {
      warnings.push(
        `Route ${getCommodityName(edge.typeId)} (pin ${edge.sourcePinId} → ${edge.destPinId}): extractor connects directly to factory — route through storage or launchpad.`
      )
    }
    if (edge.kind === 'factoryToFactory') {
      warnings.push(
        `Route ${getCommodityName(edge.typeId)} (pin ${edge.sourcePinId} → ${edge.destPinId}): factory connects directly to factory — use buffer storage between stages.`
      )
    }
  }

  for (const balance of demand.potential) {
    if (
      balance.isExportable &&
      balance.productionPerHour > 0 &&
      balance.exportedPerHour <= 0 &&
      !routedToExport.has(balance.typeId)
    ) {
      warnings.push(
        `${balance.name}: production is not routed to launchpad — export revenue requires a route to storage or launchpad.`
      )
    }
  }

  const wastedCommodities = demand.potential
    .filter((b) => b.wastedPerHour > 0)
    .map((b) => b.name)
  if (wastedCommodities.length > 0) {
    warnings.push(
      `Wasted production: ${wastedCommodities.join(', ')} — add buffers or fix routes.`
    )
  }

  const routing = buildRoutingView(layout, edges)
  const pins = buildPinNodes(layout)
  const visitCadenceHrs = input.visitCadenceHrs
  const pinBuffersPotential = simulatePinBufferStatuses({
    layout,
    balances: demand.potential,
    assumeImports: true,
    routing,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate: summary.last_update,
  })
  // Cap the "current" buffer inflow to what's actually being produced/extracted
  // now, so an idle colony (expired extractors, stalled factories) doesn't report
  // a designed inflow and a bogus "full in" time.
  const currentInflowCap = new Map(
    demand.current.map((b) => [
      b.typeId,
      Math.max(0, b.productionPerHour, b.extractionPerHour, b.exportedPerHour),
    ])
  )
  // Outflow cap = current consumption (demandPerHour) so a colony that isn't
  // actually producing doesn't show its input buffer "draining".
  const currentOutflowCap = new Map(
    demand.current.map((b) => [b.typeId, Math.max(0, b.demandPerHour)])
  )
  const pinBuffersCurrent = simulatePinBufferStatuses({
    layout,
    balances: demand.current,
    assumeImports: false,
    routing,
    inflowCapByType: currentInflowCap,
    outflowCapByType: currentOutflowCap,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate: summary.last_update,
  })
  const bufferStatus = simulateBufferStatus({
    layout,
    balances: demand.potential,
    edges,
    routing,
    assumeImports: true,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate: summary.last_update,
  })
  const bufferStatusCurrent = simulateBufferStatus({
    layout,
    balances: demand.current,
    edges,
    routing,
    assumeImports: false,
    inflowCapByType: currentInflowCap,
    outflowCapByType: currentOutflowCap,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate: summary.last_update,
  })

  const commodities = balancesToCommodities(demand.potential, demand.current)

  const entryCandidates = commodities.filter(
    (c) => (c.extractedPerHour ?? 0) > 0 || c.role === 'imported'
  )
  const entry =
    entryCandidates.length > 0
      ? entryCandidates.reduce((best, c) => (tierRank(c.tier) < tierRank(best.tier) ? c : best))
      : undefined

  const exportedCommodities = commodities.filter(
    (c) => (c.potentialExportedPerHour ?? 0) > 0 || (c.currentExportedPerHour ?? 0) > 0
  )
  const exit =
    exportedCommodities.length > 0
      ? exportedCommodities.reduce((best, c) => (tierRank(c.tier) > tierRank(best.tier) ? c : best))
      : commodities
          .filter((c) => (c.producedPerHour ?? 0) > 0)
          .reduce<
            PiCommodityFlow | undefined
          >((best, c) => (!best || tierRank(c.tier) > tierRank(best.tier) ? c : best), undefined)

  const lastUpdateMs = summary.last_update ? Date.parse(summary.last_update) : NaN
  const isStale = !Number.isFinite(lastUpdateMs) || nowMs - lastUpdateMs > STALE_MS
  if (isStale) {
    warnings.push('Colony data may be stale — ESI updates only after you view the colony in-game.')
  }

  const colonyRole = classifyColonyRole(layout)

  return {
    characterId: input.characterId,
    characterName: input.characterName,
    planetId: summary.planet_id,
    planetType: summary.planet_type,
    planetTypeLabel: PLANET_TYPES[summary.planet_type] ?? summary.planet_type,
    colonyRole,
    solarSystemId: summary.solar_system_id,
    solarSystemName: input.solarSystemName,
    upgradeLevel: summary.upgrade_level ?? 0,
    numPins: summary.num_pins ?? layout.pins.length,
    lastUpdate: summary.last_update,
    isStale,
    projectionEnabled,
    entryTypeId: entry?.typeId,
    entryName: entry?.name,
    entryTier: entry?.tier,
    exitTypeId: exit?.typeId,
    exitName: exit?.name,
    exitTier: exit?.tier,
    potentialNetIskPerHour: 0,
    currentNetIskPerHour: 0,
    exportRevenuePerHour: 0,
    importCostPerHour: 0,
    potentialExportRevenuePerHour: 0,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 0,
    currentImportCostPerHour: 0,
    exitUnitPrice: 0,
    config,
    balances: {
      potential: demand.potential,
      current: demand.current,
    },
    pins,
    bufferStatus,
    bufferStatusCurrent,
    pinBuffers: {
      potential: pinBuffersPotential,
      current: pinBuffersCurrent,
    },
    extractors,
    recipes,
    commodities,
    routing,
    warnings,
    grid: computeColonyGrid(layout, summary.upgrade_level ?? 0),
  }
}

function applyBalanceIskValues(
  balances: PiCommodityBalance[],
  exitTypeId: number | undefined,
  surplusForSale: boolean,
  prices: PiPriceMap,
  exportTaxRate: number,
  pricingMode: typeof DEFAULT_PI_PRICING_MODE,
  requireExportRoute = false,
  importTaxRate = exportTaxRate,
  provenance?: PiPricingOptions['provenance']
): PiCommodityBalance[] {
  const highestTier = highestExportTier(balances, exitTypeId)
  return balances.map((balance) => {
    const sell = exportUnitPrice(prices, balance.typeId, pricingMode)
    const buy = importUnitPrice(prices, balance.typeId, pricingMode)
    const isFinal = isFinalExportBalance(balance, highestTier, exitTypeId)
    const exportRate = exportRateForValuation(balance, exitTypeId, surplusForSale, {
      isFinalTierProduct: isFinal,
      requireExportRoute,
    })
    // Net export ISK = market revenue − customs tax (on base value). Material at
    // market; only the tax uses the per-tier base value.
    const exportGross = exportRate > 0 && sell > 0 ? exportRate * sell : 0
    const exportIsk =
      exportGross > 0 ? exportGross - customsTaxPerHour(exportRate, balance.typeId, exportTaxRate) : 0
    const importIsk =
      balance.importNeededPerHour > 0 && buy > 0
        ? balance.importNeededPerHour * buy +
          customsTaxPerHour(balance.importNeededPerHour, balance.typeId, importTaxRate, {
            isImport: true,
          })
        : 0
    const origin = provenance?.[balance.typeId]
    // Imports read the buy origin; exports read the sell origin.
    const priceOrigin =
      balance.importNeededPerHour > 0 ? origin?.buy : exportIsk > 0 ? origin?.sell : undefined
    return {
      ...balance,
      exportIskPerHour: exportIsk > 0 ? exportIsk : undefined,
      importIskPerHour: importIsk > 0 ? importIsk : undefined,
      ...(priceOrigin && priceOrigin !== 'none' ? { priceOrigin } : {}),
    }
  })
}

export function applyColonyPricing(
  analysis: PiColonyAnalysis,
  prices: PiPriceMap,
  options: PiPricingOptions = {}
): PiColonyAnalysis {
  const { config, balances } = analysis
  const exitTypeId = analysis.exitTypeId
  const exportTaxRate = options.exportTaxRate ?? DEFAULT_PI_EXPORT_TAX_RATE
  const importTaxRate = options.importTaxRate ?? exportTaxRate
  const provenance = options.provenance
  const pricingMode = options.pricingMode ?? DEFAULT_PI_PRICING_MODE
  const exitPrice = exitTypeId ? exportUnitPrice(prices, exitTypeId, pricingMode) : 0

  const potential = computeColonyEconomics(
    balances.potential,
    exitTypeId,
    config.surplusForSale,
    prices,
    exportTaxRate,
    pricingMode,
    false,
    importTaxRate
  )
  const current = computeColonyEconomics(
    balances.current,
    exitTypeId,
    config.surplusForSale,
    prices,
    exportTaxRate,
    pricingMode,
    true, // current = only value physically-routed export (A1)
    importTaxRate
  )

  const potentialNet = potential.exportRevenue - potential.importCost
  const currentNet = current.exportRevenue - current.importCost
  const priceWarnings = collectMissingPriceWarnings(analysis, prices, pricingMode)
  const warnings = [...new Set([...analysis.warnings, ...priceWarnings])]

  const extractors = analysis.extractors.map((ext) => {
    const productUnitPrice = exportUnitPrice(prices, ext.productTypeId, pricingMode)
    const lostUnitsPerHour = Math.max(0, ext.designedUnitsPerHour - ext.currentUnitsPerHour)
    const resurveyIskPerHour =
      lostUnitsPerHour > 0 && productUnitPrice > 0
        ? lostUnitsPerHour * productUnitPrice -
          customsTaxPerHour(lostUnitsPerHour, ext.productTypeId, exportTaxRate)
        : 0
    return {
      ...ext,
      productUnitPrice,
      resurveyIskPerHour: resurveyIskPerHour > 0 ? resurveyIskPerHour : undefined,
    }
  })

  return {
    ...analysis,
    extractors,
    exitUnitPrice: exitPrice,
    balances: {
      potential: applyBalanceIskValues(
        balances.potential,
        exitTypeId,
        config.surplusForSale,
        prices,
        exportTaxRate,
        pricingMode,
        false,
        importTaxRate,
        provenance
      ),
      current: applyBalanceIskValues(
        balances.current,
        exitTypeId,
        config.surplusForSale,
        prices,
        exportTaxRate,
        pricingMode,
        true, // current = only value physically-routed export (A1)
        importTaxRate,
        provenance
      ),
    },
    exportRevenuePerHour: potential.exportRevenue,
    importCostPerHour: potential.importCost,
    potentialExportRevenuePerHour: potential.exportRevenue,
    potentialImportCostPerHour: potential.importCost,
    currentExportRevenuePerHour: current.exportRevenue,
    currentImportCostPerHour: current.importCost,
    potentialExportTaxPerHour: potential.exportTax,
    potentialExportGrossPerHour: potential.exportGross,
    currentExportTaxPerHour: current.exportTax,
    currentExportGrossPerHour: current.exportGross,
    potentialNetIskPerHour: potentialNet,
    currentNetIskPerHour: currentNet,
    warnings,
  }
}

export function collectColonyTypeIds(analysis: PiColonyAnalysis): number[] {
  const ids = new Set<number>()
  if (analysis.exitTypeId) ids.add(analysis.exitTypeId)
  if (analysis.entryTypeId) ids.add(analysis.entryTypeId)
  for (const c of analysis.commodities) ids.add(c.typeId)
  for (const b of analysis.balances.potential) ids.add(b.typeId)
  for (const b of analysis.balances.current) ids.add(b.typeId)
  for (const r of analysis.recipes) {
    ids.add(r.output.typeId)
    for (const i of r.inputs) ids.add(i.typeId)
  }
  for (const e of analysis.extractors) {
    if (e.productTypeId > 0) ids.add(e.productTypeId)
  }
  return [...ids]
}
