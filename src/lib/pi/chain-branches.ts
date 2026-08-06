import type { PiCommodityBalance } from '@/lib/pi/demand-model'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import { buildPlanetPins } from '@/lib/pi/export-tiers'
import type { PiPinRole } from '@/lib/pi/pi-static-data'
import type { PiColonyAnalysis, PiPinView, PiRecipeView } from '@/lib/pi/types'
import { groupedPinDisplayLabel } from '@/lib/pi/pin-labels'
import { getCommodityName, getSchematicById } from '@/lib/pi/pi-static-data'

function tierForType(typeId: number): PiCommodityBalance['tier'] | undefined {
  return getCommodityTier(typeId)
}

export interface FlowLine {
  typeId: number
  name: string
  tier?: PiCommodityBalance['tier']
  unitsPerHour: number
  peerLabels: string[]
  routeQuantity?: number
  sourceKind?: 'import' | 'extractor' | 'factory'
}

export interface PinLineNode {
  pin: PiPinView
  receives: FlowLine[]
  produces: FlowLine[]
  /** Pin ids represented by this node (merged groups include all pins) */
  pinIds: number[]
  /** When multiple pins share the same flow, merged count */
  groupCount?: number
  /** Label for merged pin group (e.g. Basic Factory 1–6) */
  displayLabel?: string
}

export interface ProductionLineStages {
  input: PinLineNode[]
  production: PinLineNode[]
  export: PinLineNode[]
  virtual: VirtualFlowNode[]
}

export type VirtualFlowKind = 'import' | 'export' | 'surplus'

export interface VirtualFlowNode {
  kind: VirtualFlowKind
  flows: FlowLine[]
}

function isProcessorRole(role: PiPinRole): boolean {
  return (
    role === 'basic_processor' ||
    role === 'advanced_processor' ||
    role === 'high_tech_processor'
  )
}

function isStoreRole(role: PiPinRole): boolean {
  return role === 'launchpad' || role === 'command_center' || role === 'storage'
}

export function isStorePinRole(role: PiPinRole): boolean {
  return isStoreRole(role)
}

function sourceLabelsForRoutes(
  routes: PiColonyAnalysis['routing']['routes'],
  pinById: Map<number, PiPinView>,
  formatPinLabel: (pin: PiPinView) => string
): string[] {
  return [...new Set(
    routes.map((route) => {
      const src = pinById.get(route.sourcePinId)
      return src ? formatPinLabel(src) : `Pin ${route.sourcePinId}`
    })
  )].sort()
}

function destLabelsForRoutes(
  routes: PiColonyAnalysis['routing']['routes'],
  pinById: Map<number, PiPinView>,
  formatPinLabel: (pin: PiPinView) => string
): string[] {
  return [...new Set(
    routes.map((route) => {
      const dest = pinById.get(route.destPinId)
      return dest ? formatPinLabel(dest) : `Pin ${route.destPinId}`
    })
  )].sort()
}

function recipeForPin(pin: PiPinView, colony: PiColonyAnalysis): PiRecipeView | undefined {
  const fromColony =
    colony.recipes.find((r) => r.pinId === pin.pinId) ??
    colony.recipes.find((r) => r.output.typeId === pin.itemTypeId && r.pinRole === pin.role)
  if (fromColony) return fromColony

  if (!pin.schematicId) return undefined
  const sch = getSchematicById(pin.schematicId)
  if (!sch) return undefined

  return {
    schematicId: pin.schematicId,
    name: sch.name,
    cycleTimeSec: sch.cycleTimeSec,
    pinId: pin.pinId,
    pinRole: pin.role,
    inputs: sch.inputs.map((inp) => ({
      typeId: inp.typeId,
      name: getCommodityName(inp.typeId),
      qty: inp.qty,
      tier: tierForType(inp.typeId),
    })),
    output: {
      typeId: sch.output.typeId,
      name: getCommodityName(sch.output.typeId),
      qty: sch.output.qty,
      tier: tierForType(sch.output.typeId),
    },
    designedOutputPerHour: schematicUnitsPerHour(sch.output.qty, sch.cycleTimeSec),
  }
}

