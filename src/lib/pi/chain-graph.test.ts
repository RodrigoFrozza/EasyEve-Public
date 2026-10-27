import {
  assignTopologicalLayers,
  buildColonyGraph,
  COLONY_EXPORT_NODE_ID,
  COLONY_IMPORT_NODE_ID,
  getHighlightedGraphIds,
  layoutChainGraph,
  type ChainEdge,
  type ChainGraph,
  type ChainNode,
} from '@/lib/pi/chain-graph'
import type { PiColonyAnalysis } from '@/lib/pi/types'

const BASIC_FACILITY = 'Basic Industry Facility'
const LAUNCHPAD = 'Launchpad'

function makeProcessorPin(id: number, index: number): PiColonyAnalysis['routing']['pins'][number] {
  return {
    pinId: id,
    typeId: 2469,
    role: 'basic_processor',
    roleIndex: index,
    structureName: BASIC_FACILITY,
    label: `${BASIC_FACILITY} (#${id})`,
    itemTypeId: 2390,
    itemName: 'Mechanical Parts',
  }
}

function makeTestColony(): PiColonyAnalysis {
  return {
    characterId: 1,
    characterName: 'Pilot',
    planetId: 1,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    colonyRole: 'factory_only',
    solarSystemId: 1,
    solarSystemName: 'Jita',
    upgradeLevel: 4,
    numPins: 10,
    isStale: false,
    potentialNetIskPerHour: 0,
    currentNetIskPerHour: 0,
    exportRevenuePerHour: 0,
    importCostPerHour: 0,
    potentialExportRevenuePerHour: 0,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 0,
    currentImportCostPerHour: 0,
    exitUnitPrice: 0,
    config: { planetId: 1, surplusForSale: true },
    balances: {
      potential: [
        {
          typeId: 2073,
          name: 'Water',
          tier: 0,
          demandPerHour: 300,
          productionPerHour: 0,
          extractionPerHour: 0,
          localSupplyPerHour: 0,
          importNeededPerHour: 300,
          exportedPerHour: 0,
          surplusPerHour: 0,
          wastedPerHour: 0,
          isImported: true,
          isExportable: false,
        },
        {
          typeId: 2390,
          name: 'Mechanical Parts',
          tier: 1,
          demandPerHour: 0,
          productionPerHour: 300,
          extractionPerHour: 0,
          localSupplyPerHour: 300,
          importNeededPerHour: 0,
          exportedPerHour: 300,
          surplusPerHour: 300,
          wastedPerHour: 0,
          isImported: false,
          isExportable: true,
        },
      ],
      current: [],
    },
    pins: [],
    bufferStatus: { status: 'running' },
    extractors: [],
    recipes: [
      {
        schematicId: 131,
        name: 'Mechanical Parts',
        cycleTimeSec: 3600,
        pinId: 201,
        pinRole: 'basic_processor',
        inputs: [{ typeId: 2073, name: 'Water', qty: 3000 }],
        output: { typeId: 2390, name: 'Mechanical Parts', qty: 20 },
        designedOutputPerHour: 600,
      },
    ],
    commodities: [],
    routing: {
      pins: [
        makeProcessorPin(201, 1),
        makeProcessorPin(202, 2),
        makeProcessorPin(203, 3),
        {
          pinId: 300,
          typeId: 2256,
          role: 'launchpad',
          roleIndex: 1,
          structureName: LAUNCHPAD,
          label: `${LAUNCHPAD} (#300)`,
        },
      ],
      routes: [
        {
          routeId: 1,
          sourcePinId: 300,
          destPinId: 201,
          typeId: 2073,
          name: 'Water',
          quantity: 20,
          kind: 'fromStoreToFactory',
        },
        {
          routeId: 2,
          sourcePinId: 300,
          destPinId: 202,
          typeId: 2073,
          name: 'Water',
          quantity: 20,
          kind: 'fromStoreToFactory',
        },
        {
          routeId: 3,
          sourcePinId: 300,
          destPinId: 203,
          typeId: 2073,
          name: 'Water',
          quantity: 20,
          kind: 'fromStoreToFactory',
        },
        {
          routeId: 4,
          sourcePinId: 201,
          destPinId: 300,
          typeId: 2390,
          name: 'Mechanical Parts',
          quantity: 5,
          kind: 'toExportStore',
        },
        {
          routeId: 5,
          sourcePinId: 202,
          destPinId: 300,
          typeId: 2390,
          name: 'Mechanical Parts',
          quantity: 5,
          kind: 'toExportStore',
        },
        {
          routeId: 6,
          sourcePinId: 203,
          destPinId: 300,
          typeId: 2390,
          name: 'Mechanical Parts',
          quantity: 5,
          kind: 'toExportStore',
        },
      ],
    },
    warnings: [],
  } as PiColonyAnalysis
}

