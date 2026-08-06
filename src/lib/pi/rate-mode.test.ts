import type { PiColonyAnalysis } from '@/lib/pi/types'
import {
  colonyExportRevenuePerHour,
  colonyImportCostPerHour,
  colonyNetIskPerHour,
  selectBalances,
} from '@/lib/pi/rate-mode'

function mockColony(overrides: Partial<PiColonyAnalysis> = {}): PiColonyAnalysis {
  return {
    characterId: 1,
    characterName: 'Pilot',
    planetId: 1,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    solarSystemId: 30000142,
    solarSystemName: 'Jita',
    upgradeLevel: 5,
    numPins: 3,
    lastUpdate: new Date().toISOString(),
    isStale: false,
    potentialNetIskPerHour: 100,
    currentNetIskPerHour: 50,
    exportRevenuePerHour: 100,
    importCostPerHour: 0,
    potentialExportRevenuePerHour: 100,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 60,
    currentImportCostPerHour: 10,
    exitUnitPrice: 1000,
    config: { planetId: 1, surplusForSale: true },
    balances: {
      potential: [],
      current: [{ typeId: 1, name: 'X', tier: 0, demandPerHour: 1, extractionPerHour: 0, productionPerHour: 0, localSupplyPerHour: 0, importNeededPerHour: 0, surplusPerHour: 0, exportedPerHour: 0, wastedPerHour: 0, isImported: false, isExportable: true }],
    },
    pins: [],
    bufferStatus: { status: 'running', timeToStopHrs: 10, limitingPinId: 1, limitingTypeId: 1 },
    bufferStatusCurrent: { status: 'stalled', timeToStopHrs: 0, limitingPinId: 1, limitingTypeId: 1 },
    extractors: [],
    recipes: [],
    commodities: [],
    routing: { pins: [], edges: [], routes: [] },
    warnings: [],
    ...overrides,
  }
}

describe('rate-mode helpers', () => {
  it('selects potential vs current balances and ISK fields', () => {
    const colony = mockColony()
    expect(selectBalances(colony, 'potential')).toBe(colony.balances.potential)
    expect(selectBalances(colony, 'current')).toBe(colony.balances.current)
    expect(colonyNetIskPerHour(colony, 'potential')).toBe(100)
    expect(colonyNetIskPerHour(colony, 'current')).toBe(50)
    expect(colonyExportRevenuePerHour(colony, 'current')).toBe(60)
    expect(colonyImportCostPerHour(colony, 'current')).toBe(10)
  })
})
