import {
  averageUnitsPerHour,
  calculateExtractorProgramTotalOutput,
  isExtractorExpired,
} from '@/lib/pi/extractor-decay'
import {
  getCommodityName,
  getPinRole,
  getSchematicById,
} from '@/lib/pi/pi-static-data'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import {
  buildRouteEdges,
  exportedTypeIds,
  getTerminalExportTypeIds,
  importedTypeIds,
} from '@/lib/pi/route-graph'
import { buildPinNodes } from '@/lib/pi/pin-fill'
import type { PiColonyLayout, PiPin } from '@/lib/pi/types'

/** Where the price used for a commodity row came from. */
export type PriceOrigin = 'structure' | 'region' | 'jita' | 'reference' | 'none'

export interface PiCommodityBalance {
  typeId: number
  name: string
  tier?: ReturnType<typeof getCommodityTier>
  demandPerHour: number
  extractionPerHour: number
  productionPerHour: number
  localSupplyPerHour: number
  importNeededPerHour: number
  surplusPerHour: number
  exportedPerHour: number
  wastedPerHour: number
  isImported: boolean
  isExportable: boolean
  /** Post-tax export valuation for this commodity row (when priced). */
  exportIskPerHour?: number
  /** Import cost for this commodity row (when priced). */
  importIskPerHour?: number
  /** Origin of the price used for this row (buy for imports, sell for exports). */
  priceOrigin?: PriceOrigin
}

export interface DemandModelResult {
  potential: PiCommodityBalance[]
  current: PiCommodityBalance[]
  producedTypeIds: Set<number>
  recipeInputTypeIds: Set<number>
  localSupplyTypeIds: Set<number>
  exportableTypeIds: Set<number>
  importedTypeIds: Set<number>
}

function isProcessorRole(role: ReturnType<typeof getPinRole>): boolean {
  return (
    role === 'basic_processor' ||
    role === 'advanced_processor' ||
    role === 'high_tech_processor'
  )
}

function isExportStoreRole(role: ReturnType<typeof getPinRole>): boolean {
  return role === 'launchpad' || role === 'command_center' || role === 'storage'
}

function resolveSchematicId(pin: PiPin): number | undefined {
  const fromFactory = pin.factory_details?.schematic_id
  if (typeof fromFactory === 'number' && fromFactory > 0) return fromFactory
  if (typeof pin.schematic_id === 'number' && pin.schematic_id > 0) return pin.schematic_id
  return undefined
}

function pinOutputCycleTimeSec(pin: PiPin): number {
  const role = getPinRole(pin.type_id)
  if (role === 'extractor') {
    return pin.extractor_details?.cycle_time ?? 0
  }
  if (isProcessorRole(role)) {
    const schematicId = resolveSchematicId(pin)
    if (!schematicId) return 0
    return getSchematicById(schematicId)?.cycleTimeSec ?? 0
  }
  return 0
}

/** Max units/hour per incoming route batch (quantity / source cycle). */
export function computeIncomingRouteThroughput(
  layout: PiColonyLayout
): Map<number, Map<number, number>> {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const incoming = new Map<number, Map<number, number>>()

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest || route.quantity <= 0) continue

    const sourceRole = getPinRole(source.type_id)
    const destRole = getPinRole(dest.type_id)
    const cycleSec =
      isExportStoreRole(sourceRole) && isProcessorRole(destRole)
        ? pinOutputCycleTimeSec(dest)
        : pinOutputCycleTimeSec(source)
    if (cycleSec <= 0) continue

    const throughput = (route.quantity / cycleSec) * 3_600
    const byType = incoming.get(route.destination_pin_id) ?? new Map<number, number>()
    byType.set(
      route.content_type_id,
      (byType.get(route.content_type_id) ?? 0) + throughput
    )
    incoming.set(route.destination_pin_id, byType)
  }

  return incoming
}

/** Max units/hour per outgoing route from storage/launchpad (quantity / dest factory cycle). */
export function computeOutgoingRouteThroughput(
  layout: PiColonyLayout
): Map<number, Map<number, number>> {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const outgoing = new Map<number, Map<number, number>>()

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest || route.quantity <= 0) continue

    const sourceRole = getPinRole(source.type_id)
    if (
      sourceRole !== 'launchpad' &&
      sourceRole !== 'command_center' &&
      sourceRole !== 'storage'
    ) {
      continue
    }

    const cycleSec = pinOutputCycleTimeSec(dest)
    if (cycleSec <= 0) continue

    const throughput = (route.quantity / cycleSec) * 3_600
    const byType = outgoing.get(route.source_pin_id) ?? new Map<number, number>()
    byType.set(
      route.content_type_id,
      (byType.get(route.content_type_id) ?? 0) + throughput
    )
    outgoing.set(route.source_pin_id, byType)
  }

  return outgoing
}

