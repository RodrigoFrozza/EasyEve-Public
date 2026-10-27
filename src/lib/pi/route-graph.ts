import {
  getCommodityName,
  getPinRole,
  getPinStructureName,
  getSchematicById,
  type PiPinRole,
} from '@/lib/pi/pi-static-data'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import { formatPinDisplayLabel } from '@/lib/pi/pin-labels'
import type { PiColonyLayout, PiPin, PiPinView, PiRoutingView, PiRouteView, PiRouteEdgeKind } from '@/lib/pi/types'

export type RouteEdgeKind = PiRouteEdgeKind

export interface RouteEdge {
  routeId: number
  sourcePinId: number
  destPinId: number
  typeId: number
  quantity: number
  kind: RouteEdgeKind
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

function classifyEdge(source: PiPin, dest: PiPin): RouteEdgeKind {
  const srcRole = getPinRole(source.type_id)
  const destRole = getPinRole(dest.type_id)

  if (srcRole === 'extractor' && isProcessorRole(destRole)) return 'extractorToFactory'
  if (isProcessorRole(srcRole) && isProcessorRole(destRole)) return 'factoryToFactory'
  if (isProcessorRole(srcRole) && isExportStoreRole(destRole)) return 'toExportStore'
  if (isExportStoreRole(srcRole) && isProcessorRole(destRole)) return 'fromStoreToFactory'
  if (srcRole === 'extractor' && isExportStoreRole(destRole)) return 'extractorToStore'
  return 'other'
}

export function buildRouteEdges(layout: PiColonyLayout): RouteEdge[] {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const edges: RouteEdge[] = []

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest) continue

    edges.push({
      routeId: route.route_id,
      sourcePinId: route.source_pin_id,
      destPinId: route.destination_pin_id,
      typeId: route.content_type_id,
      quantity: route.quantity,
      kind: classifyEdge(source, dest),
    })
  }

  return edges
}

export function getRoutedToExportTypeIds(edges: RouteEdge[]): Set<number> {
  const exported = new Set<number>()
  for (const edge of edges) {
    if (edge.kind === 'toExportStore' || edge.kind === 'extractorToStore') {
      exported.add(edge.typeId)
    }
  }
  return exported
}

/**
 * Types that reach storage/launchpad without being fed back into a local factory.
 * Differs from getRoutedToExportTypeIds: factory→storage buffer hops for P1→P2 chains are excluded.
 */
export function getTerminalExportTypeIds(edges: RouteEdge[]): Set<number> {
  const consumedFromStore = new Set<number>()
  for (const edge of edges) {
    if (edge.kind === 'fromStoreToFactory') {
      consumedFromStore.add(edge.typeId)
    }
  }

  const terminal = new Set<number>()
  for (const edge of edges) {
    if (edge.kind !== 'toExportStore' && edge.kind !== 'extractorToStore') continue
    if (!consumedFromStore.has(edge.typeId)) {
      terminal.add(edge.typeId)
    }
  }
  return terminal
}

export function getStoredUnusedTypeIds(
  layout: PiColonyLayout,
  recipeInputTypeIds: Set<number>
): Set<number> {
  const stored = new Set<number>()
  for (const pin of layout.pins) {
    const role = getPinRole(pin.type_id)
    if (!isExportStoreRole(role)) continue
    for (const content of pin.contents ?? []) {
      if (!recipeInputTypeIds.has(content.type_id) && content.amount > 0) {
        stored.add(content.type_id)
      }
    }
  }
  return stored
}