describe('assignTopologicalLayers', () => {
  function layerById(nodes: ChainNode[]): Map<string, number> {
    return new Map(nodes.map((n) => [n.id, n.layer]))
  }

  it('assigns strictly increasing layers along extractor → storage → factory chain', () => {
    const nodes: ChainNode[] = [
      {
        id: 'extractor-pin-1',
        layer: 0,
        role: 'extractor',
        label: 'Extractor',
        pinIds: [1],
        receives: [],
        produces: [],
      },
      {
        id: 'input-pin-2',
        layer: 0,
        role: 'storage',
        label: 'Storage',
        pinIds: [2],
        receives: [],
        produces: [],
      },
      {
        id: 'production-pin-3',
        layer: 0,
        role: 'basic_processor',
        label: 'Basic Factory',
        pinIds: [3],
        receives: [],
        produces: [],
      },
      {
        id: 'production-pin-4',
        layer: 0,
        role: 'advanced_processor',
        label: 'Advanced Factory',
        pinIds: [4],
        receives: [],
        produces: [],
      },
      {
        id: 'export-pin-5',
        layer: 0,
        role: 'launchpad',
        label: 'Export Store',
        pinIds: [5],
        receives: [],
        produces: [],
      },
    ]
    const edges: ChainEdge[] = [
      {
        id: 'e1',
        sourceNodeId: 'extractor-pin-1',
        targetNodeId: 'input-pin-2',
        typeId: 1,
        name: 'R0',
        unitsPerHour: 10,
      },
      {
        id: 'e2',
        sourceNodeId: 'input-pin-2',
        targetNodeId: 'production-pin-3',
        typeId: 2,
        name: 'R1',
        unitsPerHour: 10,
      },
      {
        id: 'e3',
        sourceNodeId: 'production-pin-3',
        targetNodeId: 'production-pin-4',
        typeId: 3,
        name: 'R2',
        unitsPerHour: 10,
      },
      {
        id: 'e4',
        sourceNodeId: 'production-pin-4',
        targetNodeId: 'export-pin-5',
        typeId: 4,
        name: 'P4',
        unitsPerHour: 10,
      },
    ]

    assignTopologicalLayers(nodes, edges)
    const layers = layerById(nodes)

    expect(layers.get('extractor-pin-1')).toBe(0)
    expect(layers.get('input-pin-2')).toBe(1)
    expect(layers.get('production-pin-3')).toBe(2)
    expect(layers.get('production-pin-4')).toBe(3)
    expect(layers.get('export-pin-5')).toBe(4)

    for (const edge of edges) {
      const sourceLayer = layers.get(edge.sourceNodeId) ?? 0
      const targetLayer = layers.get(edge.targetNodeId) ?? 0
      expect(targetLayer).toBeGreaterThan(sourceLayer)
    }
  })

  it('handles cyclic dependencies gracefully without infinite loop', () => {
    const nodes: ChainNode[] = [
      { id: 'node-1', layer: 0, role: 'basic_processor', label: 'Factory 1', pinIds: [1], receives: [], produces: [] },
      { id: 'node-2', layer: 0, role: 'basic_processor', label: 'Factory 2', pinIds: [2], receives: [], produces: [] },
    ]
    const edges: ChainEdge[] = [
      { id: 'e1', sourceNodeId: 'node-1', targetNodeId: 'node-2', typeId: 1, name: 'P1', unitsPerHour: 10 },
      { id: 'e2', sourceNodeId: 'node-2', targetNodeId: 'node-1', typeId: 2, name: 'P2', unitsPerHour: 10 },
    ]

    expect(() => assignTopologicalLayers(nodes, edges)).not.toThrow()
    const layers = layerById(nodes)
    expect(layers.get('node-1')).toBeDefined()
    expect(layers.get('node-2')).toBeDefined()
  })
})