function capFactoryOutputByRoutes(
  pinId: number,
  schematicId: number,
  factoryCount: number,
  incomingRoutes: Map<number, Map<number, number>>
): number {
  const sch = getSchematicById(schematicId)
  if (!sch) return 0

  let capped = schematicOutputPerHour(schematicId, factoryCount)
  const incoming = incomingRoutes.get(pinId)
  if (!incoming) return capped

  for (const inp of sch.inputs) {
    const routeLimit = incoming.get(inp.typeId)
    if (routeLimit == null) continue
    capped = Math.min(capped, (routeLimit / inp.qty) * sch.output.qty)
  }

  return Math.max(0, capped)
}

function schematicOutputPerHour(schematicId: number, factoryCount = 1): number {
  const sch = getSchematicById(schematicId)
  if (!sch || sch.cycleTimeSec <= 0) return 0
  return (sch.output.qty / sch.cycleTimeSec) * 3_600 * factoryCount
}

function tierRank(tier?: ReturnType<typeof getCommodityTier>): number {
  return tier ?? -1
}

function computeExtractionRates(
  layout: PiColonyLayout,
  nowMs: number
): { designed: Map<number, number>; current: Map<number, number> } {
  const designed = new Map<number, number>()
  const current = new Map<number, number>()

  for (const pin of layout.pins) {
    if (getPinRole(pin.type_id) !== 'extractor') continue
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
        ? calculateExtractorProgramTotalOutput(
            qtyPerCycle,
            cycleTimeSec,
            pin.install_time,
            pin.expiry_time
          )
        : 0

    const designedRate = programHours > 0 ? programTotal / programHours : 0
    const expired = isExtractorExpired(pin.expiry_time, nowMs)
    const currentRate = expired
      ? 0
      : averageUnitsPerHour(qtyPerCycle, cycleTimeSec, pin.install_time, pin.expiry_time, nowMs)

    designed.set(productTypeId, (designed.get(productTypeId) ?? 0) + designedRate)
    current.set(productTypeId, (current.get(productTypeId) ?? 0) + currentRate)
  }

  return { designed, current }
}

function computeFactoryDemand(
  layout: PiColonyLayout,
  incomingRoutes: Map<number, Map<number, number>>
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
    if (!isProcessorRole(getPinRole(pin.type_id))) continue
    const schematicId = resolveSchematicId(pin)
    if (!schematicId) continue

    schematicCounts.set(schematicId, (schematicCounts.get(schematicId) ?? 0) + 1)

    const sch = getSchematicById(schematicId)
    if (!sch) continue

    const outputRate = capFactoryOutputByRoutes(
      pin.pin_id,
      schematicId,
      1,
      incomingRoutes
    )
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

  return {
    demandPerHour,
    productionPerHour,
    producedTypeIds,
    recipeInputTypeIds,
    schematicCounts,
  }
}

