import {
  allocateByRouteWeight,
  buildProductionLineStages,
  importRateForDisplay,
  type FlowLine,
  type PinLineNode,
  type ProductionLineStages,
  type VirtualFlowNode,
} from '@/lib/pi/chain-branches'
import { buildPlanetPins } from '@/lib/pi/export-tiers'
import type { PiPinRole, PiCommodityTier } from '@/lib/pi/pi-static-data'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import type {
  PiColonyAnalysis,
  PiPinView,
  PiRouteEdgeKind,
} from '@/lib/pi/types'

export const EXTERNAL_IN_NODE_ID = '__external_in__'
export const EXTERNAL_OUT_NODE_ID = '__external_out__'
export const COLONY_IMPORT_NODE_ID = '__colony_import__'
export const COLONY_EXPORT_NODE_ID = '__colony_export__'
export const COLONY_SURPLUS_NODE_ID = '__colony_surplus__'

export type ChainNodeRole = PiPinRole | 'planet' | 'external' | 'import' | 'export' | 'surplus'

export interface ChainNode {
  id: string
  layer: number
  /** Vertical order within a layer (lower = higher on screen) */
  order?: number
  role: ChainNodeRole
  label: string
  structureName?: string
  groupCount?: number
  pinIds: number[]
  planetId?: number
  itemTypeId?: number
  itemName?: string
  receives: FlowLine[]
  produces: FlowLine[]
}

export interface ChainEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  typeId: number
  name: string
  tier?: PiCommodityTier
  unitsPerHour: number
  kind?: PiRouteEdgeKind | 'internal' | 'external_import' | 'external_export' | 'colony_import' | 'colony_export' | 'colony_surplus'
}

export interface ChainGraph {
  nodes: ChainNode[]
  edges: ChainEdge[]
}

export interface LayoutBounds {
  nodeId: string
  x: number
  y: number
  width: number
  height: number
}

export interface ChainGraphLayout {
  width: number
  height: number
  nodes: LayoutBounds[]
}

export const CHAIN_NODE_WIDTH = 220
export const CHAIN_NODE_MIN_HEIGHT = 88
/** @deprecated use estimateChainNodeHeight / layout bounds */
export const CHAIN_NODE_HEIGHT = CHAIN_NODE_MIN_HEIGHT
export const CHAIN_LAYER_GAP = 120
export const CHAIN_NODE_GAP = 30
export const CHAIN_PADDING = 24

/** Estimate card height from visible receives/produces rows (matches ChainGraph card). */
export function estimateChainNodeHeight(node: ChainNode): number {
  const cardPaddingY = 20 // p-2.5 top + bottom
  const titleBlock = 40 // line-clamp-2 title + mb-1.5
  const itemNameBlock = 18
  const sectionHeader = 14
  const sectionGap = 6 // mb-1 / space-y between header and chips
  const flowRow = 30 // single FlowChip row
  const recvRows = node.receives.length > 0 ? Math.min(node.receives.length, 2) : 0
  const prodRows = node.produces.length > 0 ? Math.min(node.produces.length, 2) : 0

  let content = titleBlock
  if (node.itemName) content += itemNameBlock
  if (recvRows > 0) content += sectionGap + sectionHeader + recvRows * flowRow
  if (prodRows > 0) content += sectionGap + sectionHeader + prodRows * flowRow

  return Math.max(CHAIN_NODE_MIN_HEIGHT, content + cardPaddingY)
}

function nodeStageFromId(nodeId: string): 'input' | 'production' | 'export' | 'other' {
  if (nodeId.startsWith('input-')) return 'input'
  if (nodeId.startsWith('production-')) return 'production'
  if (nodeId.startsWith('export-')) return 'export'
  return 'other'
}

function isExportStoreRole(role: ChainNode['role']): boolean {
  return role === 'launchpad' || role === 'storage' || role === 'command_center'
}

function isExportStoreChainNode(node: ChainNode): boolean {
  return node.id.startsWith('export-') && isExportStoreRole(node.role)
}