function flowUnitsPerHour(
  fromBalance: number,
  designedPerPin: number,
  _rateMode: 'potential' | 'current'
): number {
  return fromBalance > 0 ? fromBalance : designedPerPin
}

function siblingProcessors(pin: PiPinView, pins: PiPinView[]): PiPinView[] {
  if (!pin.itemTypeId) return [pin]
  return pins.filter(
    (p) => isProcessorRole(p.role) && p.itemTypeId === pin.itemTypeId && p.role === pin.role
  )
}

function perPinDesignedRate(totalPerHour: number, siblings: number): number {
  return siblings > 0 ? totalPerHour / siblings : totalPerHour
}

export function schematicUnitsPerHour(qty: number, cycleTimeSec: number): number {
  if (cycleTimeSec <= 0) return 0
  return (qty / cycleTimeSec) * 3600
}

export function allocateByRouteWeight(
  pinId: number,
  typeId: number,
  totalUnits: number,
  routes: PiColonyAnalysis['routing']['routes'],
  kindFilter?: PiColonyAnalysis['routing']['routes'][number]['kind']
): number {
  const relevant = routes.filter(
    (r) => r.typeId === typeId && (kindFilter == null || r.kind === kindFilter)
  )
  if (relevant.length === 0 || totalUnits <= 0) return 0

  const pinRoutes = relevant.filter((r) => r.destPinId === pinId || r.sourcePinId === pinId)
  if (pinRoutes.length === 0) return 0

  const pinWeight = pinRoutes.reduce((sum, r) => sum + r.quantity, 0)
  const totalWeight = relevant.reduce((sum, r) => sum + r.quantity, 0)
  if (totalWeight <= 0) return totalUnits / pinRoutes.length
  return (totalUnits * pinWeight) / totalWeight
}

export function importRateForDisplay(
  balance: PiCommodityBalance | undefined
): number {
  if (!balance) return 0
  if (balance.importNeededPerHour > 0) return balance.importNeededPerHour
  return Math.max(0, balance.demandPerHour - balance.localSupplyPerHour)
}

function countProcessorsForRecipe(colony: PiColonyAnalysis, recipe: PiRecipeView): number {
  const count = colony.routing.pins.filter(
    (pin) =>
      isProcessorRole(pin.role) &&
      (pin.schematicId === recipe.schematicId || pin.itemTypeId === recipe.output.typeId)
  ).length
  return Math.max(1, count)
}

function upsertImportFlow(
  importFlows: FlowLine[],
  flowByType: Map<number, FlowLine>,
  typeId: number,
  name: string,
  unitsPerHour: number
): void {
  if (unitsPerHour <= 0) return
  const existing = flowByType.get(typeId)
  if (existing) {
    existing.unitsPerHour = Math.max(existing.unitsPerHour, unitsPerHour)
    return
  }
  const flow: FlowLine = {
    typeId,
    name,
    tier: tierForType(typeId),
    unitsPerHour,
    peerLabels: [],
    sourceKind: 'import',
  }
  importFlows.push(flow)
  flowByType.set(typeId, flow)
}

function appendInferredImportFlows(
  colony: PiColonyAnalysis,
  balances: PiCommodityBalance[],
  importFlows: FlowLine[]
): void {
  if (colony.colonyRole !== 'factory_only') return

  const flowByType = new Map(importFlows.map((flow) => [flow.typeId, flow]))

  for (const balance of balances) {
    const rate = importRateForDisplay(balance)
    if (rate > 0 && balance.extractionPerHour <= 0) {
      upsertImportFlow(importFlows, flowByType, balance.typeId, balance.name, rate)
    }
  }

  for (const recipe of colony.recipes) {
    const factoryCount = countProcessorsForRecipe(colony, recipe)
    for (const inp of recipe.inputs) {
      const rate = schematicUnitsPerHour(inp.qty, recipe.cycleTimeSec) * factoryCount
      upsertImportFlow(importFlows, flowByType, inp.typeId, inp.name, rate)
    }
  }
}

