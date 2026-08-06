import { analyzeColonyLayout, applyColonyPricing } from '@/lib/pi/production-graph'
import { buildPlanetPins } from '@/lib/pi/export-tiers'
import type { PiColonyLayout, PiColonySummary } from '@/lib/pi/types'

const summary: PiColonySummary = {
  owner_id: 1,
  planet_id: 40000001,
  planet_type: 'temperate',
  solar_system_id: 30000142,
  upgrade_level: 0,
  num_pins: 4,
  last_update: new Date().toISOString(),
}

function makeMiningLayout(): PiColonyLayout {
  return {
    links: [],
    routes: [
      {
        route_id: 1,
        source_pin_id: 100,
        destination_pin_id: 200,
        content_type_id: 2073,
        quantity: 20,
      },
    ],
    pins: [
      {
        pin_id: 100,
        type_id: 3060,
        install_time: '2024-01-01T00:00:00Z',
        expiry_time: '2024-01-03T00:00:00Z',
        extractor_details: {
          product_type_id: 2073,
          qty_per_cycle: 5000,
          cycle_time: 1800,
          heads: [],
        },
      },
      {
        pin_id: 200,
        type_id: 2469,
        factory_details: { schematic_id: 131 },
        schematic_id: 131,
      },
      {
        pin_id: 300,
        type_id: 2256,
      },
    ],
  }
}

