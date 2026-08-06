import {
  computeDemandModel,
  computeIncomingRouteThroughput,
  computeOutgoingRouteThroughput,
  exportRateForValuation,
} from '@/lib/pi/demand-model'
import type { PiColonyLayout } from '@/lib/pi/types'

const layout: PiColonyLayout = {
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
      },
    },
    {
      pin_id: 200,
      type_id: 2469,
      factory_details: { schematic_id: 131 },
    },
  ],
}

describe('demand-model', () => {
  it('computes import vs surplus per type in potential view', () => {
    const result = computeDemandModel(layout, Date.parse('2024-01-01T12:00:00Z'))
    expect(result.potential.length).toBeGreaterThan(0)

    const p0 = result.potential.find((b) => b.typeId === 2073)
    expect(p0).toBeDefined()
    expect(p0!.extractionPerHour).toBeGreaterThan(0)
    expect(p0!.demandPerHour).toBeGreaterThan(0)
  })

  it('exportRateForValuation ignores wasted surplus on non-exportable items', () => {
    const wastedSurplus = {
      typeId: 2073,
      name: 'Aqueous Liquids',
      tier: 0 as const,
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
    }

    expect(exportRateForValuation(wastedSurplus, 2390, true)).toBe(0)
  })

  it('exportRateForValuation values exportable surplus when surplusForSale is enabled', () => {
    const sellableSurplus = {
      typeId: 2073,
      name: 'Aqueous Liquids',
      tier: 0 as const,
      demandPerHour: 10,
      extractionPerHour: 100,
      productionPerHour: 0,
      localSupplyPerHour: 100,
      importNeededPerHour: 0,
      surplusPerHour: 90,
      exportedPerHour: 0,
      wastedPerHour: 0,
      isImported: false,
      isExportable: true,
    }

    expect(exportRateForValuation(sellableSurplus, 2390, true)).toBe(90)
    expect(exportRateForValuation(sellableSurplus, 2390, false)).toBe(0)
  })

  it('caps factory production by route quantity throughput', () => {
    const narrowRouteLayout: PiColonyLayout = {
      links: [],
      routes: [
        {
          route_id: 1,
          source_pin_id: 100,
          destination_pin_id: 200,
          content_type_id: 2073,
          quantity: 100,
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
          },
        },
        {
          pin_id: 200,
          type_id: 2469,
          factory_details: { schematic_id: 131 },
        },
      ],
    }

    const unlimitedLayout: PiColonyLayout = {
      ...narrowRouteLayout,
      routes: [{ ...narrowRouteLayout.routes[0]!, quantity: 5000 }],
    }

    const nowMs = Date.parse('2024-01-01T12:00:00Z')
    const narrow = computeDemandModel(narrowRouteLayout, nowMs)
    const unlimited = computeDemandModel(unlimitedLayout, nowMs)

    const narrowP1 = narrow.potential.find((b) => b.typeId === 2393)
    const unlimitedP1 = unlimited.potential.find((b) => b.typeId === 2393)
    expect(narrowP1?.productionPerHour).toBeGreaterThan(0)
    expect(unlimitedP1!.productionPerHour).toBeGreaterThan(narrowP1!.productionPerHour)
  })

  it('exportRateForValuation uses production for exit type without double-counting surplus', () => {
    const exitBalance = {
      typeId: 2390,
      name: 'Water',
      tier: 1 as const,
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 50,
      localSupplyPerHour: 50,
      importNeededPerHour: 0,
      surplusPerHour: 0,
      exportedPerHour: 50,
      wastedPerHour: 0,
      isImported: false,
      isExportable: true,
    }

    expect(exportRateForValuation(exitBalance, 2390, true)).toBe(50)
  })

  it('counts storage → factory throughput using destination factory cycle', () => {
    const storageChainLayout: PiColonyLayout = {
      links: [],
      routes: [
        { route_id: 1, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2398, quantity: 40 },
        { route_id: 2, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2399, quantity: 40 },
      ],
      pins: [
        { pin_id: 200, type_id: 2541 },
        { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 73 } },
      ],
    }

    const incoming = computeIncomingRouteThroughput(storageChainLayout)
    const outgoing = computeOutgoingRouteThroughput(storageChainLayout)

    const p2Incoming = incoming.get(230)
    const storageOutgoing = outgoing.get(200)

    expect(p2Incoming?.get(2398)).toBeCloseTo(40, 0)
    expect(p2Incoming?.get(2399)).toBeCloseTo(40, 0)
    expect(storageOutgoing?.get(2398)).toBeCloseTo(40, 0)
    expect(storageOutgoing?.get(2399)).toBeCloseTo(40, 0)
  })

  it('factory-only colony (no extractors) shows current production = designed (assumes market imports)', () => {
    const factoryOnlyLayout: PiColonyLayout = {
      links: [],
      routes: [
        { route_id: 1, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2398, quantity: 40 },
        { route_id: 2, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2399, quantity: 40 },
      ],
      pins: [
        { pin_id: 200, type_id: 2541 },
        { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 73 } },
      ],
    }

    const result = computeDemandModel(factoryOnlyLayout, Date.parse('2024-01-01T12:00:00Z'))

    // No extractor pins → the colony only runs on market imports, so "current"
    // must reflect the real (designed) production, not a misleading 0.
    const currentProduced = result.current.filter((b) => b.productionPerHour > 0)
    const potentialProduced = result.potential.filter((b) => b.productionPerHour > 0)

    expect(currentProduced.length).toBeGreaterThan(0)
    expect(currentProduced.length).toBe(potentialProduced.length)
    for (const cur of currentProduced) {
      const pot = potentialProduced.find((p) => p.typeId === cur.typeId)
      expect(pot?.productionPerHour).toBeCloseTo(cur.productionPerHour, 5)
    }
  })

  it('values co-exported final-tier products at production rate', () => {
    const coExport = {
      typeId: 2393,
      name: 'Bacteria',
      tier: 1 as const,
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 108,
      localSupplyPerHour: 108,
      importNeededPerHour: 0,
      surplusPerHour: 108,
      exportedPerHour: 0,
      wastedPerHour: 0,
      isImported: false,
      isExportable: true,
    }

    expect(
      exportRateForValuation(coExport, 3645, true, { isFinalTierProduct: true })
    ).toBe(108)
  })

  it('requireExportRoute (current) values only physically-routed export, not unrouted final-tier', () => {
    const unrouted = {
      typeId: 2393,
      name: 'Bacteria',
      tier: 1 as const,
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 108,
      localSupplyPerHour: 108,
      importNeededPerHour: 0,
      surplusPerHour: 108,
      exportedPerHour: 0, // no route to storage/launchpad
      wastedPerHour: 0,
      isImported: false,
      isExportable: true,
    }

    // Optimistic (potential) still values it; current requires a real route → 0.
    expect(
      exportRateForValuation(unrouted, 3645, true, { isFinalTierProduct: true })
    ).toBe(108)
    expect(
      exportRateForValuation(unrouted, 3645, true, {
        isFinalTierProduct: true,
        requireExportRoute: true,
      })
    ).toBe(0)

    // A routed product is still counted in current mode.
    const routed = { ...unrouted, exportedPerHour: 90 }
    expect(
      exportRateForValuation(routed, 3645, true, {
        isFinalTierProduct: true,
        requireExportRoute: true,
      })
    ).toBe(90)
  })

  describe('overflow: full destination store reduces current production/extraction', () => {
    const nowMs = Date.parse('2024-01-01T12:00:00Z')

    // Storage pin type 2257 has capacity 12,000 m3 (PIN_CAPACITY_M3); commodity
    // 2073 (Aqueous Liquids) is 0.005 m3/unit, so 3,000,000 units = 15,000 m3,
    // comfortably over capacity → the pin reads as full.
    const FULL_2073_CONTENTS = [{ type_id: 2073, amount: 3_000_000 }]

    function extractorOnlyLayout(storageContents: Array<{ type_id: number; amount: number }>): PiColonyLayout {
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
            },
          },
          {
            pin_id: 200,
            type_id: 2257, // storage
            contents: storageContents,
          },
        ],
      }
    }

    it('extractor routing 100% of its output into a full storage pin drops current extraction to ~0 and reports the loss as wastedPerHour; potential is unaffected', () => {
      const fullLayout = extractorOnlyLayout(FULL_2073_CONTENTS)
      const notFullLayout = extractorOnlyLayout([])

      const fullResult = computeDemandModel(fullLayout, nowMs)
      const baseline = computeDemandModel(notFullLayout, nowMs)

      const baselineCurrent = baseline.current.find((b) => b.typeId === 2073)
      expect(baselineCurrent).toBeDefined()
      expect(baselineCurrent!.extractionPerHour).toBeGreaterThan(0)

      const fullCurrent = fullResult.current.find((b) => b.typeId === 2073)
      expect(fullCurrent).toBeDefined()
      expect(fullCurrent!.extractionPerHour).toBeCloseTo(0, 5)
      expect(fullCurrent!.wastedPerHour).toBeCloseTo(baselineCurrent!.extractionPerHour, 5)

      // potential (unconstrained projection) must be numerically identical
      // whether or not the destination store happens to be full right now.
      const fullPotential = fullResult.potential.find((b) => b.typeId === 2073)
      const baselinePotential = baseline.potential.find((b) => b.typeId === 2073)
      expect(fullPotential!.extractionPerHour).toBeCloseTo(baselinePotential!.extractionPerHour, 10)
      expect(fullPotential!.wastedPerHour).toBeCloseTo(baselinePotential!.wastedPerHour, 10)
    })

    it('splits overflow proportionally when a commodity routes into one full pin and one pin with headroom', () => {
      const splitLayout: PiColonyLayout = {
        links: [],
        routes: [
          { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2073, quantity: 20 },
          { route_id: 2, source_pin_id: 100, destination_pin_id: 210, content_type_id: 2073, quantity: 20 },
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
            },
          },
          { pin_id: 200, type_id: 2257, contents: FULL_2073_CONTENTS }, // full
          { pin_id: 210, type_id: 2257, contents: [] }, // headroom
        ],
      }
      const baseline = computeDemandModel(extractorOnlyLayout([]), nowMs)
      const baselineCurrent = baseline.current.find((b) => b.typeId === 2073)!.extractionPerHour

      const split = computeDemandModel(splitLayout, nowMs)
      const splitCurrent = split.current.find((b) => b.typeId === 2073)!

      // Equal designed route quantities to each destination → 50% of the raw
      // rate is credited (routes to the headroom pin), 50% is wasted (routes
      // to the full pin).
      expect(splitCurrent.extractionPerHour).toBeCloseTo(baselineCurrent * 0.5, 3)
      expect(splitCurrent.wastedPerHour).toBeCloseTo(baselineCurrent * 0.5, 3)
    })

    it('a pin with headroom applies zero overflow reduction (regression safety — matches pre-change current behavior)', () => {
      const notFullLayout = extractorOnlyLayout([])
      const noStoreAtAllLayout: PiColonyLayout = {
        links: [],
        routes: [],
        pins: [notFullLayout.pins[0]!], // extractor only, no route/store at all
      }

      const withHeadroom = computeDemandModel(notFullLayout, nowMs)
      const withoutStore = computeDemandModel(noStoreAtAllLayout, nowMs)

      const a = withHeadroom.current.find((b) => b.typeId === 2073)!
      const b = withoutStore.current.find((b) => b.typeId === 2073)!

      expect(a.wastedPerHour).toBe(0)
      expect(a.extractionPerHour).toBeCloseTo(b.extractionPerHour, 10)
    })

    it('factory production routed 100% into a full storage pin is discounted the same way as extraction', () => {
      // Schematic 131: 2073 (x3000) -> 2393 (x20), cycle 1800s.
      // Commodity 2393 is 0.19 m3/unit; 70,000 units = 13,300 m3 > 12,000 m3 capacity.
      function factoryLayout(storeFull: boolean): PiColonyLayout {
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
              extractor_details: {
                product_type_id: 2073,
                qty_per_cycle: 5000,
                cycle_time: 1800,
              },
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

      const baseline = computeDemandModel(factoryLayout(false), nowMs)
      const full = computeDemandModel(factoryLayout(true), nowMs)

      const baselineCurrent = baseline.current.find((b) => b.typeId === 2393)!
      const fullCurrent = full.current.find((b) => b.typeId === 2393)!

      expect(baselineCurrent.productionPerHour).toBeGreaterThan(0)
      expect(fullCurrent.productionPerHour).toBeCloseTo(0, 5)
      expect(fullCurrent.wastedPerHour).toBeCloseTo(baselineCurrent.productionPerHour, 5)

      const baselinePotential = baseline.potential.find((b) => b.typeId === 2393)!
      const fullPotential = full.potential.find((b) => b.typeId === 2393)!
      expect(fullPotential.productionPerHour).toBeCloseTo(baselinePotential.productionPerHour, 10)
    })

    it('potential balances stay byte-for-byte identical between a full-destination scenario and a headroom scenario', () => {
      const fullResult = computeDemandModel(extractorOnlyLayout(FULL_2073_CONTENTS), nowMs)
      const baseline = computeDemandModel(extractorOnlyLayout([]), nowMs)

      expect(fullResult.potential).toEqual(baseline.potential)
    })

    it('a downstream factory PULLING the same commodity as its own recipe input from a full store does not dilute the overflow fraction — the producer delivery into the full store is 100% lost regardless of the pull rate', () => {
      // Topology per docs/PI_DOMAIN_GUIDE.md §4.2 (the recommended, standard shape):
      // extractor (100) --route A: 2073 @ 100/h--> storage S1 (200, FULL)
      //                                              S1 --route B: 2073 @ 80/h--> factory F (300, schematic 131, consumes 2073 as ITS OWN input)
      // Route A: quantity 50 over extractor cycle 1800s -> (50/1800)*3600 = 100 units/h.
      // Route B: quantity 40 over schematic 131 cycle 1800s -> (40/1800)*3600 = 80 units/h.
      //
      // Route B lands on a PROCESSOR pin (F), not a store — it is a separate
      // downstream consumption/pull flow, not part of "can the producer's
      // delivery into S1 be absorbed". Before the fix, totalByType wrongly
      // summed both routes (100 + 80 = 180) while fullByType only counted the
      // store route (100), giving fraction = 100/180 ≈ 0.556 → only ~56% of
      // the extractor's current output flagged as wasted. After the fix, route
      // B is excluded entirely (destination is not a store pin), so
      // totalByType = fullByType = 100 and fraction = 1 — ALL of the
      // producer's designed delivery into the full S1 is lost, independent of
      // F's separate pull rate.
      function pullThroughFullStoreLayout(): PiColonyLayout {
        return {
          links: [],
          routes: [
            { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2073, quantity: 50 },
            { route_id: 2, source_pin_id: 200, destination_pin_id: 300, content_type_id: 2073, quantity: 40 },
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
              },
            },
            { pin_id: 200, type_id: 2257, contents: FULL_2073_CONTENTS }, // storage, FULL
            { pin_id: 300, type_id: 2469, factory_details: { schematic_id: 131 } }, // factory pulling 2073 as its own input
          ],
        }
      }

      const baseline = computeDemandModel(extractorOnlyLayout([]), nowMs)
      const baselineExtraction = baseline.current.find((b) => b.typeId === 2073)!.extractionPerHour
      expect(baselineExtraction).toBeGreaterThan(0)

      const result = computeDemandModel(pullThroughFullStoreLayout(), nowMs)
      const current = result.current.find((b) => b.typeId === 2073)!

      // 100% waste (fraction = 1), not the diluted ~56% the bug produced.
      expect(current.extractionPerHour).toBeCloseTo(0, 5)
      expect(current.wastedPerHour).toBeCloseTo(baselineExtraction, 5)

      // potential (unconstrained projection) is completely unaffected.
      const potential = result.potential.find((b) => b.typeId === 2073)!
      const baselinePotential = baseline.potential.find((b) => b.typeId === 2073)!
      expect(potential.extractionPerHour).toBeCloseTo(baselinePotential.extractionPerHour, 10)
    })

    it('does not manufacture a phantom import need for a commodity whose destination store is full but which a downstream factory keeps pulling from that same store', () => {
      // A full store means the commodity is ABUNDANT there (that's why it's
      // full), not scarce. A downstream factory pulling it as its own input
      // should see it as available, even though the upstream producer's NEW
      // deliveries into that same full store are being lost. Reachable only in
      // an import-dependent (factory-only, no extractor) colony: with an
      // extractor present, the pre-existing `!assumeImports` guard already
      // zeroes importNeeded for any locally-producible type regardless of this
      // fix, so it can't surface the bug this test targets.
      //
      // Pin A (100, schematic 131): 2073 -> 2393 (Bacteria), no input route ->
      //   uncapped, runs at its theoretical max: (20/1800)*3600 = 40 units/h of 2393.
      // Pin A's entire output routes into storage S1 (200, type 2257), which is
      //   already FULL of 2393 -> overflow fraction for 2393 = 1 (100% lost).
      // S1 also feeds Pin B (300, schematic 78): consumes 2393 (+2398) -> 2463.
      //   Route quantity 40 over Pin B's 3600s cycle = 40 units/h designed pull,
      //   which exactly matches Pin A's 40 units/h raw (pre-overflow) output —
      //   so the RAW supply covers downstream demand, and importNeeded for 2393
      //   must stay 0 even though the ADJUSTED (post-overflow) supply is 0.
      const layout: PiColonyLayout = {
        links: [],
        routes: [
          { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2393, quantity: 100 },
          { route_id: 2, source_pin_id: 200, destination_pin_id: 300, content_type_id: 2393, quantity: 40 },
        ],
        pins: [
          { pin_id: 100, type_id: 2469, factory_details: { schematic_id: 131 } },
          { pin_id: 200, type_id: 2257, contents: [{ type_id: 2393, amount: 70_000 }] }, // 70,000 * 0.19 m3 = 13,300 m3 > 12,000 capacity -> full
          { pin_id: 300, type_id: 2469, factory_details: { schematic_id: 78 } },
        ],
      }

      const result = computeDemandModel(layout, nowMs)
      const current = result.current.find((b) => b.typeId === 2393)!

      // Adjusted (deliverable) supply is fully wasted, matching the other overflow tests.
      expect(current.productionPerHour).toBeCloseTo(0, 5)
      expect(current.wastedPerHour).toBeCloseTo(40, 5)
      // But the downstream factory's pull (40/h) is covered by the RAW (pre-
      // overflow) 40/h Pin A actually produces — no phantom import need.
      expect(current.demandPerHour).toBeCloseTo(40, 5)
      expect(current.importNeededPerHour).toBeCloseTo(0, 5)
    })
  })
})