function virtualFlowToChainNode(node: VirtualFlowNode): ChainNode {
  const labels: Record<VirtualFlowNode['kind'], string> = {
    import: 'Import',
    export: 'Export',
    surplus: 'Surplus',
  }
  const ids: Record<VirtualFlowNode['kind'], string> = {
    import: COLONY_IMPORT_NODE_ID,
    export: COLONY_EXPORT_NODE_ID,
    surplus: COLONY_SURPLUS_NODE_ID,
  }

  return {
    id: ids[node.kind],
    layer: 0,
    order: node.kind === 'import' ? -1 : 999,
    role: node.kind,
    label: labels[node.kind],
    pinIds: [],
    receives: node.kind === 'import' ? [] : node.flows,
    produces: node.kind === 'import' ? node.flows : [],
  }
}

function findInputStoreNodeId(pinId: number, nodes: ChainNode[]): string | undefined {
  return nodes.find((n) => n.id.startsWith('input-') && n.pinIds.includes(pinId))?.id
}

function productionNodesReceivingType(typeId: number, pinNodes: ChainNode[]): ChainNode[] {
  return pinNodes.filter(
    (n) => n.id.startsWith('production-') && n.receives.some((r) => r.typeId === typeId)
  )
}

function addFactoryOnlyImportEdges(
  edgeMap: Map<string, ChainEdge>,
  importFlows: FlowLine[],
  pinNodes: ChainNode[]
): void {
  for (const flow of importFlows) {
    const targets = productionNodesReceivingType(flow.typeId, pinNodes)
    if (targets.length === 0) continue

    const totalRecv = targets.reduce(
      (sum, node) => sum + (node.receives.find((r) => r.typeId === flow.typeId)?.unitsPerHour ?? 0),
      0
    )

    for (const target of targets) {
      const recv = target.receives.find((r) => r.typeId === flow.typeId)
      const units =
        totalRecv > 0 && recv
          ? (recv.unitsPerHour / totalRecv) * flow.unitsPerHour
          : flow.unitsPerHour / targets.length

      addColonyFlowEdge(
        edgeMap,
        COLONY_IMPORT_NODE_ID,
        target.id,
        flow.typeId,
        flow.name,
        flow.tier,
        units,
        'colony_import'
      )
    }
  }
}

function addColonyFlowEdge(
  edgeMap: Map<string, ChainEdge>,
  sourceNodeId: string,
  targetNodeId: string,
  typeId: number,
  name: string,
  tier: PiCommodityTier | undefined,
  unitsPerHour: number,
  kind: ChainEdge['kind']
): void {
  if (unitsPerHour <= 0) return
  const key = `${sourceNodeId}|${targetNodeId}|${typeId}|${kind ?? ''}`
  const existing = edgeMap.get(key)
  if (!existing) {
    edgeMap.set(key, {
      id: key,
      sourceNodeId,
      targetNodeId,
      typeId,
      name,
      tier,
      unitsPerHour,
      kind,
    })
    return
  }
  existing.unitsPerHour += unitsPerHour
}