function cascadeCurrentProduction(
  extractionCurrent: Map<number, number>,
  schematicCounts: Map<number, number>,
  layout: PiColonyLayout,
  incomingRoutes: Map<number, Map<number, number>>
): { productionPerHour: Map<number, number>; demandPerHour: Map<number, number> } {
  const productionPerHour = new Map<number, number>()
  const demandPerHour = new Map<number, number>()
  const available = new Map<number, number>(extractionCurrent)

  const factoryPinsBySchematic = new Map<number, number[]>()
  for (const pin of layout.pins) {
    if (!isProcessorRole(getPinRole(pin.type_id))) continue
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
        capFactoryOutputByRoutes(pinId, schematicId, 1, incomingRoutes)
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
      const maxFromInput = (availableUnits / inp.qty) * recipe.sch.output.qty
      limitingRate = Math.min(limitingRate, maxFromInput)
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
 * Fraction (0..1) of each commodity's TOTAL designed inbound route throughput
 * INTO EXPORT-STORE PINS (storage/launchpad/command_center) that currently
 * targets a destination store which is already at capacity right now
 * (freeM3 <= 0, from the live ESI snapshot — not a projection). Used to
 * discount "current" production/extraction: per docs/PI_DOMAIN_GUIDE.md §4.2,
 * factories/extractors do not buffer their own output — a destination with no
 * room means that share of the output is lost, not merely delayed.
 *
 * SCOPING: only routes whose destination is itself a store pin count toward
 * either the numerator or the denominator. Routes into processor/factory pins
 * are a downstream factory PULLING this commodity as its own recipe input —
 * a separate consumption flow, not part of "can the producer's delivery be
 * absorbed" — and are excluded entirely. Mixing them into the denominator
 * would dilute the fraction: in the standard, docs-recommended topology
 * (producer → store → next-tier factory → store), every intermediate
 * commodity has exactly this shape, so including the pull route would
 * under-count the waste in the common case.
 *
 * KNOWN SIMPLIFICATION: this only checks the pin the commodity itself routes
 * into. It does not propagate a full intermediate store's back-pressure into
 * a downstream tier's cascade availability (e.g. a full P1 storage should in
 * full rigor also cap how much P1 a P2 factory can draw) — that would require
 * re-deriving the tier cascade with live fill state and is out of scope here.
 */
function computeOverflowFractionByType(
  layout: PiColonyLayout,
  incomingRoutes: Map<number, Map<number, number>>
): Map<number, number> {
  const pins = buildPinNodes(layout) // storage/launchpad/command_center pins only
  const storePinIds = new Set(pins.map((p) => p.pinId))
  const fullPinIds = new Set(pins.filter((p) => p.capacityM3 > 0 && p.usedM3 >= p.capacityM3).map((p) => p.pinId))

  const totalByType = new Map<number, number>()
  const fullByType = new Map<number, number>()
  for (const [pinId, byType] of incomingRoutes) {
    if (!storePinIds.has(pinId)) continue // only routes landing IN A STORE count — a downstream factory pulling this commodity as its own input is a different flow, not part of "can the producer's delivery be absorbed"
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
    const full = fullByType.get(typeId) ?? 0
    fraction.set(typeId, Math.min(1, Math.max(0, full / total)))
  }
  return fraction
}

function highestProducedTier(producedTypeIds: Set<number>): number {
  let max = -1
  for (const typeId of producedTypeIds) {
    max = Math.max(max, getCommodityTier(typeId) ?? -1)
  }
  return max
}

function isFinalProductType(typeId: number, producedTypeIds: Set<number>): boolean {
  const tier = getCommodityTier(typeId) ?? -1
  if (tier < 0) return false
  return tier === highestProducedTier(producedTypeIds)
}

function buildBalances(
  demandPerHour: Map<number, number>,
  extractionPerHour: Map<number, number>,
  productionPerHour: Map<number, number>,
  exportableSet: Set<number>,
  importedSet: Set<number>,
  routedToExport: Set<number>,
  producedTypeIds: Set<number>,
  assumeImports: boolean,
  overflowWastedByType?: Map<number, number>
): PiCommodityBalance[] {
  const allTypeIds = new Set<number>([
    ...demandPerHour.keys(),
    ...extractionPerHour.keys(),
    ...productionPerHour.keys(),
    ...exportableSet,
    ...importedSet,
    ...(overflowWastedByType?.keys() ?? []),
  ])

  const balances: PiCommodityBalance[] = []

  for (const typeId of allTypeIds) {
    const demand = demandPerHour.get(typeId) ?? 0
    const extraction = extractionPerHour.get(typeId) ?? 0
    const production = productionPerHour.get(typeId) ?? 0
    const overflowWasted = overflowWastedByType?.get(typeId) ?? 0
    const localSupply = extraction + production
    // "Does downstream demand exceed what's available" must NOT be judged from
    // the overflow-reduced supply: a full destination store means this commodity
    // is ABUNDANT (that's why it's full), not scarce — losing the undeliverable
    // share to a full store doesn't remove it from what's already sitting there
    // for another factory to pull from. Add the overflow-wasted share back in
    // for this check only; `localSupply` (without it) still gates the export/
    // surplus side below, since the wasted share genuinely isn't available to
    // become sellable surplus.
    const localSupplyForDemand = localSupply + overflowWasted

    let importNeeded = Math.max(0, demand - localSupplyForDemand)
    let surplus = Math.max(0, localSupply - demand)

    if (!assumeImports) {
      importNeeded = importedSet.has(typeId) ? importNeeded : 0
      if (importNeeded <= 0 && demand > localSupply) {
        surplus = 0
      }
    }

    const isExportable = exportableSet.has(typeId)
    let exported = 0
    let wasted = 0

    if (isExportable) {
      if (surplus > 0) {
        exported = routedToExport.has(typeId) ? surplus : 0
        const isFinal = isFinalProductType(typeId, producedTypeIds)
        wasted = isFinal && exported < surplus ? surplus - exported : 0
      }
    } else if (surplus > 0) {
      wasted = 0
    }

    wasted += overflowWastedByType?.get(typeId) ?? 0

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

export function computeDemandModel(
  layout: PiColonyLayout,
  nowMs: number
): DemandModelResult {
  const { designed: extractionDesigned, current: extractionCurrent } =
    computeExtractionRates(layout, nowMs)
  const incomingRoutes = computeIncomingRouteThroughput(layout)
  const factory = computeFactoryDemand(layout, incomingRoutes)
  const currentCascade = cascadeCurrentProduction(
    extractionCurrent,
    factory.schematicCounts,
    layout,
    incomingRoutes
  )

  // A factory-only colony (no extractor pins) only ever runs on market imports,
  // so its "current" rate WITHOUT imports is a meaningless 0. Use the designed
  // import-fed rate for its current; colonies WITH extractors keep the
  // extraction-limited current (so expired/weak extractors still read low).
  const importDependent = !layout.pins.some((p) => getPinRole(p.type_id) === 'extractor')
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

  const exportableSet = exportedTypeIds(
    layout,
    factory.producedTypeIds,
    factory.recipeInputTypeIds
  )
  const importedSetDesigned = importedTypeIds(layout, localSupplyDesigned)
  const importedSetCurrent = importedTypeIds(layout, localSupplyCurrent)
  const routedToExport = getTerminalExportTypeIds(buildRouteEdges(layout))

  const potential = buildBalances(
    factory.demandPerHour,
    extractionDesigned,
    factory.productionPerHour,
    exportableSet,
    importedSetDesigned,
    routedToExport,
    factory.producedTypeIds,
    true
  )

  // Discount CURRENT-mode production/extraction by the share whose destination
  // store is already full right now — per docs/PI_DOMAIN_GUIDE.md §4.2, factories
  // and extractors do not buffer their own output, so that share is lost, not
  // merely delayed. Never applied to `potential` (the unconstrained projection),
  // which keeps using the original `extractionDesigned`/`factory.productionPerHour`
  // maps above, untouched.
  const overflowFraction = computeOverflowFractionByType(layout, incomingRoutes)
  const overflowWastedByType = new Map<number, number>()
  const applyOverflowReduction = (source: Map<number, number>): Map<number, number> => {
    const adjusted = new Map<number, number>()
    for (const [typeId, rawRate] of source) {
      const fraction = overflowFraction.get(typeId) ?? 0
      const wastedRate = rawRate * fraction
      adjusted.set(typeId, rawRate - wastedRate)
      if (wastedRate > 0) {
        overflowWastedByType.set(typeId, (overflowWastedByType.get(typeId) ?? 0) + wastedRate)
      }
    }
    return adjusted
  }
  const currentProductionAdjusted = applyOverflowReduction(currentProduction)
  const extractionCurrentAdjusted = applyOverflowReduction(extractionCurrent)

  const current = buildBalances(
    currentDemand,
    extractionCurrentAdjusted,
    currentProductionAdjusted,
    exportableSet,
    importedSetCurrent,
    routedToExport,
    factory.producedTypeIds,
    importDependent,
    overflowWastedByType
  )

  return {
    potential,
    current,
    producedTypeIds: factory.producedTypeIds,
    recipeInputTypeIds: factory.recipeInputTypeIds,
    localSupplyTypeIds: localSupplyDesigned,
    exportableTypeIds: exportableSet,
    importedTypeIds: importedSetDesigned,
  }
}

/** Rate that counts toward export revenue / network supply (never raw surplusPerHour). */
export function exportRateForValuation(
  balance: PiCommodityBalance,
  exitTypeId: number | undefined,
  surplusForSale: boolean,
  options?: { isFinalTierProduct?: boolean; requireExportRoute?: boolean }
): number {
  const isExit = exitTypeId != null && balance.typeId === exitTypeId
  const isFinalTierProduct = options?.isFinalTierProduct ?? isExit

  if (balance.exportedPerHour > 0) return balance.exportedPerHour

  // "current" (real-now) valuation credits ONLY production physically routed to
  // export. Unrouted final-tier/exit output and unrouted flagged surplus below
  // remain optimistic — counted in the "potential" projection only.
  if (options?.requireExportRoute) return 0

  if (isFinalTierProduct && balance.productionPerHour > 0) {
    return balance.productionPerHour
  }

  if (isExit && balance.productionPerHour > 0) {
    return balance.productionPerHour
  }

  if (!surplusForSale) return 0
  if (!balance.isExportable) return 0

  // Surplus the colony isn't currently routing to export but the operator has flagged
  // as sellable — value it directly instead of silently treating it as worthless (which
  // made the surplusForSale toggle a no-op and undervalued standalone colonies relative
  // to the same colony placed in a network, where this same surplus IS counted).
  return balance.surplusPerHour > 0 ? balance.surplusPerHour : 0
}
