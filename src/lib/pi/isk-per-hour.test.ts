import { applyColonyPricing } from '@/lib/pi/production-graph'
import { computePortfolioTotals } from '@/lib/pi/isk-per-hour'
import { DEFAULT_PI_EXPORT_TAX_RATE } from '@/lib/pi/pi-pricing'
import type { PiColonyAnalysis } from '@/lib/pi/types'

function mockAnalysis(overrides: Partial<PiColonyAnalysis> = {}): PiColonyAnalysis {
  return {
    characterId: 1,
    characterName: 'Pilot',
    planetId: 1,
    planetType: 'temperate',
    planetTypeLabel: 'Temperate',
    solarSystemId: 30000142,
    solarSystemName: 'Jita',
    upgradeLevel: 0,
    numPins: 3,
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
          typeId: 3645,
          name: 'Water',
          tier: 1,
          demandPerHour: 0,
          extractionPerHour: 0,
          productionPerHour: 120,
          localSupplyPerHour: 120,
          importNeededPerHour: 0,
          surplusPerHour: 0,
          exportedPerHour: 120,
          wastedPerHour: 0,
          isImported: false,
          isExportable: true,
        },
      ],
      current: [
        {
          typeId: 3645,
          name: 'Water',
          tier: 1,
          demandPerHour: 0,
          extractionPerHour: 0,
          productionPerHour: 80,
          localSupplyPerHour: 80,
          importNeededPerHour: 0,
          surplusPerHour: 0,
          exportedPerHour: 80,
          wastedPerHour: 0,
          isImported: false,
          isExportable: true,
        },
      ],
    },
    pins: [],
    bufferStatus: { status: 'running' },
    bufferStatusCurrent: { status: 'running' },
    extractors: [],
    recipes: [],
    commodities: [
      {
        typeId: 3645,
        name: 'Water',
        tier: 1,
        potentialExportedPerHour: 120,
        currentExportedPerHour: 80,
        role: 'exported',
      },
    ],
    warnings: [],
    routing: { pins: [], routes: [] },
    exitTypeId: 3645,
    exitName: 'Water',
    exitTier: 1,
    ...overrides,
  }
}

describe('isk-per-hour pricing', () => {
  it('values export at Jita sell minus export tax', () => {
    const priced = applyColonyPricing(mockAnalysis(), {
      3645: { buy: 400, sell: 500 },
    })

    // Water is P1 → customs on base value 400, not on the 500 sell price.
    const expectedPotential = 120 * 500 - 120 * 400 * DEFAULT_PI_EXPORT_TAX_RATE
    const expectedCurrent = 80 * 500 - 80 * 400 * DEFAULT_PI_EXPORT_TAX_RATE
    expect(priced.potentialNetIskPerHour).toBeCloseTo(expectedPotential)
    expect(priced.currentNetIskPerHour).toBeCloseTo(expectedCurrent)
    expect(priced.exitUnitPrice).toBe(500)
  })

  it('tags each balance with the price origin from provenance', () => {
    const priced = applyColonyPricing(mockAnalysis(), { 3645: { buy: 400, sell: 500 } }, {
      provenance: { 3645: { buy: 'region', sell: 'structure' } },
    })
    // Water is exported here → uses the sell origin.
    const row = priced.balances.potential.find((b) => b.typeId === 3645)
    expect(row?.priceOrigin).toBe('structure')
  })

  it('returns zero NET ISK/h when exit price missing and adds warning', () => {
    const priced = applyColonyPricing(mockAnalysis(), {})
    expect(priced.potentialNetIskPerHour).toBe(0)
    expect(priced.currentNetIskPerHour).toBe(0)
    expect(priced.warnings.length).toBeGreaterThan(0)
  })

  it('subtracts import cost at Jita buy from NET ISK/h', () => {
    const priced = applyColonyPricing(
      mockAnalysis({
        balances: {
          potential: [
            {
              typeId: 3645,
              name: 'Water',
              tier: 1,
              demandPerHour: 0,
              extractionPerHour: 0,
              productionPerHour: 100,
              localSupplyPerHour: 100,
              importNeededPerHour: 0,
              surplusPerHour: 0,
              exportedPerHour: 100,
              wastedPerHour: 0,
              isImported: false,
              isExportable: true,
            },
            {
              typeId: 2073,
              name: 'Aqueous Liquids',
              tier: 0,
              demandPerHour: 50,
              extractionPerHour: 0,
              productionPerHour: 0,
              localSupplyPerHour: 0,
              importNeededPerHour: 50,
              surplusPerHour: 0,
              exportedPerHour: 0,
              wastedPerHour: 0,
              isImported: true,
              isExportable: false,
            },
          ],
          current: [],
        },
      }),
      {
        3645: { buy: 900, sell: 1000 },
        2073: { buy: 10, sell: 5 },
      }
    )

    // Water is P1 (base 400): export customs = 100 * 400 * rate, on base not sell.
    expect(priced.potentialExportRevenuePerHour).toBeCloseTo(
      100 * 1000 - 100 * 400 * DEFAULT_PI_EXPORT_TAX_RATE
    )
    // Aqueous Liquids is R0 (base 5): import customs = 50 * 5 * rate * 0.5, on base.
    expect(priced.potentialImportCostPerHour).toBeCloseTo(
      50 * 10 + 50 * 5 * DEFAULT_PI_EXPORT_TAX_RATE * 0.5
    )
    expect(priced.potentialNetIskPerHour).toBeCloseTo(
      100 * 1000 -
        100 * 400 * DEFAULT_PI_EXPORT_TAX_RATE -
        (50 * 10 + 50 * 5 * DEFAULT_PI_EXPORT_TAX_RATE * 0.5)
    )
  })
})

describe('computePortfolioTotals', () => {
  it('sums every colony — each one is standalone', () => {
    const a: PiColonyAnalysis = {
      ...mockAnalysis(),
      planetId: 1,
      potentialNetIskPerHour: 1000,
      currentNetIskPerHour: 500,
    }
    const b: PiColonyAnalysis = {
      ...mockAnalysis(),
      planetId: 2,
      potentialNetIskPerHour: 9000,
      currentNetIskPerHour: 4000,
    }

    const totals = computePortfolioTotals([a, b])
    expect(totals.potentialNetIskPerHour).toBe(10000)
    expect(totals.currentNetIskPerHour).toBe(4500)
  })
})