function buildColonyVirtualEdges(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current',
  pinNodes: ChainNode[],
  virtualNodes: ChainNode[]
): ChainEdge[] {
  const routing = colony.routing
  if (!routing?.routes?.length || virtualNodes.length === 0) return []

  const balances = rateMode === 'potential' ? colony.balances.potential : colony.balances.current
  const balanceByType = new Map(balances.map((b) => [b.typeId, b]))
  const edgeMap = new Map<string, ChainEdge>()
  const hasImport = virtualNodes.some((n) => n.id === COLONY_IMPORT_NODE_ID)
  const hasExport = virtualNodes.some((n) => n.id === COLONY_EXPORT_NODE_ID)
  const hasSurplus = virtualNodes.some((n) => n.id === COLONY_SURPLUS_NODE_ID)

  if (hasImport) {
    const importVirtual = virtualNodes.find((n) => n.id === COLONY_IMPORT_NODE_ID)

    if (colony.colonyRole === 'factory_only' && importVirtual) {
      addFactoryOnlyImportEdges(edgeMap, importVirtual.produces, pinNodes)
    } else {
      for (const route of routing.routes) {
        if (route.kind !== 'fromStoreToFactory') continue
        const balance = balanceByType.get(route.typeId)
        const importRate = importRateForDisplay(balance)
        if (importRate <= 0 && !(balance?.isImported && balance.importNeededPerHour > 0)) continue

        const targetNodeId = findInputStoreNodeId(route.sourcePinId, pinNodes)
        if (!targetNodeId) continue

        const totalRate =
          balance?.isImported && balance.importNeededPerHour > 0
            ? balance.importNeededPerHour
            : importRate
        const units = allocateByRouteWeight(
          route.sourcePinId,
          route.typeId,
          totalRate,
          routing.routes,
          'fromStoreToFactory'
        )
        addColonyFlowEdge(
          edgeMap,
          COLONY_IMPORT_NODE_ID,
          targetNodeId,
          route.typeId,
          route.name,
          route.tier ?? getCommodityTier(route.typeId),
          units,
          'colony_import'
        )
      }
    }
  }

  const exportStoreNodes = pinNodes.filter(isExportStoreChainNode)
  const planetPins = buildPlanetPins(colony, rateMode)

  if (hasExport) {
    for (const storeNode of exportStoreNodes) {
      for (const pinId of storeNode.pinIds) {
        const exportPins = planetPins.filter((p) => p.kind === 'export')

        if (exportPins.length > 0) {
          for (const pin of exportPins) {
            const routedHere = routing.routes.some(
              (r) =>
                r.destPinId === pinId &&
                r.typeId === pin.typeId &&
                r.kind === 'toExportStore'
            )
            if (!routedHere) continue

            const units = allocateByRouteWeight(
              pinId,
              pin.typeId,
              pin.unitsPerHour,
              routing.routes,
              'toExportStore'
            )
            addColonyFlowEdge(
              edgeMap,
              storeNode.id,
              COLONY_EXPORT_NODE_ID,
              pin.typeId,
              pin.name,
              pin.tier ?? getCommodityTier(pin.typeId),
              units,
              'colony_export'
            )
          }
          continue
        }

        if (colony.colonyRole !== 'factory_only') continue

        for (const route of routing.routes) {
          if (route.kind !== 'toExportStore' || route.destPinId !== pinId) continue
          const balance = balanceByType.get(route.typeId)
          const recipe = colony.recipes.find((r) => r.output.typeId === route.typeId)
          const totalRate =
            balance?.exportedPerHour ??
            balance?.productionPerHour ??
            recipe?.designedOutputPerHour ??
            0
          if (totalRate <= 0) continue

          const units = allocateByRouteWeight(
            pinId,
            route.typeId,
            totalRate,
            routing.routes,
            'toExportStore'
          )
          addColonyFlowEdge(
            edgeMap,
            storeNode.id,
            COLONY_EXPORT_NODE_ID,
            route.typeId,
            route.name,
            route.tier ?? getCommodityTier(route.typeId),
            units,
            'colony_export'
          )
        }
      }
    }
  }

  if (hasSurplus) {
    for (const storeNode of exportStoreNodes) {
      for (const pinId of storeNode.pinIds) {
        for (const pin of planetPins.filter((p) => p.kind === 'surplus')) {
          const units = allocateByRouteWeight(
            pinId,
            pin.typeId,
            pin.unitsPerHour,
            routing.routes
          )
          addColonyFlowEdge(
            edgeMap,
            storeNode.id,
            COLONY_SURPLUS_NODE_ID,
            pin.typeId,
            pin.name,
            pin.tier ?? getCommodityTier(pin.typeId),
            units,
            'colony_surplus'
          )
        }
      }
    }
  }

  return [...edgeMap.values()]
}

function pinLineToChainNode(node: PinLineNode, stage: 'input' | 'production' | 'export'): ChainNode {
  const label = node.displayLabel ?? node.pin.label
  return {
    id: nodeIdFromPinLine(node, stage),
    layer: 0,
    order: 0,
    role: node.pin.role,
    label,
    structureName: node.pin.structureName,
    groupCount: node.groupCount,
    pinIds: [...node.pinIds],
    itemTypeId: node.pin.itemTypeId,
    itemName: node.pin.itemName,
    receives: node.receives,
    produces: node.produces,
  }
}