function appendInferredExportFlows(
  colony: PiColonyAnalysis,
  exportFlows: FlowLine[]
): void {
  if (colony.colonyRole !== 'factory_only') return

  const flowByType = new Map(exportFlows.map((flow) => [flow.typeId, flow]))
  for (const recipe of colony.recipes) {
    if (flowByType.has(recipe.output.typeId)) continue
    const factoryCount = countProcessorsForRecipe(colony, recipe)
    const rate =
      recipe.designedOutputPerHour > 0
        ? recipe.designedOutputPerHour
        : schematicUnitsPerHour(recipe.output.qty, recipe.cycleTimeSec) * factoryCount
    if (rate <= 0) continue
    exportFlows.push({
      typeId: recipe.output.typeId,
      name: recipe.output.name,
      tier: recipe.output.tier ?? tierForType(recipe.output.typeId),
      unitsPerHour: rate,
      peerLabels: [],
    })
    flowByType.set(recipe.output.typeId, exportFlows[exportFlows.length - 1])
  }
}

function buildColonyVirtualFlows(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current'
): VirtualFlowNode[] {
  const routing = colony.routing
  if (!routing?.routes?.length) return []

  const balances = rateMode === 'potential' ? colony.balances.potential : colony.balances.current
  const virtual: VirtualFlowNode[] = []

  const importFlows: FlowLine[] = []
  for (const balance of balances) {
    if (balance.isImported && balance.importNeededPerHour > 0) {
      importFlows.push({
        typeId: balance.typeId,
        name: balance.name,
        tier: tierForType(balance.typeId),
        unitsPerHour: balance.importNeededPerHour,
        peerLabels: [],
        sourceKind: 'import',
      })
    }
  }

  appendInferredImportFlows(colony, balances, importFlows)

  if (importFlows.length > 0) {
    virtual.push({ kind: 'import', flows: dedupeFlowLines(importFlows) })
  }

  const pins = buildPlanetPins(colony, rateMode)
  const exportFlows: FlowLine[] = pins
    .filter((pin) => pin.kind === 'export')
    .map((pin) => ({
      typeId: pin.typeId,
      name: pin.name,
      tier: pin.tier,
      unitsPerHour: pin.unitsPerHour,
      peerLabels: [],
    }))
  const surplusFlows: FlowLine[] = pins
    .filter((pin) => pin.kind === 'surplus')
    .map((pin) => ({
      typeId: pin.typeId,
      name: pin.name,
      tier: pin.tier,
      unitsPerHour: pin.unitsPerHour,
      peerLabels: [],
    }))

  appendInferredExportFlows(colony, exportFlows)

  if (exportFlows.length > 0) {
    virtual.push({ kind: 'export', flows: dedupeFlowLines(exportFlows) })
  }
  if (surplusFlows.length > 0) {
    virtual.push({ kind: 'surplus', flows: dedupeFlowLines(surplusFlows) })
  }

  return virtual
}