describe('buildColonyGraph', () => {
  it('builds layered nodes and edges from colony routing', () => {
    const graph = buildColonyGraph(makeTestColony(), 'potential')
    expect(graph).not.toBeNull()
    expect(graph!.nodes.length).toBeGreaterThan(0)
    expect(graph!.edges.length).toBeGreaterThan(0)

    const mergedFactory = graph!.nodes.find((n) => n.groupCount === 3)
    expect(mergedFactory).toBeDefined()
    expect(mergedFactory!.pinIds).toEqual([201, 202, 203])

    const inputStore = graph!.nodes.find(
      (n) => n.pinIds.includes(300) && n.id.startsWith('input-')
    )
    const exportStore = graph!.nodes.find(
      (n) => n.pinIds.includes(300) && n.id.startsWith('export-')
    )
    expect(inputStore).toBeUndefined()
    expect(exportStore).toBeDefined()

    const importNode = graph!.nodes.find((n) => n.id === COLONY_IMPORT_NODE_ID)
    expect(importNode).toBeDefined()

    const layers = new Map(graph!.nodes.map((n) => [n.id, n.layer]))
    expect(layers.get(importNode!.id)).toBeLessThan(layers.get(mergedFactory!.id)!)
    expect(layers.get(mergedFactory!.id)).toBeLessThan(layers.get(exportStore!.id)!)

    const maxLayer = Math.max(...graph!.nodes.map((n) => n.layer))
    const exportSink = graph!.nodes.find((n) => n.id === COLONY_EXPORT_NODE_ID)
    expect(exportSink).toBeDefined()
    expect(layers.get(exportStore!.id)).toBeLessThan(layers.get(exportSink!.id)!)
    expect(layers.get(exportSink!.id)).toBe(maxLayer)

    expect(graph!.edges.some((e) => e.kind === 'colony_import')).toBe(true)
    expect(graph!.edges.some((e) => e.kind === 'colony_export')).toBe(true)
    expect(
      graph!.edges.some(
        (e) =>
          e.sourceNodeId === COLONY_IMPORT_NODE_ID &&
          e.targetNodeId === mergedFactory!.id &&
          e.kind === 'colony_import'
      )
    ).toBe(true)

    for (const edge of graph!.edges) {
      const sourceLayer = layers.get(edge.sourceNodeId) ?? 0
      const targetLayer = layers.get(edge.targetNodeId) ?? 0
      expect(targetLayer).toBeGreaterThan(sourceLayer)
    }
  })

  it('aligns edge unitsPerHour with target node receive rate', () => {
    const graph = buildColonyGraph(makeTestColony(), 'potential')
    expect(graph).not.toBeNull()

    const factory = graph!.nodes.find((n) => n.groupCount === 3)!
    const exportStore = graph!.nodes.find(
      (n) => n.pinIds.includes(300) && n.id.startsWith('export-')
    )!
    const edge = graph!.edges.find(
      (e) => e.sourceNodeId === factory.id && e.targetNodeId === exportStore.id && e.typeId === 2390
    )
    expect(edge).toBeDefined()

    const recv = factory.receives.find((r) => r.typeId === 2073)
    const inbound = graph!.edges.find(
      (e) => e.targetNodeId === factory.id && e.typeId === 2073
    )
    expect(inbound).toBeDefined()
    if (recv && inbound) {
      expect(inbound!.unitsPerHour).toBe(recv.unitsPerHour)
    }
  })

  it('connects orbital import directly to factories on factory-only colonies', () => {
    const colony = {
      ...makeTestColony(),
      planetId: 99,
      colonyRole: 'factory_only' as const,
      balances: {
        potential: [
          {
            typeId: 3689,
            name: 'Mechanical Parts',
            tier: 2 as const,
            demandPerHour: 40,
            extractionPerHour: 0,
            productionPerHour: 0,
            localSupplyPerHour: 0,
            importNeededPerHour: 0,
            surplusPerHour: 0,
            exportedPerHour: 0,
            wastedPerHour: 0,
            isImported: false,
            isExportable: false,
          },
          {
            typeId: 2348,
            name: 'Robotics',
            tier: 3 as const,
            demandPerHour: 0,
            extractionPerHour: 0,
            productionPerHour: 6,
            localSupplyPerHour: 6,
            importNeededPerHour: 0,
            surplusPerHour: 6,
            exportedPerHour: 6,
            wastedPerHour: 0,
            isImported: false,
            isExportable: true,
          },
        ],
        current: [],
      },
      recipes: [
        {
          schematicId: 73,
          name: 'Robotics',
          cycleTimeSec: 3600,
          pinId: 201,
          pinRole: 'advanced_processor' as const,
          inputs: [
            { typeId: 3689, name: 'Mechanical Parts', qty: 40, tier: 2 as const },
            { typeId: 9832, name: 'Consumer Electronics', qty: 40, tier: 2 as const },
          ],
          output: { typeId: 2348, name: 'Robotics', qty: 3, tier: 3 as const },
          designedOutputPerHour: 6,
        },
      ],
      routing: {
        pins: [
          {
            pinId: 201,
            typeId: 2472,
            role: 'advanced_processor' as const,
            roleIndex: 1,
            structureName: 'Advanced Industry Facility',
            label: 'Advanced (#201)',
            schematicId: 73,
            itemTypeId: 2348,
            itemName: 'Robotics',
          },
          {
            pinId: 202,
            typeId: 2472,
            role: 'advanced_processor' as const,
            roleIndex: 2,
            structureName: 'Advanced Industry Facility',
            label: 'Advanced (#202)',
            schematicId: 73,
            itemTypeId: 2348,
            itemName: 'Robotics',
          },
          {
            pinId: 300,
            typeId: 2256,
            role: 'launchpad' as const,
            roleIndex: 1,
            structureName: 'Launchpad',
            label: 'Launchpad (#300)',
          },
        ],
        routes: [
          {
            routeId: 1,
            sourcePinId: 300,
            destPinId: 201,
            typeId: 3689,
            name: 'Mechanical Parts',
            quantity: 40,
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 2,
            sourcePinId: 300,
            destPinId: 202,
            typeId: 3689,
            name: 'Mechanical Parts',
            quantity: 40,
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 3,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 2348,
            name: 'Robotics',
            quantity: 3,
            kind: 'toExportStore' as const,
          },
          {
            routeId: 4,
            sourcePinId: 202,
            destPinId: 300,
            typeId: 2348,
            name: 'Robotics',
            quantity: 3,
            kind: 'toExportStore' as const,
          },
        ],
      },
    } as PiColonyAnalysis

    const graph = buildColonyGraph(colony, 'potential')
    expect(graph).not.toBeNull()

    const factory = graph!.nodes.find((n) => n.groupCount === 2)!
    const importEdges = graph!.edges.filter(
      (e) => e.sourceNodeId === COLONY_IMPORT_NODE_ID && e.targetNodeId === factory.id
    )
    expect(importEdges.some((e) => e.typeId === 3689)).toBe(true)
    expect(importEdges.some((e) => e.typeId === 9832)).toBe(true)
    expect(graph!.edges.some((e) => e.sourceNodeId === COLONY_IMPORT_NODE_ID && e.targetNodeId.startsWith('export-'))).toBe(
      false
    )
  })

  it('shows designed factory throughput in current mode when cascade is empty', () => {
    const colony = makeTestColony()
    colony.balances.current = []
    const graph = buildColonyGraph(colony, 'current')
    expect(graph?.nodes.find((n) => n.groupCount === 3)).toBeDefined()
  })
})