describe('production-graph', () => {
  it('classifies extracted entry and produced export for a simple P0→P1 colony', () => {
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: makeMiningLayout(),
      solarSystemName: 'Jita',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
    })

    expect(analysis.entryTypeId).toBe(2073)
    expect(analysis.extractors).toHaveLength(1)
    expect(analysis.recipes.length).toBeGreaterThan(0)
    expect(analysis.exitTypeId).toBeDefined()
    expect(analysis.balances.potential.length).toBeGreaterThan(0)
    expect(analysis.bufferStatus.status).toBeDefined()
    expect(analysis.routing.pins.length).toBeGreaterThan(0)
    expect(analysis.routing.routes.length).toBeGreaterThan(0)
    expect(analysis.commodities.some((c) => c.role === 'extracted' || c.extractedPerHour)).toBe(true)
  })

  it('applies NET Jita sell pricing with export revenue minus import cost', () => {
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: makeMiningLayout(),
      solarSystemName: 'Jita',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
    })

    const exitId = analysis.exitTypeId
    expect(exitId).toBeDefined()

    const priced = applyColonyPricing(analysis, {
      [exitId!]: { buy: 900, sell: 1000 },
      2073: { buy: 4, sell: 5 },
    })

    expect(priced.exitUnitPrice).toBe(1000)
    expect(priced.potentialNetIskPerHour).toBeGreaterThanOrEqual(0)
    expect(priced.currentNetIskPerHour).toBeGreaterThanOrEqual(0)
    expect(priced.potentialExportRevenuePerHour).toBeGreaterThanOrEqual(0)
  })

  it('computes resurvey ISK/h for extractors below designed output', () => {
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: makeMiningLayout(),
      solarSystemName: 'Jita',
      nowMs: Date.parse('2024-01-03T00:00:01Z'),
    })

    const priced = applyColonyPricing(analysis, {
      2073: { buy: 4, sell: 10 },
      2393: { buy: 900, sell: 1000 },
    })

    const extractor = priced.extractors[0]
    expect(extractor).toBeDefined()
    expect(extractor!.productUnitPrice).toBe(10)
    if (extractor!.designedUnitsPerHour > extractor!.currentUnitsPerHour) {
      expect(extractor!.resurveyIskPerHour).toBeGreaterThan(0)
    }
  })

  it('excludes wasted surplus from ISK/h when surplusForSale is off', () => {
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: makeMiningLayout(),
      solarSystemName: 'Jita',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
      config: { planetId: summary.planet_id, surplusForSale: false },
    })

    const exitId = analysis.exitTypeId!
    const withSurplus = applyColonyPricing(analysis, {
      [exitId]: { buy: 900, sell: 1000 },
      2073: { buy: 4, sell: 5 },
    })
    const withoutSurplusConfig = { ...analysis, config: { planetId: summary.planet_id, surplusForSale: false } }
    const withoutSurplus = applyColonyPricing(withoutSurplusConfig, {
      [exitId]: { buy: 900, sell: 1000 },
      2073: { buy: 4, sell: 5 },
    })

    expect(withSurplus.potentialNetIskPerHour).toBeGreaterThanOrEqual(
      withoutSurplus.potentialNetIskPerHour
    )
  })

  it('does not count wasted non-exportable surplus in export revenue', () => {
    const exitId = 2390
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: makeMiningLayout(),
      solarSystemName: 'Jita',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
      config: { planetId: summary.planet_id, surplusForSale: true },
    })

    const withWastedSurplus = {
      ...analysis,
      exitTypeId: exitId,
      balances: {
        potential: [
          {
            typeId: exitId,
            name: 'Exit',
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
            name: 'P0 surplus',
            tier: 0,
            demandPerHour: 10,
            extractionPerHour: 100,
            productionPerHour: 0,
            localSupplyPerHour: 100,
            importNeededPerHour: 0,
            surplusPerHour: 90,
            exportedPerHour: 0,
            wastedPerHour: 90,
            isImported: false,
            isExportable: false,
          },
        ],
        current: [],
      },
    }

    const priced = applyColonyPricing(withWastedSurplus, {
      [exitId]: { buy: 900, sell: 1000 },
      2073: { buy: 450, sell: 500 },
    })

    // Exit is Electrolytes (R0, base value 5): customs = 100 * 5 * 0.1, on the
    // base value not the 1000 sell. The wasted P0 surplus adds nothing.
    expect(priced.potentialExportRevenuePerHour).toBeCloseTo(100 * 1000 - 100 * 5 * 0.1)
  })

  it('does not mark P1 intermediates as export in a P0→P1→P2 chain', () => {
    const plasmaSummary: PiColonySummary = {
      ...summary,
      planet_type: 'plasma',
      planet_id: 40000002,
    }

    const layout: PiColonyLayout = {
      links: [],
      routes: [
        { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2267, quantity: 3000 },
        { route_id: 2, source_pin_id: 101, destination_pin_id: 200, content_type_id: 2270, quantity: 3000 },
        { route_id: 3, source_pin_id: 200, destination_pin_id: 210, content_type_id: 2267, quantity: 3000 },
        { route_id: 4, source_pin_id: 200, destination_pin_id: 211, content_type_id: 2270, quantity: 3000 },
        { route_id: 5, source_pin_id: 210, destination_pin_id: 220, content_type_id: 2398, quantity: 20 },
        { route_id: 6, source_pin_id: 211, destination_pin_id: 220, content_type_id: 2399, quantity: 20 },
        { route_id: 10, source_pin_id: 200, destination_pin_id: 212, content_type_id: 2267, quantity: 3000 },
        { route_id: 11, source_pin_id: 200, destination_pin_id: 213, content_type_id: 2270, quantity: 3000 },
        { route_id: 12, source_pin_id: 212, destination_pin_id: 220, content_type_id: 2398, quantity: 20 },
        { route_id: 13, source_pin_id: 213, destination_pin_id: 220, content_type_id: 2399, quantity: 20 },
        { route_id: 7, source_pin_id: 220, destination_pin_id: 230, content_type_id: 2398, quantity: 40 },
        { route_id: 8, source_pin_id: 220, destination_pin_id: 230, content_type_id: 2399, quantity: 40 },
        { route_id: 9, source_pin_id: 230, destination_pin_id: 300, content_type_id: 3689, quantity: 5 },
      ],
      pins: [
        {
          pin_id: 100,
          type_id: 3060,
          install_time: '2024-01-01T00:00:00Z',
          expiry_time: '2024-01-03T00:00:00Z',
          extractor_details: {
            product_type_id: 2267,
            qty_per_cycle: 5000,
            cycle_time: 1800,
          },
        },
        {
          pin_id: 101,
          type_id: 3060,
          install_time: '2024-01-01T00:00:00Z',
          expiry_time: '2024-01-03T00:00:00Z',
          extractor_details: {
            product_type_id: 2270,
            qty_per_cycle: 5000,
            cycle_time: 1800,
          },
        },
        { pin_id: 200, type_id: 2541 },
        { pin_id: 210, type_id: 2469, factory_details: { schematic_id: 126 } },
        { pin_id: 211, type_id: 2469, factory_details: { schematic_id: 127 } },
        { pin_id: 212, type_id: 2469, factory_details: { schematic_id: 126 } },
        { pin_id: 213, type_id: 2469, factory_details: { schematic_id: 127 } },
        { pin_id: 220, type_id: 2541 },
        { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 73 } },
        { pin_id: 300, type_id: 2256 },
      ],
    }

    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary: plasmaSummary,
      layout,
      solarSystemName: 'HY-RWO',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
    })

    const reactive = analysis.balances.potential.find((b) => b.typeId === 2398)
    const precious = analysis.balances.potential.find((b) => b.typeId === 2399)
    const mechanical = analysis.balances.potential.find((b) => b.typeId === 3689)

    expect(reactive?.demandPerHour).toBeGreaterThan(0)
    expect(precious?.demandPerHour).toBeGreaterThan(0)
    expect(reactive?.exportedPerHour ?? 0).toBe(0)
    expect(precious?.exportedPerHour ?? 0).toBe(0)
    expect(reactive?.surplusPerHour ?? 0).toBeGreaterThan(0)
    expect(precious?.surplusPerHour ?? 0).toBeGreaterThan(0)
    expect(mechanical?.exportedPerHour ?? 0).toBeGreaterThan(0)
    expect(analysis.exitTypeId).toBe(3689)
    expect(analysis.colonyRole).toBe('integrated')

    const pins = buildPlanetPins(analysis, 'potential')
    const exportPins = pins.filter((p) => p.kind === 'export')
    expect(exportPins.map((p) => p.typeId)).toEqual([3689])

    const reactiveSurplus = pins.find((p) => p.typeId === 2398 && p.kind === 'surplus')
    const preciousSurplus = pins.find((p) => p.typeId === 2399 && p.kind === 'surplus')
    expect(reactiveSurplus?.unitsPerHour).toBe(reactive!.surplusPerHour)
    expect(preciousSurplus?.unitsPerHour).toBe(precious!.surplusPerHour)
  })

  it('models extractor → storage → P1 → same storage → P2 → launchpad', () => {
    const plasmaSummary: PiColonySummary = {
      ...summary,
      planet_type: 'plasma',
      planet_id: 40000003,
    }

    const layout: PiColonyLayout = {
      links: [],
      routes: [
        { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2267, quantity: 3000 },
        { route_id: 2, source_pin_id: 101, destination_pin_id: 200, content_type_id: 2270, quantity: 3000 },
        { route_id: 3, source_pin_id: 200, destination_pin_id: 210, content_type_id: 2267, quantity: 3000 },
        { route_id: 4, source_pin_id: 200, destination_pin_id: 211, content_type_id: 2270, quantity: 3000 },
        { route_id: 5, source_pin_id: 210, destination_pin_id: 200, content_type_id: 2398, quantity: 60 },
        { route_id: 6, source_pin_id: 211, destination_pin_id: 200, content_type_id: 2399, quantity: 60 },
        { route_id: 7, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2398, quantity: 40 },
        { route_id: 8, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2399, quantity: 40 },
        { route_id: 9, source_pin_id: 230, destination_pin_id: 300, content_type_id: 3689, quantity: 5 },
      ],
      pins: [
        {
          pin_id: 100,
          type_id: 3060,
          install_time: '2024-01-01T00:00:00Z',
          expiry_time: '2024-01-03T00:00:00Z',
          extractor_details: {
            product_type_id: 2267,
            qty_per_cycle: 5000,
            cycle_time: 1800,
          },
        },
        {
          pin_id: 101,
          type_id: 3060,
          install_time: '2024-01-01T00:00:00Z',
          expiry_time: '2024-01-03T00:00:00Z',
          extractor_details: {
            product_type_id: 2270,
            qty_per_cycle: 5000,
            cycle_time: 1800,
          },
        },
        { pin_id: 200, type_id: 2541 },
        { pin_id: 210, type_id: 2469, factory_details: { schematic_id: 126 } },
        { pin_id: 211, type_id: 2469, factory_details: { schematic_id: 127 } },
        { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 73 } },
        { pin_id: 300, type_id: 2256 },
      ],
    }

    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary: plasmaSummary,
      layout,
      solarSystemName: 'HY-RWO',
      nowMs: Date.parse('2024-01-01T12:00:00Z'),
    })

    const reactive = analysis.balances.potential.find((b) => b.typeId === 2398)
    const precious = analysis.balances.potential.find((b) => b.typeId === 2399)
    const mechanical = analysis.balances.potential.find((b) => b.typeId === 3689)

    expect(reactive?.productionPerHour).toBeGreaterThan(0)
    expect(precious?.productionPerHour).toBeGreaterThan(0)
    expect(reactive?.demandPerHour).toBeGreaterThan(0)
    expect(precious?.demandPerHour).toBeGreaterThan(0)
    expect(mechanical?.productionPerHour).toBeGreaterThan(0)
    expect(mechanical?.exportedPerHour).toBeGreaterThan(0)
    expect(analysis.exitTypeId).toBe(3689)
  })

  it('end-to-end: a full destination store measurably reduces currentNetIskPerHour but leaves potentialNetIskPerHour untouched', () => {
    // Extractor (2073) -> factory (schematic 131: 2073 x3000 -> 2393 x20, cycle 1800s) -> storage.
    // Storage pin type 2257 has 12,000 m3 capacity; 2393 is 0.19 m3/unit, so
    // 70,000 units = 13,300 m3 > capacity → the store reads as full right now.
    function overflowLayout(storeFull: boolean): PiColonyLayout {
      return {
        links: [],
        routes: [
          { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2073, quantity: 3000 },
          { route_id: 2, source_pin_id: 200, destination_pin_id: 300, content_type_id: 2393, quantity: 20 },
        ],
        pins: [
          {
            pin_id: 100,
            type_id: 3060,
            install_time: '2024-01-01T00:00:00Z',
            expiry_time: '2024-01-03T00:00:00Z',
            extractor_details: { product_type_id: 2073, qty_per_cycle: 5000, cycle_time: 1800 },
          },
          { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
          {
            pin_id: 300,
            type_id: 2257,
            contents: storeFull ? [{ type_id: 2393, amount: 70_000 }] : [],
          },
        ],
      }
    }

    const prices = { 2073: { buy: 4, sell: 5 }, 2393: { buy: 900, sell: 1000 } }
    const nowMs = Date.parse('2024-01-01T12:00:00Z')

    const notFullAnalysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: overflowLayout(false),
      solarSystemName: 'Jita',
      nowMs,
    })
    const fullAnalysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test Pilot',
      summary,
      layout: overflowLayout(true),
      solarSystemName: 'Jita',
      nowMs,
    })

    const notFullPriced = applyColonyPricing(notFullAnalysis, prices)
    const fullPriced = applyColonyPricing(fullAnalysis, prices)

    // The full store's only inbound commodity (2393) is the exit product, so its
    // current export — and therefore currentNetIskPerHour — is driven to ~0.
    expect(notFullPriced.currentNetIskPerHour).toBeGreaterThan(0)
    expect(fullPriced.currentNetIskPerHour).toBeLessThan(notFullPriced.currentNetIskPerHour)
    expect(fullPriced.currentNetIskPerHour).toBeCloseTo(0, 2)

    // potentialNetIskPerHour (the unconstrained 24/7 projection) must be
    // completely unaffected by whether the store happens to be full right now.
    expect(fullPriced.potentialNetIskPerHour).toBeCloseTo(notFullPriced.potentialNetIskPerHour, 6)
  })
})