function resolveNodeIdForRoutePin(
  pinId: number,
  route: PiColonyAnalysis['routing']['routes'][number],
  role: 'source' | 'dest',
  nodes: ChainNode[]
): string | undefined {
  const candidates = nodes.filter((n) => n.pinIds.includes(pinId))
  if (candidates.length === 0) return undefined

  if (route.kind === 'fromStoreToFactory') {
    if (role === 'source') {
      return candidates.find((n) => nodeStageFromId(n.id) === 'input')?.id
    }
    return candidates.find((n) => nodeStageFromId(n.id) === 'production')?.id
  }
  if (route.kind === 'toExportStore') {
    if (role === 'dest') {
      return candidates.find((n) => nodeStageFromId(n.id) === 'export')?.id ?? candidates[0]?.id
    }
    return candidates.find((n) => nodeStageFromId(n.id) === 'production')?.id ?? candidates[0]?.id
  }
  if (route.kind === 'extractorToFactory' || route.kind === 'factoryToFactory') {
    if (role === 'source') {
      return (
        candidates.find((n) => nodeStageFromId(n.id) === 'input' || nodeStageFromId(n.id) === 'production')
          ?.id ?? candidates[0]?.id
      )
    }
    return candidates.find((n) => nodeStageFromId(n.id) === 'production')?.id ?? candidates[0]?.id
  }

  return candidates[0]?.id
}

function normalizeLayerIndices(nodes: ChainNode[]): void {
  const unique = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b)
  const remap = new Map(unique.map((layer, index) => [layer, index]))
  for (const node of nodes) {
    node.layer = remap.get(node.layer) ?? 0
  }
}

/** Assign left-to-right layers via longest-path topological layering. */
export function assignTopologicalLayers(nodes: ChainNode[], edges: ChainEdge[]): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) continue
    if (edge.sourceNodeId === edge.targetNodeId) continue
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId)
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  const layerById = new Map<string, number>()
  for (const node of nodes) layerById.set(node.id, 0)

  const queue: string[] = []
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id)
  }

  const processed = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    processed.add(id)
    const currentLayer = layerById.get(id) ?? 0

    for (const nextId of adjacency.get(id) ?? []) {
      layerById.set(nextId, Math.max(layerById.get(nextId) ?? 0, currentLayer + 1))
      const nextDegree = (inDegree.get(nextId) ?? 0) - 1
      inDegree.set(nextId, nextDegree)
      if (nextDegree === 0) queue.push(nextId)
    }
  }

  for (const node of nodes) {
    if (processed.has(node.id)) {
      node.layer = layerById.get(node.id) ?? 0
      continue
    }
    let maxPred = 0
    for (const edge of edges) {
      if (edge.targetNodeId !== node.id) continue
      maxPred = Math.max(maxPred, (layerById.get(edge.sourceNodeId) ?? 0) + 1)
    }
    node.layer = maxPred
  }

  const outgoingCount = new Map<string, number>()
  for (const node of nodes) outgoingCount.set(node.id, 0)
  for (const edge of edges) {
    outgoingCount.set(edge.sourceNodeId, (outgoingCount.get(edge.sourceNodeId) ?? 0) + 1)
  }

  let maxLayer = Math.max(0, ...nodes.map((n) => n.layer))
  for (const node of nodes) {
    const isExportSink =
      isExportStoreChainNode(node) &&
      (outgoingCount.get(node.id) ?? 0) === 0
    if (isExportSink) {
      node.layer = Math.max(node.layer, maxLayer)
    }
    maxLayer = Math.max(maxLayer, node.layer)
  }

  if (nodeById.has(EXTERNAL_IN_NODE_ID)) {
    nodeById.get(EXTERNAL_IN_NODE_ID)!.layer = 0
  }
  if (nodeById.has(COLONY_IMPORT_NODE_ID)) {
    nodeById.get(COLONY_IMPORT_NODE_ID)!.layer = 0
  }
  if (nodeById.has(EXTERNAL_OUT_NODE_ID)) {
    nodeById.get(EXTERNAL_OUT_NODE_ID)!.layer = maxLayer
  }

  normalizeLayerIndices(nodes)

  const maxAfter = Math.max(0, ...nodes.map((n) => n.layer))
  if (nodeById.has(EXTERNAL_OUT_NODE_ID)) {
    nodeById.get(EXTERNAL_OUT_NODE_ID)!.layer = maxAfter
  }
  if (nodeById.has(COLONY_EXPORT_NODE_ID)) {
    nodeById.get(COLONY_EXPORT_NODE_ID)!.layer = maxAfter + 1
  }
  if (nodeById.has(COLONY_SURPLUS_NODE_ID)) {
    nodeById.get(COLONY_SURPLUS_NODE_ID)!.layer = maxAfter + 1
  }

  normalizeLayerIndices(nodes)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Reduce edge crossings by barycenter ordering within each layer. */
