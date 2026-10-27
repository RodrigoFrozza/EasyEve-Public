import {
  normalizeColonyAnalysis,
  normalizePiColoniesResponse,
} from '@/lib/pi/normalize-response'
import type { PiColonyAnalysis, PiColoniesResponse } from '@/lib/pi/types'

function legacyColony(): PiColonyAnalysis & {
  designedIskPerHour?: number
  currentIskPerHour?: number
} {
  return {
    characterId: 1,
    characterName: 'Pilot',
    planetId: 42,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    solarSystemId: 100,
    solarSystemName: 'System 100',
    upgradeLevel: 4,
    numPins: 10,
    isStale: false,
    designedIskPerHour: 5000,
    currentIskPerHour: 3000,
    potentialNetIskPerHour: undefined as unknown as number,
    currentNetIskPerHour: undefined as unknown as number,
    exportRevenuePerHour: 0,
    importCostPerHour: 0,
    potentialExportRevenuePerHour: 0,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 0,
    currentImportCostPerHour: 0,
    exitUnitPrice: 0,
    config: undefined as unknown as PiColonyAnalysis['config'],
    balances: undefined as unknown as PiColonyAnalysis['balances'],
    pins: undefined as unknown as PiColonyAnalysis['pins'],
    bufferStatus: undefined as unknown as PiColonyAnalysis['bufferStatus'],
    extractors: [],
    recipes: [],
    commodities: [],
    routing: undefined as unknown as PiColonyAnalysis['routing'],
    warnings: [],
  }
}

describe('normalize-response', () => {
  it('fills missing bufferStatus and config on legacy colonies', () => {
    const normalized = normalizeColonyAnalysis(legacyColony())

    expect(normalized.bufferStatus.status).toBe('running')
    expect(normalized.pinBuffers).toEqual({ potential: [], current: [] })
    expect(normalized.config).toEqual({ planetId: 42, surplusForSale: true })
    expect(normalized.balances).toEqual({ potential: [], current: [] })
    expect(normalized.routing).toEqual({ pins: [], routes: [] })
    expect(normalized.potentialNetIskPerHour).toBe(5000)
    expect(normalized.currentNetIskPerHour).toBe(3000)
  })

  it('does not crash when a legacy payload has balances in a different (non potential/current) shape', () => {
    const legacyShapedBalances = { designed: [] } as unknown as PiColonyAnalysis['balances']

    const normalized = normalizeColonyAnalysis({
      ...legacyColony(),
      balances: legacyShapedBalances,
    })

    expect(normalized.balances).toEqual({ potential: [], current: [] })
  })

  it('refreshes stale commodity tiers from typeId', () => {
    const normalized = normalizeColonyAnalysis({
      ...legacyColony(),
      balances: {
        potential: [
          {
            typeId: 3689,
            name: 'Mechanical Parts',
            tier: 0,
            demandPerHour: 0,
            productionPerHour: 100,
            extractionPerHour: 0,
            importNeededPerHour: 0,
            exportedPerHour: 100,
            surplusPerHour: 0,
            wastedPerHour: 0,
            isImported: false,
          },
        ],
        current: [],
      },
      recipes: [
        {
          schematicId: 73,
          name: 'Mechanical Parts',
          cycleTimeSec: 3600,
          pinId: 201,
          pinRole: 'basic_processor',
          inputs: [{ typeId: 2398, name: 'Reactive Metals', qty: 40, tier: 0 }],
          output: { typeId: 3689, name: 'Mechanical Parts', qty: 5, tier: 0 },
          designedOutputPerHour: 100,
        },
      ],
      routing: {
        pins: [],
        routes: [
          {
            routeId: 1,
            sourcePinId: 201,
            destPinId: 300,
            typeId: 3689,
            name: 'Mechanical Parts',
            tier: 0,
            quantity: 5,
            kind: 'toExportStore',
          },
        ],
      },
    })

    expect(normalized.balances.potential[0].tier).toBe(2)
    expect(normalized.recipes[0].output.tier).toBe(2)
    expect(normalized.routing.routes[0].tier).toBe(2)
  })

  it('normalizes full API response with legacy totals', () => {
    const raw = {
      colonies: [legacyColony()],
      totals: {
        colonyCount: 1,
        designedIskPerHour: 5000,
        currentIskPerHour: 3000,
        potentialNetIskPerHour: undefined as unknown as number,
        currentNetIskPerHour: undefined as unknown as number,
      },
      fetchedAt: '2026-01-01T00:00:00.000Z',
      charactersWithoutScope: [],
    } as PiColoniesResponse

    const normalized = normalizePiColoniesResponse(raw)

    expect(normalized.totals.potentialNetIskPerHour).toBe(5000)
    expect(normalized.colonies[0].bufferStatus.status).toBe('running')
  })
})