describe('layoutChainGraph', () => {
  it('assigns increasing x per layer', () => {
    const graph = buildColonyGraph(makeTestColony(), 'potential')
    expect(graph).not.toBeNull()
    const layout = layoutChainGraph(graph!)
    const byId = new Map(layout.nodes.map((n) => [n.nodeId, n]))

    const factory = graph!.nodes.find((n) => n.groupCount === 3)!
    const exportStore = graph!.nodes.find(
      (n) => n.pinIds.includes(300) && n.id.startsWith('export-')
    )!

    expect(byId.get(factory.id)!.x).toBeLessThan(byId.get(exportStore.id)!.x)
    const exportSink = graph!.nodes.find((n) => n.id === COLONY_EXPORT_NODE_ID)
    if (exportSink) {
      expect(byId.get(exportStore.id)!.x).toBeLessThanOrEqual(byId.get(exportSink.id)!.x)
    }
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThan(0)
  })
})


describe('getHighlightedGraphIds', () => {
  const graph: ChainGraph = {
    nodes: [
      { id: 'a', layer: 0, role: 'extractor', label: 'A', pinIds: [1], receives: [], produces: [] },
      { id: 'b', layer: 1, role: 'basic_processor', label: 'B', pinIds: [2], receives: [], produces: [] },
    ],
    edges: [
      {
        id: 'e1',
        sourceNodeId: 'a',
        targetNodeId: 'b',
        typeId: 100,
        name: 'Ore',
        unitsPerHour: 10,
      },
    ],
  }

  it('highlights connected nodes when a node is selected', () => {
    const { nodeIds, edgeIds } = getHighlightedGraphIds(graph, 'a', null)
    expect(nodeIds.has('a')).toBe(true)
    expect(nodeIds.has('b')).toBe(true)
    expect(edgeIds.has('e1')).toBe(true)
  })

  it('highlights path edges when a product type is selected', () => {
    const { nodeIds, edgeIds } = getHighlightedGraphIds(graph, null, 100)
    expect(edgeIds.has('e1')).toBe(true)
    expect(nodeIds.has('a')).toBe(true)
    expect(nodeIds.has('b')).toBe(true)
  })
})