export function orderNodesWithinLayers(nodes: ChainNode[], edges: ChainEdge[]): void {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const layers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b)

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].order = i
  }

  const SWEEPS = 3
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    for (const layer of layers) {
      const bucket = nodes.filter((n) => n.layer === layer)
      for (const node of bucket) {
        const predOrders = edges
          .filter((e) => e.targetNodeId === node.id)
          .map((e) => nodeById.get(e.sourceNodeId)?.order ?? 0)
        if (predOrders.length > 0) {
          node.order = median(predOrders)
        }
      }
      bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
      bucket.forEach((node, index) => {
        node.order = index
      })
    }

    for (let li = layers.length - 1; li >= 0; li--) {
      const layer = layers[li]
      const bucket = nodes.filter((n) => n.layer === layer)
      for (const node of bucket) {
        const succOrders = edges
          .filter((e) => e.sourceNodeId === node.id)
          .map((e) => nodeById.get(e.targetNodeId)?.order ?? 0)
        if (succOrders.length > 0) {
          node.order = median(succOrders)
        }
      }
      bucket.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label))
      bucket.forEach((node, index) => {
        node.order = index
      })
    }
  }
}

export function applyGraphLayout(nodes: ChainNode[], edges: ChainEdge[]): void {
  assignTopologicalLayers(nodes, edges)
  orderNodesWithinLayers(nodes, edges)
}

function nodeIdFromPinLine(node: PinLineNode, stage: 'input' | 'production' | 'export'): string {
  if (node.pinIds.length === 1) return `${stage}-pin-${node.pinIds[0]}`
  return `${stage}-group-${node.pinIds.join('-')}`
}

function edgeUnitsForRoute(
  route: PiColonyAnalysis['routing']['routes'][number],
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current'
): number {
  const balances = rateMode === 'potential' ? colony.balances.potential : colony.balances.current
  const balance = balances.find((b) => b.typeId === route.typeId)
  const routes = colony.routing.routes

  if (balance) {
    if (route.kind === 'fromStoreToFactory' && balance.importNeededPerHour > 0) {
      return allocateByRouteWeight(
        route.sourcePinId,
        route.typeId,
        balance.importNeededPerHour,
        routes,
        'fromStoreToFactory'
      )
    }
    if (route.kind === 'toExportStore' && balance.productionPerHour > 0) {
      return allocateByRouteWeight(
        route.sourcePinId,
        route.typeId,
        balance.productionPerHour,
        routes,
        'toExportStore'
      )
    }
    if (balance.extractionPerHour > 0) {
      return allocateByRouteWeight(
        route.destPinId,
        route.typeId,
        balance.extractionPerHour,
        routes
      )
    }
  }

  const siblingRoutes = routes.filter((r) => r.typeId === route.typeId)
  const totalQty = siblingRoutes.reduce((sum, r) => sum + r.quantity, 0)
  if (totalQty <= 0) return route.quantity

  const recipe = colony.recipes.find(
    (r) => r.output.typeId === route.typeId || r.inputs.some((i) => i.typeId === route.typeId)
  )
  if (recipe) {
    const outputRate = (recipe.output.qty / recipe.cycleTimeSec) * 3600
    return (route.quantity / totalQty) * outputRate
  }

  return route.quantity
}