export function buildProductionLineStages(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current',
  formatPinLabel: (pin: PiPinView) => string
): ProductionLineStages | null {
  const routing = colony.routing
  if (!routing?.routes?.length) return null

  const balances = rateMode === 'potential' ? colony.balances.potential : colony.balances.current
  const balanceByType = new Map(balances.map((b) => [b.typeId, b]))
  const pinById = new Map(routing.pins.map((p) => [p.pinId, p]))

  const incomingByDest = new Map<number, typeof routing.routes>()
  const outgoingBySource = new Map<number, typeof routing.routes>()

  for (const route of routing.routes) {
    const inList = incomingByDest.get(route.destPinId) ?? []
    inList.push(route)
    incomingByDest.set(route.destPinId, inList)

    const outList = outgoingBySource.get(route.sourcePinId) ?? []
    outList.push(route)
    outgoingBySource.set(route.sourcePinId, outList)
  }

  const input: PinLineNode[] = []
  const production: PinLineNode[] = []
  const exportStage: PinLineNode[] = []

  for (const pin of routing.pins) {
    const incoming = incomingByDest.get(pin.pinId) ?? []
    const outgoing = outgoingBySource.get(pin.pinId) ?? []

    if (pin.role === 'extractor') {
      const extractor = colony.extractors.find((e) => e.pinId === pin.pinId)
      const units =
        rateMode === 'current'
          ? extractor?.currentUnitsPerHour ?? 0
          : extractor?.designedUnitsPerHour ?? 0

      if (units > 0 && extractor) {
        input.push({
          pin,
          pinIds: [pin.pinId],
          receives: [],
          produces: [
            {
              typeId: extractor.productTypeId,
              name: extractor.productName,
              tier: tierForType(extractor.productTypeId),
              unitsPerHour: units,
              peerLabels: destLabelsForRoutes(outgoing, pinById, formatPinLabel),
            },
          ],
        })
      }
      continue
    }

    if (isProcessorRole(pin.role)) {
      const recipe = recipeForPin(pin, colony)
      const siblings = siblingProcessors(pin, routing.pins)
      const receives: FlowLine[] = []
      const produces: FlowLine[] = []

      if (recipe) {
        for (const inp of recipe.inputs) {
          const inRoutes = incoming.filter((r) => r.typeId === inp.typeId)
          const balance = balanceByType.get(inp.typeId)
          const designedPerPin = schematicUnitsPerHour(inp.qty, recipe.cycleTimeSec)
          const fromBalance = balance
            ? perPinDesignedRate(balance.demandPerHour, siblings.length)
            : 0
          const units = flowUnitsPerHour(fromBalance, designedPerPin, rateMode)

          if (units > 0) {
            const fromOrbitalImport =
              colony.colonyRole === 'factory_only' ||
              (balance != null &&
                balance.extractionPerHour <= 0 &&
                (balance.isImported ||
                  balance.importNeededPerHour > 0 ||
                  importRateForDisplay(balance) > 0))

            receives.push({
              typeId: inp.typeId,
              name: inp.name,
              tier: tierForType(inp.typeId),
              unitsPerHour: units,
              peerLabels: fromOrbitalImport
                ? []
                : sourceLabelsForRoutes(inRoutes, pinById, formatPinLabel),
              routeQuantity: inRoutes.length > 0 ? Math.max(...inRoutes.map((r) => r.quantity)) : undefined,
              sourceKind: fromOrbitalImport ? 'import' : undefined,
            })
          }
        }

        const outRoutes = outgoing.filter((r) => r.typeId === recipe.output.typeId)
        const balance = balanceByType.get(recipe.output.typeId)
        const designedPerPin = schematicUnitsPerHour(recipe.output.qty, recipe.cycleTimeSec)
        const fromBalance = balance
          ? perPinDesignedRate(balance.productionPerHour, siblings.length)
          : 0
        const units = flowUnitsPerHour(fromBalance, designedPerPin, rateMode)

        if (units > 0) {
          produces.push({
            typeId: recipe.output.typeId,
            name: recipe.output.name,
            tier: tierForType(recipe.output.typeId),
            unitsPerHour: units,
            peerLabels: destLabelsForRoutes(outRoutes, pinById, formatPinLabel),
            routeQuantity:
              outRoutes.length > 0 ? Math.max(...outRoutes.map((r) => r.quantity)) : undefined,
          })
        }
      }

      if (receives.length > 0 || produces.length > 0) {
        production.push({ pin, pinIds: [pin.pinId], receives, produces })
      }
      continue
    }

    if (isStoreRole(pin.role)) {
      const inputReceives: FlowLine[] = []
      const exportReceives: FlowLine[] = []

      for (const route of incoming) {
        const balance = balanceByType.get(route.typeId)
        const src = pinById.get(route.sourcePinId)
        const name = balance?.name ?? route.name
        const tier = tierForType(route.typeId)

        if (src?.role === 'extractor' && balance && balance.extractionPerHour > 0) {
          const units = allocateByRouteWeight(
            pin.pinId,
            route.typeId,
            balance.extractionPerHour,
            routing.routes
          )
          if (units > 0) {
            inputReceives.push({
              typeId: route.typeId,
              name,
              tier,
              unitsPerHour: units,
              peerLabels: [formatPinLabel(src)],
              routeQuantity: route.quantity,
              sourceKind: 'extractor',
            })
          }
        }

        if (src && isProcessorRole(src.role)) {
          const hasDownstreamFactory = outgoing.some((r) => {
            if (r.typeId !== route.typeId || r.kind !== 'fromStoreToFactory') return false
            const dest = pinById.get(r.destPinId)
            return dest != null && isProcessorRole(dest.role)
          })
          if (hasDownstreamFactory) continue
          if (exportReceives.some((line) => line.typeId === route.typeId)) continue

          const recipe = recipeForPin(src, colony)
          const factoryCount = recipe ? countProcessorsForRecipe(colony, recipe) : 1
          const designedTotal =
            recipe && route.typeId === recipe.output.typeId
              ? schematicUnitsPerHour(recipe.output.qty, recipe.cycleTimeSec) * factoryCount
              : 0
          const totalProduction = balance?.productionPerHour ?? 0
          const rate = flowUnitsPerHour(totalProduction, designedTotal, rateMode)

          const units = allocateByRouteWeight(
            pin.pinId,
            route.typeId,
            rate,
            routing.routes,
            'toExportStore'
          )
          if (units > 0) {
            const factoryLabels = incoming
              .filter((r) => r.typeId === route.typeId)
              .map((r) => pinById.get(r.sourcePinId))
              .filter((p): p is PiPinView => p != null && isProcessorRole(p.role))
              .map(formatPinLabel)

            exportReceives.push({
              typeId: route.typeId,
              name,
              tier,
              unitsPerHour: units,
              peerLabels: [...new Set(factoryLabels)].sort(),
              routeQuantity:
                incoming.filter((r) => r.typeId === route.typeId).length > 0
                  ? Math.max(...incoming.filter((r) => r.typeId === route.typeId).map((r) => r.quantity))
                  : route.quantity,
              sourceKind: 'factory',
            })
          }
        }
      }

      const servesAsInputStore =
        inputReceives.length > 0 ||
        outgoing.some((r) => {
          if (r.kind !== 'fromStoreToFactory') return false
          const dest = pinById.get(r.destPinId)
          return dest != null && isProcessorRole(dest.role)
        })

      if (servesAsInputStore) {
        for (const route of outgoing) {
          if (route.kind !== 'fromStoreToFactory') continue
          const balance = balanceByType.get(route.typeId)
          if (!balance?.isImported || balance.importNeededPerHour <= 0) continue

          const units = allocateByRouteWeight(
            pin.pinId,
            route.typeId,
            balance.importNeededPerHour,
            routing.routes,
            'fromStoreToFactory'
          )
          if (units <= 0) continue

          inputReceives.push({
            typeId: route.typeId,
            name: balance.name,
            tier: tierForType(route.typeId),
            unitsPerHour: units,
            peerLabels: [],
            routeQuantity: route.quantity,
            sourceKind: 'import',
          })
        }

        const actsAsExportHub =
          exportReceives.length > 0 ||
          (colony.colonyRole === 'factory_only' &&
            incoming.some((route) => {
              const src = pinById.get(route.sourcePinId)
              return src != null && isProcessorRole(src.role)
            }))
        const onlyOrbitalInput =
          inputReceives.length === 0 ||
          inputReceives.every((line) => line.sourceKind === 'import')
        const skipInputStage =
          colony.colonyRole === 'factory_only' && actsAsExportHub && onlyOrbitalInput

        if (!skipInputStage) {
          input.push({
            pin,
            pinIds: [pin.pinId],
            receives: dedupeFlowLines(inputReceives),
            produces: [],
          })
        }
      }

      if (exportReceives.length > 0) {
        exportStage.push({
          pin,
          pinIds: [pin.pinId],
          receives: dedupeFlowLines(exportReceives),
          produces: [],
        })
      }
    }
  }

  return {
    input,
    production: mergeIdenticalProductionNodes(production),
    export: exportStage,
    virtual: buildColonyVirtualFlows(colony, rateMode),
  }
}

