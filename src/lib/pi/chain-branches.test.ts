import {
  buildProductionLineStages,
  mergeIdenticalProductionNodes,
  type PinLineNode,
} from '@/lib/pi/chain-branches'
import type { PiColonyAnalysis, PiPinView } from '@/lib/pi/types'

const BASIC_FACILITY = 'Basic Industry Facility'
const LAUNCHPAD = 'Launchpad'

function makeProcessorPin(id: number, index: number, outputTypeId = 2390): PiPinView {
  return {
    pinId: id,
    typeId: 2469,
    role: 'basic_processor',
    roleIndex: index,
    structureName: BASIC_FACILITY,
    label: `${BASIC_FACILITY} (#${id})`,
    itemTypeId: outputTypeId,
    itemName: 'Mechanical Parts',
  }
}

function makeNode(pin: PiPinView, units: number): PinLineNode {
  return {
    pin,
    pinIds: [pin.pinId],
    receives: [
      {
        typeId: 2073,
        name: 'Water',
        unitsPerHour: units,
        peerLabels: [`${LAUNCHPAD} (#300)`],
      },
    ],
    produces: [
      {
        typeId: 2390,
        name: 'Mechanical Parts',
        unitsPerHour: units,
        peerLabels: [`${LAUNCHPAD} (#300)`],
      },
    ],
  }
}

describe('mergeIdenticalProductionNodes', () => {
  it('merges factories with identical receive/produce routes and sums rates', () => {
    const nodes = [
      makeNode(makeProcessorPin(201, 1), 100),
      makeNode(makeProcessorPin(202, 2), 100),
      makeNode(makeProcessorPin(203, 3), 100),
    ]

    const merged = mergeIdenticalProductionNodes(nodes)

    expect(merged).toHaveLength(1)
    expect(merged[0].groupCount).toBe(3)
    expect(merged[0].displayLabel).toBe(`${BASIC_FACILITY} (#201–203)`)
    expect(merged[0].receives[0].unitsPerHour).toBe(300)
    expect(merged[0].produces[0].unitsPerHour).toBe(300)
  })

  it('keeps separate groups when destinations differ', () => {
    const nodeA = makeNode(makeProcessorPin(201, 1), 100)
    const nodeB = makeNode(makeProcessorPin(204, 4), 100)
    nodeB.produces[0].peerLabels = [`${LAUNCHPAD} (#301)`]

    const merged = mergeIdenticalProductionNodes([nodeA, nodeB])

    expect(merged).toHaveLength(2)
  })
})