function buildColonyEdges(
  colony: PiColonyAnalysis,
  nodes: ChainNode[],
  rateMode: 'potential' | 'current'
): ChainEdge[] {
  const edgeMap = new Map<string, ChainEdge>()

  for (const route of colony.routing.routes) {
    const sourceNodeId = resolveNodeIdForRoutePin(route.sourcePinId, route, 'source', nodes)
    const targetNodeId = resolveNodeIdForRoutePin(route.destPinId, route, 'dest', nodes)
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) continue

    const key = `${sourceNodeId}|${targetNodeId}|${route.typeId}`
    const units = edgeUnitsForRoute(route, colony, rateMode)
    const existing = edgeMap.get(key)

    if (!existing) {
      edgeMap.set(key, {
        id: key,
        sourceNodeId,
        targetNodeId,
        typeId: route.typeId,
        name: route.name,
        tier: getCommodityTier(route.typeId) ?? route.tier,
        unitsPerHour: units,
        kind: route.kind,
      })
      continue
    }

    existing.unitsPerHour += units
  }

  return [...edgeMap.values()]
}

export function buildColonyProductionStages(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current',
  formatPinLabel: (pin: PiPinView) => string
): { stages: ProductionLineStages; effectiveMode: 'potential' | 'current' } | null {
  let effectiveMode = rateMode
  let stages = buildProductionLineStages(colony, effectiveMode, formatPinLabel)
  if (
    stages &&
    stages.production.length === 0 &&
    colony.colonyRole !== 'extraction_only'
  ) {
    const potentialStages = buildProductionLineStages(colony, 'potential', formatPinLabel)
    if (potentialStages && potentialStages.production.length > 0) {
      effectiveMode = 'potential'
      stages = potentialStages
    }
  }
  return stages ? { stages, effectiveMode } : null
}

export function buildColonyGraph(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current'
): ChainGraph | null {
  const formatPinLabel = (pin: PiPinView) => pin.label
  const resolved = buildColonyProductionStages(colony, rateMode, formatPinLabel)
  if (!resolved) return null
  const { stages, effectiveMode } = resolved

  const pinNodes: ChainNode[] = [
    ...stages.input.map((n) => pinLineToChainNode(n, 'input')),
    ...stages.production.map((n) => pinLineToChainNode(n, 'production')),
    ...stages.export.map((n) => pinLineToChainNode(n, 'export')),
  ]

  const virtualNodes = stages.virtual.map(virtualFlowToChainNode)
  const nodes = [...pinNodes, ...virtualNodes]

  if (nodes.length === 0) return null

  const routeEdges = refineEdgeUnitsForDisplay(
    buildColonyEdges(colony, pinNodes, effectiveMode),
    nodes
  )
  const virtualEdges = refineEdgeUnitsForDisplay(
    buildColonyVirtualEdges(colony, effectiveMode, pinNodes, virtualNodes),
    nodes
  )
  const edges = [...routeEdges, ...virtualEdges]
  applyGraphLayout(nodes, edges)

  return { nodes, edges }
}