function flowLineKey(line: FlowLine): string {
  return `${line.typeId}|${line.peerLabels.join(',')}|${line.sourceKind ?? ''}`
}

function mergeFlowLines(lines: FlowLine[]): FlowLine[] {
  const map = new Map<string, FlowLine>()
  for (const line of lines) {
    const key = flowLineKey(line)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...line, peerLabels: [...line.peerLabels] })
      continue
    }
    existing.unitsPerHour += line.unitsPerHour
    if (line.routeQuantity != null) {
      existing.routeQuantity = Math.max(existing.routeQuantity ?? 0, line.routeQuantity)
    }
  }
  return [...map.values()]
}

function nodeFlowSignature(node: PinLineNode): string {
  const receives = node.receives
    .map((r) => `r:${flowLineKey(r)}`)
    .sort()
    .join(';')
  const produces = node.produces
    .map((p) => `p:${flowLineKey(p)}`)
    .sort()
    .join(';')
  return `${node.pin.role}|${node.pin.itemTypeId ?? 0}|${receives}|${produces}`
}

function groupedPinLabel(pins: PiPinView[]): string {
  return groupedPinDisplayLabel(pins)
}

export function mergeIdenticalProductionNodes(nodes: PinLineNode[]): PinLineNode[] {
  const groups = new Map<string, PinLineNode[]>()

  for (const node of nodes) {
    const key = nodeFlowSignature(node)
    const list = groups.get(key) ?? []
    list.push(node)
    groups.set(key, list)
  }

  const merged: PinLineNode[] = []

  for (const group of groups.values()) {
    if (group.length === 1) {
      merged.push(group[0])
      continue
    }

    const pins = group.map((n) => n.pin).sort((a, b) => a.roleIndex - b.roleIndex)
    const receives = mergeFlowLines(group.flatMap((n) => n.receives))
    const produces = mergeFlowLines(group.flatMap((n) => n.produces))

    merged.push({
      pin: pins[0],
      pinIds: pins.map((p) => p.pinId),
      receives,
      produces,
      groupCount: pins.length,
      displayLabel: groupedPinLabel(pins),
    })
  }

  return merged.sort(
    (a, b) =>
      a.pin.roleIndex - b.pin.roleIndex ||
      (a.pin.itemTypeId ?? 0) - (b.pin.itemTypeId ?? 0) ||
      a.pin.pinId - b.pin.pinId
  )
}

export function dedupeFlowLines(lines: FlowLine[]): FlowLine[] {
  const byKey = new Map<string, FlowLine>()
  for (const line of lines) {
    const key = `${line.typeId}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...line, peerLabels: [...line.peerLabels] })
      continue
    }
    existing.unitsPerHour = Math.max(existing.unitsPerHour, line.unitsPerHour)
    existing.peerLabels = [...new Set([...existing.peerLabels, ...line.peerLabels])].sort()
  }
  return [...byKey.values()]
}