describe('buildProductionLineStages grouping', () => {
  it('groups identical factories in production stage', () => {
    const colony = {
      characterId: 1,
      characterName: 'Pilot',
      planetId: 1,
      planetType: 'temperate',
      planetTypeLabel: 'Temperate',
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
      balances: { potential: [], current: [] },
      pins: [],
      bufferStatus: { status: 'running' as const },
      extractors: [],
      recipes: [
        {
          schematicId: 131,
          name: 'Mechanical Parts',
          cycleTimeSec: 3600,
          pinId: 201,
          pinRole: 'basic_processor' as const,
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
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 2,
            sourcePinId: 300,
            destPinId: 202,
            typeId: 2073,
            name: 'Water',
            quantity: 20,
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 3,
            sourcePinId: 300,
            destPinId: 203,
            typeId: 2073,
            name: 'Water',
            quantity: 20,
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 4,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 2390,
            name: 'Mechanical Parts',
            quantity: 5,
            kind: 'toExportStore' as const,
          },
          {
            routeId: 5,
            sourcePinId: 202,
            destPinId: 300,
            typeId: 2390,
            name: 'Mechanical Parts',
            quantity: 5,
            kind: 'toExportStore' as const,
          },
          {
            routeId: 6,
            sourcePinId: 203,
            destPinId: 300,
            typeId: 2390,
            name: 'Mechanical Parts',
            quantity: 5,
            kind: 'toExportStore' as const,
          },
        ],
      },
      warnings: [],
    } as PiColonyAnalysis

    const stages = buildProductionLineStages(colony, 'potential', (pin) => pin.label)

    expect(stages?.production).toHaveLength(1)
    expect(stages?.production[0].groupCount).toBe(3)
  })

  it('builds production stage from pin schematic when recipes list is empty', () => {
    const colony = {
      characterId: 1,
      characterName: 'Pilot',
      planetId: 1,
      planetType: 'barren',
      planetTypeLabel: 'Barren',
      colonyRole: 'factory_only' as const,
      solarSystemId: 1,
      solarSystemName: 'Jita',
      upgradeLevel: 4,
      numPins: 4,
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
      balances: { potential: [], current: [] },
      pins: [],
      bufferStatus: { status: 'running' as const },
      extractors: [],
      recipes: [],
      commodities: [],
      routing: {
        pins: [
          {
            pinId: 201,
            typeId: 2469,
            role: 'basic_processor' as const,
            roleIndex: 1,
            structureName: BASIC_FACILITY,
            label: `${BASIC_FACILITY} (#201)`,
            schematicId: 131,
            itemTypeId: 2390,
            itemName: 'Mechanical Parts',
          },
          {
            pinId: 300,
            typeId: 2256,
            role: 'launchpad' as const,
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
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 2,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 2390,
            name: 'Mechanical Parts',
            quantity: 5,
            kind: 'toExportStore' as const,
          },
        ],
      },
      warnings: [],
    } as PiColonyAnalysis

    const stages = buildProductionLineStages(colony, 'potential', (pin) => pin.label)
    expect(stages?.production).toHaveLength(1)
    expect(stages?.production[0].produces[0]?.unitsPerHour).toBeGreaterThan(0)
  })

  it('infers orbital imports for factory-only colonies without isImported flags', () => {
    const colony = {
      characterId: 1,
      characterName: 'Pilot',
      planetId: 2,
      planetType: 'barren',
      planetTypeLabel: 'Barren',
      colonyRole: 'factory_only' as const,
      solarSystemId: 1,
      solarSystemName: 'Jita',
      upgradeLevel: 4,
      numPins: 4,
      isStale: true,
      potentialNetIskPerHour: 0,
      currentNetIskPerHour: 0,
      exportRevenuePerHour: 0,
      importCostPerHour: 0,
      potentialExportRevenuePerHour: 0,
      potentialImportCostPerHour: 0,
      currentExportRevenuePerHour: 0,
      currentImportCostPerHour: 0,
      exitUnitPrice: 0,
      config: { planetId: 2, surplusForSale: true },
      balances: {
        potential: [
          {
            typeId: 3689,
            name: 'Mechanical Parts',
            tier: 2 as const,
            demandPerHour: 20,
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
        ],
        current: [],
      },
      pins: [],
      bufferStatus: { status: 'running' as const },
      extractors: [],
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
      commodities: [],
      routing: {
        pins: [
          {
            pinId: 201,
            typeId: 2472,
            role: 'advanced_processor' as const,
            roleIndex: 1,
            structureName: 'Advanced Industry Facility',
            label: 'Advanced Industry Facility (#201)',
            schematicId: 73,
            itemTypeId: 2348,
            itemName: 'Robotics',
          },
          {
            pinId: 300,
            typeId: 2256,
            role: 'launchpad' as const,
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
            typeId: 3689,
            name: 'Mechanical Parts',
            quantity: 40,
            kind: 'fromStoreToFactory' as const,
          },
          {
            routeId: 2,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 2348,
            name: 'Robotics',
            quantity: 3,
            kind: 'toExportStore' as const,
          },
        ],
      },
      warnings: [],
    } as PiColonyAnalysis

    const stages = buildProductionLineStages(colony, 'potential', (pin) => pin.label)
    const importNode = stages?.virtual.find((node) => node.kind === 'import')
    expect(importNode?.flows.some((flow) => flow.typeId === 3689)).toBe(true)
    expect(importNode?.flows.find((flow) => flow.typeId === 3689)?.unitsPerHour).toBe(40)

    const exportNode = stages?.virtual.find((node) => node.kind === 'export')
    expect(exportNode?.flows.some((flow) => flow.typeId === 2348)).toBe(true)
    expect(exportNode?.flows.find((flow) => flow.typeId === 2348)?.unitsPerHour).toBe(6)

    expect(stages?.input.some((node) => node.pin.pinId === 300)).toBe(false)
    expect(stages?.export.some((node) => node.pin.pinId === 300)).toBe(true)
    const launchpadExport = stages?.export.find((node) => node.pin.pinId === 300)
    expect(launchpadExport?.receives.find((flow) => flow.typeId === 2348)?.unitsPerHour).toBe(3)

    const factory = stages?.production[0]
    expect(factory?.receives.every((flow) => flow.sourceKind === 'import')).toBe(true)
    expect(factory?.receives.every((flow) => flow.peerLabels.length === 0)).toBe(true)
  })

  it('sums factory output on export launchpad when multiple processors share one store', () => {
    const colony = {
      characterId: 1,
      characterName: 'Pilot',
      planetId: 3,
      planetType: 'barren',
      planetTypeLabel: 'Barren',
      colonyRole: 'factory_only' as const,
      solarSystemId: 1,
      solarSystemName: 'Jita',
      upgradeLevel: 4,
      numPins: 5,
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
      config: { planetId: 3, surplusForSale: true },
      balances: {
        potential: [
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
      pins: [],
      bufferStatus: { status: 'running' as const },
      extractors: [],
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
      commodities: [],
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
            structureName: LAUNCHPAD,
            label: `${LAUNCHPAD} (#300)`,
          },
        ],
        routes: [
          {
            routeId: 1,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 2348,
            name: 'Robotics',
            quantity: 3,
            kind: 'toExportStore' as const,
          },
          {
            routeId: 2,
            sourcePinId: 202,
            destPinId: 300,
            typeId: 2348,
            name: 'Robotics',
            quantity: 3,
            kind: 'toExportStore' as const,
          },
        ],
      },
      warnings: [],
    } as PiColonyAnalysis

    const stages = buildProductionLineStages(colony, 'potential', (pin) => pin.label)
    const launchpadExport = stages?.export.find((node) => node.pin.pinId === 300)
    expect(launchpadExport?.receives.find((flow) => flow.typeId === 2348)?.unitsPerHour).toBe(6)
    expect(stages?.production[0]?.groupCount).toBe(2)
    expect(stages?.production[0]?.produces.find((flow) => flow.typeId === 2348)?.unitsPerHour).toBe(6)
  })
})