/** Align edge labels with node receive/produce rates so lines match card values. */
function refineEdgeUnitsForDisplay(edges: ChainEdge[], nodes: ChainNode[]): ChainEdge[] {
  const inboundByTarget = new Map<string, ChainEdge[]>()
  for (const edge of edges) {
    const list = inboundByTarget.get(edge.targetNodeId) ?? []
    list.push(edge)
    inboundByTarget.set(edge.targetNodeId, list)
  }

  return edges.map((edge) => {
    const target = nodes.find((n) => n.id === edge.targetNodeId)
    const recv = target?.receives.find((r) => r.typeId === edge.typeId)
    if (recv && recv.unitsPerHour > 0) {
      const inbound =
        inboundByTarget.get(edge.targetNodeId)?.filter((e) => e.typeId === edge.typeId) ?? [edge]
      if (inbound.length === 1) {
        return { ...edge, unitsPerHour: recv.unitsPerHour }
      }
      const totalRaw = inbound.reduce((sum, e) => sum + e.unitsPerHour, 0)
      if (totalRaw <= 0) return { ...edge, unitsPerHour: recv.unitsPerHour }
      return {
        ...edge,
        unitsPerHour: (edge.unitsPerHour / totalRaw) * recv.unitsPerHour,
      }
    }

    const source = nodes.find((n) => n.id === edge.sourceNodeId)
    const prod = source?.produces.find((p) => p.typeId === edge.typeId)
    if (prod && prod.unitsPerHour > 0) {
      return { ...edge, unitsPerHour: prod.unitsPerHour }
    }

    return edge
  })
}

export function layoutChainGraph(graph: ChainGraph): ChainGraphLayout {
  const layerBuckets = new Map<number, ChainNode[]>()
  for (const node of graph.nodes) {
    const list = layerBuckets.get(node.layer) ?? []
    list.push(node)
    layerBuckets.set(node.layer, list)
  }

  const layers = [...layerBuckets.keys()].sort((a, b) => a - b)
  const layoutNodes: LayoutBounds[] = []
  let maxHeight = 0
  let maxWidth = 0

  for (const layer of layers) {
    const bucket = (layerBuckets.get(layer) ?? []).sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label)
    )
    const x = CHAIN_PADDING + layer * (CHAIN_NODE_WIDTH + CHAIN_LAYER_GAP)
    let y = CHAIN_PADDING

    for (const node of bucket) {
      const height = estimateChainNodeHeight(node)
      layoutNodes.push({
        nodeId: node.id,
        x,
        y,
        width: CHAIN_NODE_WIDTH,
        height,
      })
      y += height + CHAIN_NODE_GAP
    }

    maxHeight = Math.max(maxHeight, y + CHAIN_PADDING)
    maxWidth = Math.max(maxWidth, x + CHAIN_NODE_WIDTH + CHAIN_PADDING)
  }

  return {
    width: maxWidth,
    height: maxHeight,
    nodes: layoutNodes,
  }
}

export function tierEdgeColor(tier?: PiCommodityTier): string {
  switch (tier) {
    case 0:
      return '#94a3b8'
    case 1:
      return '#60a5fa'
    case 2:
      return '#34d399'
    case 3:
      return '#a78bfa'
    case 4:
      return '#f472b6'
    default:
      return '#71717a'
  }
}

export function edgeStrokeWidth(unitsPerHour: number): number {
  if (unitsPerHour <= 0) return 1.5
  const scaled = Math.log10(unitsPerHour + 1)
  return Math.min(4, Math.max(1.5, scaled * 0.85))
}

export function getHighlightedGraphIds(
  graph: ChainGraph,
  selectedNodeId: string | null,
  selectedTypeId: number | null
): {
  nodeIds: Set<string>
  edgeIds: Set<string>
} {
  if (!selectedNodeId && selectedTypeId == null) {
    return {
      nodeIds: new Set(graph.nodes.map((n) => n.id)),
      edgeIds: new Set(graph.edges.map((e) => e.id)),
    }
  }

  if (selectedTypeId != null) {
    const edgeIds = new Set(
      graph.edges.filter((e) => e.typeId === selectedTypeId).map((e) => e.id)
    )
    const nodeIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edge.typeId === selectedTypeId) {
        nodeIds.add(edge.sourceNodeId)
        nodeIds.add(edge.targetNodeId)
      }
    }
    return { nodeIds, edgeIds }
  }

  const edgeIds = new Set<string>()
  const nodeIds = new Set<string>([selectedNodeId!])

  for (const edge of graph.edges) {
    if (edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId) {
      edgeIds.add(edge.id)
      nodeIds.add(edge.sourceNodeId)
      nodeIds.add(edge.targetNodeId)
    }
  }

  return { nodeIds, edgeIds }
}