export function exportedTypeIds(
  layout: PiColonyLayout,
  producedTypeIds: Set<number>,
  recipeInputTypeIds: Set<number>
): Set<number> {
  const edges = buildRouteEdges(layout)
  const exported = new Set<number>()

  // Highest tier produced on planet
  let maxTier = -1
  const highestTierTypes = new Set<number>()
  for (const typeId of producedTypeIds) {
    const tier = getCommodityTier(typeId) ?? -1
    if (tier > maxTier) {
      maxTier = tier
      highestTierTypes.clear()
      highestTierTypes.add(typeId)
    } else if (tier === maxTier) {
      highestTierTypes.add(typeId)
    }
  }
  for (const typeId of highestTierTypes) exported.add(typeId)

  // Stored items not used in any local recipe
  for (const typeId of getStoredUnusedTypeIds(layout, recipeInputTypeIds)) {
    exported.add(typeId)
  }

  for (const typeId of getTerminalExportTypeIds(edges)) {
    exported.add(typeId)
  }

  return exported
}

export function importedTypeIds(
  layout: PiColonyLayout,
  localSupplyTypeIds: Set<number>
): Set<number> {
  const edges = buildRouteEdges(layout)
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const imported = new Set<number>()

  for (const edge of edges) {
    if (edge.kind !== 'fromStoreToFactory') continue
    const source = pinById.get(edge.sourcePinId)
    if (!source) continue
    const srcRole = getPinRole(source.type_id)
    if (!isExportStoreRole(srcRole)) continue

    // Imported if no local extractor/factory produces this type
    if (!localSupplyTypeIds.has(edge.typeId)) {
      imported.add(edge.typeId)
    }
  }

  return imported
}

function resolveSchematicId(pin: PiPin): number | undefined {
  const fromFactory = pin.factory_details?.schematic_id
  if (typeof fromFactory === 'number' && fromFactory > 0) return fromFactory
  if (typeof pin.schematic_id === 'number' && pin.schematic_id > 0) return pin.schematic_id
  return undefined
}

function pinSortOrder(role: PiPinRole): number {
  switch (role) {
    case 'extractor':
      return 0
    case 'basic_processor':
    case 'advanced_processor':
    case 'high_tech_processor':
      return 1
    case 'launchpad':
    case 'storage':
    case 'command_center':
      return 2
    default:
      return 3
  }
}

function buildPinViews(layout: PiColonyLayout): PiPinView[] {
  const roleCounts: Partial<Record<PiPinRole, number>> = {}
  const views: PiPinView[] = []

  const sorted = [...layout.pins].sort(
    (a, b) =>
      pinSortOrder(getPinRole(a.type_id)) - pinSortOrder(getPinRole(b.type_id)) || a.pin_id - b.pin_id
  )

  for (const pin of sorted) {
    const role = getPinRole(pin.type_id)
    if (role === 'link') continue

    const roleIndex = (roleCounts[role] ?? 0) + 1
    roleCounts[role] = roleIndex

    let itemTypeId: number | undefined
    let itemName: string | undefined
    let schematicId: number | undefined

    if (role === 'extractor') {
      itemTypeId = pin.extractor_details?.product_type_id
      if (itemTypeId) itemName = getCommodityName(itemTypeId)
    } else if (isProcessorRole(role)) {
      schematicId = resolveSchematicId(pin)
      const sch = schematicId ? getSchematicById(schematicId) : undefined
      if (sch) {
        itemTypeId = sch.output.typeId
        itemName = getCommodityName(sch.output.typeId)
      }
    }

    const structureName = getPinStructureName(pin.type_id)

    views.push({
      pinId: pin.pin_id,
      typeId: pin.type_id,
      role,
      roleIndex,
      structureName,
      label: formatPinDisplayLabel(structureName, pin.pin_id),
      itemTypeId,
      itemName,
      schematicId,
    })
  }

  return views
}

export function buildRoutingView(layout: PiColonyLayout, edges: RouteEdge[]): PiRoutingView {
  const pins = buildPinViews(layout)
  const routes: PiRouteView[] = edges.map((edge) => ({
    routeId: edge.routeId,
    sourcePinId: edge.sourcePinId,
    destPinId: edge.destPinId,
    typeId: edge.typeId,
    name: getCommodityName(edge.typeId),
    tier: getCommodityTier(edge.typeId),
    quantity: edge.quantity,
    kind: edge.kind,
  }))

  return { pins, routes }
}
