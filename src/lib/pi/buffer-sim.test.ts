import {
  aggregateBufferStatusFromPins,
  computeTimeToEmptyHrs,
  derivePinStatus,
  simulateBufferStatus,
  simulatePinBufferStatuses,
} from '@/lib/pi/buffer-sim'
import { buildRouteEdges } from '@/lib/pi/route-graph'
import { computeDemandModel, type PiCommodityBalance } from '@/lib/pi/demand-model'
import type { PiColonyLayout, PiPinBufferStatus } from '@/lib/pi/types'

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
    {
      pin_id: 300,
      type_id: 2256,
      contents: [{ type_id: 2073, amount: 500 }],
    },
  ],
}

const dualStorageLayout: PiColonyLayout = {
  links: [],
  routes: [
    {
      route_id: 1,
      source_pin_id: 100,
      destination_pin_id: 300,
      content_type_id: 2073,
      quantity: 5000,
    },
    {
      route_id: 2,
      source_pin_id: 100,
      destination_pin_id: 400,
      content_type_id: 2073,
      quantity: 1000,
    },
    {
      route_id: 3,
      source_pin_id: 300,
      destination_pin_id: 200,
      content_type_id: 2073,
      quantity: 5000,
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
    {
      pin_id: 300,
      type_id: 2256,
      contents: [{ type_id: 2073, amount: 100 }],
    },
    {
      pin_id: 400,
      type_id: 2256,
      contents: [],
    },
  ],
}

describe('buffer-sim', () => {
  it('computes buffer status from balances and pin contents', () => {
    const demand = computeDemandModel(layout, Date.parse('2024-01-01T12:00:00Z'))
    const status = simulateBufferStatus({
      layout,
      balances: demand.potential,
      edges: buildRouteEdges(layout),
    })

    expect(['running', 'starving_soon', 'stalled', 'overflow_soon', 'full']).toContain(
      status.status
    )
  })

  it('returns per-pin buffer statuses for multiple storages', () => {
    const demand = computeDemandModel(dualStorageLayout, Date.parse('2024-01-01T12:00:00Z'))
    const pinStatuses = simulatePinBufferStatuses({
      layout: dualStorageLayout,
      balances: demand.potential,
      assumeImports: true,
    })

    expect(pinStatuses.length).toBe(2)
    const pin300 = pinStatuses.find((p) => p.pinId === 300)
    const pin400 = pinStatuses.find((p) => p.pinId === 400)
    expect(pin300).toBeDefined()
    expect(pin400).toBeDefined()
    expect(pin300!.flows.some((f) => f.inPerHour > 0)).toBe(true)
    expect(pin400!.flows.some((f) => f.inPerHour > 0)).toBe(true)
  })

  it('ignores idle storages with no route activity for fill/empty timers', () => {
    const fullLayout: PiColonyLayout = {
      links: [],
      routes: [],
      pins: [
        {
          pin_id: 300,
          type_id: 2256,
          contents: [{ type_id: 2073, amount: 2_000_000 }],
        },
      ],
    }

    const pinStatuses = simulatePinBufferStatuses({
      layout: fullLayout,
      balances: [],
      assumeImports: false,
    })

    expect(pinStatuses[0]?.freeM3).toBe(0)
    expect(pinStatuses[0]?.flows).toHaveLength(0)
    expect(pinStatuses[0]?.timeToFullHrs).toBeUndefined()
    expect(pinStatuses[0]?.timeToEmptyHrs).toBeUndefined()
    expect(pinStatuses[0]?.status).toBe('running')
  })

  it('caps store inflow to current production — idle colony shows no inflow or fill time', () => {
    const layout: PiColonyLayout = {
      links: [],
      routes: [
        {
          route_id: 1,
          source_pin_id: 100,
          destination_pin_id: 300,
          content_type_id: 2073,
          quantity: 5000,
        },
      ],
      pins: [
        {
          pin_id: 100,
          type_id: 3060,
          install_time: '2024-01-01T00:00:00Z',
          expiry_time: '2024-01-03T00:00:00Z',
          extractor_details: { product_type_id: 2073, qty_per_cycle: 5000, cycle_time: 1800 },
        },
        { pin_id: 300, type_id: 2256, contents: [] },
      ],
    }

    // No cap: the designed route throughput fills the empty store.
    const uncapped = simulatePinBufferStatuses({ layout, balances: [], assumeImports: false })
    const store = uncapped.find((p) => p.pinId === 300)!
    expect(store.flows.some((f) => f.inPerHour > 0)).toBe(true)
    expect(store.timeToFullHrs).toBeGreaterThan(0)

    // Cap of 0 (nothing produced right now): no inflow, no bogus "full in".
    const capped = simulatePinBufferStatuses({
      layout,
      balances: [],
      assumeImports: false,
      inflowCapByType: new Map([[2073, 0]]),
    })
    const cappedStore = capped.find((p) => p.pinId === 300)!
    expect(cappedStore.flows).toHaveLength(0)
    expect(cappedStore.timeToFullHrs).toBeUndefined()
    expect(cappedStore.status).toBe('running')
  })

  it('marks full pin with timeToFullHrs of 0 when at capacity and receiving inflow', () => {
    const fullLayout: PiColonyLayout = {
      links: [],
      routes: [
        {
          route_id: 1,
          source_pin_id: 100,
          destination_pin_id: 300,
          content_type_id: 2073,
          quantity: 5000,
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
          pin_id: 300,
          type_id: 2256,
          contents: [{ type_id: 2073, amount: 2_000_000 }],
        },
      ],
    }

    const pinStatuses = simulatePinBufferStatuses({
      layout: fullLayout,
      balances: [],
      assumeImports: false,
    })

    const pin300 = pinStatuses.find((p) => p.pinId === 300)
    expect(pin300?.freeM3).toBe(0)
    expect(pin300?.timeToFullHrs).toBe(0)
    expect(pin300?.status).toBe('full')
  })

  it('marks a storage as stalled when it is already empty and still net-consuming (not merely unset)', () => {
    const starvedLayout: PiColonyLayout = {
      links: [],
      routes: [
        // Consumer route draining the storage faster than anything replenishes it.
        {
          route_id: 1,
          source_pin_id: 300,
          destination_pin_id: 200,
          content_type_id: 2073,
          quantity: 200,
        },
      ],
      pins: [
        {
          pin_id: 200,
          type_id: 2469,
          factory_details: { schematic_id: 131 },
        },
        {
          pin_id: 300,
          type_id: 2256,
          contents: [], // empty right now, but still routed out
        },
      ],
    }

    const pinStatuses = simulatePinBufferStatuses({
      layout: starvedLayout,
      balances: [],
      assumeImports: false,
    })

    const pin300 = pinStatuses.find((p) => p.pinId === 300)
    expect(pin300?.timeToEmptyHrs).toBe(0)
    expect(pin300?.status).toBe('stalled')
  })

  it('aggregates colony buffer from pin minimums', () => {
    const demand = computeDemandModel(dualStorageLayout, Date.parse('2024-01-01T12:00:00Z'))
    const pinStatuses = simulatePinBufferStatuses({
      layout: dualStorageLayout,
      balances: demand.potential,
      assumeImports: true,
    })
    const aggregated = aggregateBufferStatusFromPins(pinStatuses)
    const direct = simulateBufferStatus({
      layout: dualStorageLayout,
      balances: demand.potential,
      edges: buildRouteEdges(dualStorageLayout),
      assumeImports: true,
    })

    expect(aggregated.status).toBe(direct.status)
  })
})

describe('computeTimeToEmptyHrs (BUG 1 — stalled false positive)', () => {
  // 1. Steady-state throughput: empty store, inflow matches outflow. A perfectly
  //    balanced chain holds intermediate storage at ~0 — this is NOT a stall.
  it('empty store with matching in/out flow is not stalled (no timer)', () => {
    const t = computeTimeToEmptyHrs(0, 100, 100)
    expect(t).toBeUndefined()
    expect(derivePinStatus(t, undefined)).toBe('running')
  })

  // 2. Genuinely stalled: empty AND nothing coming in, still being consumed.
  it('empty store with no inflow and active consumption is stalled (0h)', () => {
    const t = computeTimeToEmptyHrs(0, 0, 100)
    expect(t).toBe(0)
    expect(derivePinStatus(t, undefined)).toBe('stalled')
  })

  // 3. Draining a real buffer: countdown from the stock on hand.
  it('stocked store with no inflow drains at the consumption rate', () => {
    const t = computeTimeToEmptyHrs(500, 0, 100)
    expect(t).toBe(5)
    expect(derivePinStatus(t, undefined)).toBe('starving_soon')
  })

  // 4. Empty but still partially fed (in < out): draining but production
  //    continues. DECISION: not a stall and not an honest countdown — leave it
  //    without a timer (running). Reasons: the buffer is already at 0 so any
  //    "time to empty" would be fabricated (violates the no-assumed-values rule),
  //    and in current mode the outflow cap self-corrects (a factory that only
  //    receives 50 consumes 50, so in == out and net = 0). A sustained partial
  //    under-supply is surfaced by the demand model (importNeeded), not here.
  it('empty store still partially fed is not stalled (no fabricated timer)', () => {
    const t = computeTimeToEmptyHrs(0, 50, 100)
    expect(t).toBeUndefined()
    expect(derivePinStatus(t, undefined)).toBe('running')
  })
})

describe('derivePinStatus visit-cadence threshold (BUG 2)', () => {
  // 1. Under the cadence -> won't last until the next visit -> alert.
  it('starving_soon when time-to-empty is under the cadence (24h → 23h)', () => {
    expect(derivePinStatus(23, undefined, 24)).toBe('starving_soon')
  })

  // 2. Over the cadence -> healthy, will survive to the next visit.
  it('running when time-to-empty exceeds the cadence (24h → 25h)', () => {
    expect(derivePinStatus(25, undefined, 24)).toBe('running')
  })

  // 3. A wider cadence alerts earlier.
  it('starving_soon at 30h when the cadence is 48h', () => {
    expect(derivePinStatus(30, undefined, 48)).toBe('starving_soon')
  })

  // 4. Regression: no cadence configured falls back to the historical 24h.
  it('defaults to a 24h threshold when no cadence is given', () => {
    expect(derivePinStatus(23, undefined)).toBe('starving_soon')
    expect(derivePinStatus(25, undefined)).toBe('running')
  })

  // Overflow mirrors the same threshold.
  it('applies the cadence to overflow_soon as well', () => {
    expect(derivePinStatus(undefined, 30, 48)).toBe('overflow_soon')
    expect(derivePinStatus(undefined, 30, 24)).toBe('running')
  })
})

describe('simulatePinBufferStatuses threads the visit cadence', () => {
  // A stocked store draining with no inflow: 100 units at 100/h = 1h to empty.
  // Under a 24h cadence it's an alert; widen the cadence and it stays an alert;
  // a tiny cadence (< 1h) clears it.
  const drainingLayout: PiColonyLayout = {
    links: [],
    routes: [
      { route_id: 1, source_pin_id: 300, destination_pin_id: 200, content_type_id: 2073, quantity: 200 },
    ],
    pins: [
      { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
      { pin_id: 300, type_id: 2256, contents: [{ type_id: 2073, amount: 100 }] },
    ],
  }

  it('a positive time-to-empty under the default cadence reads as starving_soon', () => {
    const store = simulatePinBufferStatuses({
      layout: drainingLayout,
      balances: [],
      assumeImports: false,
    }).find((p) => p.pinId === 300)!
    expect(store.timeToEmptyHrs).toBeGreaterThan(0)
    expect(store.status).toBe('starving_soon')
  })

  it('the same buffer clears once the cadence drops below its autonomy', () => {
    // Derive the autonomy from the model rather than hardcoding a schematic cycle.
    const autonomy = simulatePinBufferStatuses({
      layout: drainingLayout,
      balances: [],
      assumeImports: false,
    }).find((p) => p.pinId === 300)!.timeToEmptyHrs!

    const tight = simulatePinBufferStatuses({
      layout: drainingLayout,
      balances: [],
      assumeImports: false,
      visitCadenceHrs: autonomy / 2, // survives to the next (sooner) visit
    }).find((p) => p.pinId === 300)!
    expect(tight.status).toBe('running')

    const wide = simulatePinBufferStatuses({
      layout: drainingLayout,
      balances: [],
      assumeImports: false,
      visitCadenceHrs: autonomy * 2, // won't survive to the next (later) visit
    }).find((p) => p.pinId === 300)!
    expect(wide.status).toBe('starving_soon')
  })
})

describe('simulatePinBufferStatuses projeta o estoque (Fase A, motor de projeção)', () => {
  // Store 300 drena Water sem inflow (rota store→factory). Estoque grande para
  // que 21h não zere. lastUpdate 21h antes de nowMs (o caso real da 6-IAFR I).
  const lastUpdate = '2026-07-20T20:38:00Z'
  const nowMs = Date.parse(lastUpdate) + 21 * 3_600_000

  const bigDrainLayout: PiColonyLayout = {
    links: [],
    routes: [
      { route_id: 1, source_pin_id: 300, destination_pin_id: 200, content_type_id: 2073, quantity: 200 },
    ],
    pins: [
      { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
      { pin_id: 300, type_id: 2256, contents: [{ type_id: 2073, amount: 1_000_000 }] },
    ],
  }

  it('flag OFF → amount === amountMeasured sempre (regressão total)', () => {
    const off = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      // nowMs/lastUpdate presentes mas flag OFF: deve ser idêntico ao snapshot.
      nowMs,
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    expect(off.flows.length).toBeGreaterThan(0)
    for (const f of off.flows) {
      expect(f.amount).toBe(f.amountMeasured)
      expect(f.projected).toBe(false)
    }
  })

  it('flag ON + lastUpdate 21h atrás → estoque drenado até agora, projected true', () => {
    const on = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      projectionEnabled: true,
      nowMs,
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    const water = on.flows.find((f) => f.typeId === 2073)!
    expect(water.amountMeasured).toBe(1_000_000)
    // Ancorado na taxa efetivamente computada, não em cycle hardcoded.
    const expected = Math.max(0, 1_000_000 - water.outPerHour * 21)
    expect(water.amount).toBeCloseTo(expected, 3)
    expect(water.amount).toBeLessThan(water.amountMeasured)
    expect(water.projected).toBe(true)
  })

  it('flag ON + elapsed ~0 → amount === amountMeasured, projected false', () => {
    const on = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      projectionEnabled: true,
      nowMs: Date.parse(lastUpdate),
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    const water = on.flows.find((f) => f.typeId === 2073)!
    expect(water.amount).toBe(water.amountMeasured)
    expect(water.projected).toBe(false)
  })

  it('satura no piso — buffer esvaziado não fabrica "empty in negativo"', () => {
    const floorLayout: PiColonyLayout = {
      ...bigDrainLayout,
      pins: [
        bigDrainLayout.pins[0],
        { pin_id: 300, type_id: 2256, contents: [{ type_id: 2073, amount: 1 }] },
      ],
    }
    const on = simulatePinBufferStatuses({
      layout: floorLayout,
      balances: [],
      assumeImports: false,
      projectionEnabled: true,
      nowMs: Date.parse(lastUpdate) + 48 * 3_600_000, // 48h: ainda projeta (banda diverging)
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    const water = on.flows.find((f) => f.typeId === 2073)!
    expect(water.amount).toBe(0)
    expect(water.timeToEmptyHrs ?? 0).toBeGreaterThanOrEqual(0)
    expect(on.timeToEmptyHrs == null || on.timeToEmptyHrs >= 0).toBe(true)
  })

  it('projeção > 72h fica suspensa — mostra o snapshot cru (não extrapola)', () => {
    const on = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      projectionEnabled: true,
      nowMs: Date.parse(lastUpdate) + 100 * 3_600_000, // 100h > 72h → suspenso
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    const water = on.flows.find((f) => f.typeId === 2073)!
    expect(water.amount).toBe(water.amountMeasured)
    expect(water.projected).toBe(false)
  })

  it('volume (usedM3) reflete o estoque projetado — launchpad esvazia', () => {
    const off = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      nowMs,
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    const on = simulatePinBufferStatuses({
      layout: bigDrainLayout,
      balances: [],
      assumeImports: false,
      projectionEnabled: true,
      nowMs,
      lastUpdate,
    }).find((p) => p.pinId === 300)!
    expect(on.usedM3).toBeLessThan(off.usedM3)
    expect(on.freeM3).toBeGreaterThan(off.freeM3)
  })
})

describe('aggregateBufferStatusFromPins — vocabulário degraded (Fase B1, Tarefa 1)', () => {
  // Um pin seco (timeToEmpty 0) mas com fluxo ativo; e um pin saudável.
  function stalledPin(pinId: number): PiPinBufferStatus {
    return {
      pinId,
      typeId: 2256,
      role: 'launchpad',
      label: `Pin ${pinId}`,
      capacityM3: 10_000,
      usedM3: 0,
      freeM3: 10_000,
      flows: [
        {
          typeId: 2073,
          name: 'Water',
          amount: 0,
          amountMeasured: 0,
          projected: false,
          inPerHour: 0,
          outPerHour: 100,
          netPerHour: -100,
          timeToEmptyHrs: 0,
        },
      ],
      timeToEmptyHrs: 0,
      limitingEmptyTypeId: 2073,
      status: 'stalled',
    }
  }
  function runningPin(pinId: number): PiPinBufferStatus {
    return {
      pinId,
      typeId: 2256,
      role: 'launchpad',
      label: `Pin ${pinId}`,
      capacityM3: 10_000,
      usedM3: 100,
      freeM3: 9_900,
      flows: [
        {
          typeId: 2390,
          name: 'Biomass',
          amount: 5_000,
          amountMeasured: 5_000,
          projected: false,
          inPerHour: 100,
          outPerHour: 100,
          netPerHour: 0,
          timeToEmptyHrs: undefined,
        },
      ],
      timeToEmptyHrs: undefined,
      status: 'running',
    }
  }

  const ON = { degradedEnabled: true }

  it('1 pin morto que NÃO mata a saída, resto produzindo → degraded (não stalled)', () => {
    const agg = aggregateBufferStatusFromPins([stalledPin(300), runningPin(400)], 24, {
      ...ON,
      exportProductionActive: true,
    })
    expect(agg.status).toBe('degraded')
  })

  it('cadeia de saída morta (nada exporta) → stalled', () => {
    const agg = aggregateBufferStatusFromPins([stalledPin(300), runningPin(400)], 24, {
      ...ON,
      exportProductionActive: false,
    })
    expect(agg.status).toBe('stalled')
  })

  it('tudo fluindo → running', () => {
    const agg = aggregateBufferStatusFromPins([runningPin(300), runningPin(400)], 24, {
      ...ON,
      exportProductionActive: true,
    })
    expect(agg.status).toBe('running')
  })

  it('regressão: com a flag OFF, um pin morto continua stalled (nunca degraded)', () => {
    const off = aggregateBufferStatusFromPins([stalledPin(300), runningPin(400)], 24, {
      degradedEnabled: false,
      exportProductionActive: true,
    })
    expect(off.status).toBe('stalled')
    // E sem opções (chamadas legadas) idem.
    expect(aggregateBufferStatusFromPins([stalledPin(300), runningPin(400)], 24).status).toBe(
      'stalled'
    )
  })
})

describe('simulatePinBufferStatuses — import respeita cadência (Fase B1, Tarefa 2)', () => {
  // Store 300 drena um insumo importado (in=0 na ESI, reposto à mão) para a fábrica.
  const importDrainLayout: PiColonyLayout = {
    links: [],
    routes: [
      { route_id: 1, source_pin_id: 300, destination_pin_id: 200, content_type_id: 2073, quantity: 200 },
    ],
    pins: [
      { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
      { pin_id: 300, type_id: 2256, contents: [{ type_id: 2073, amount: 0 }] },
    ],
  }

  // Balance mínimo marcando 2073 como importado (o motor lê `isImported`).
  function importedBalance(typeId: number): PiCommodityBalance {
    return {
      typeId,
      name: 'Water',
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 0,
      localSupplyPerHour: 0,
      importNeededPerHour: 100,
      surplusPerHour: 0,
      exportedPerHour: 0,
      wastedPerHour: 0,
      isImported: true,
      isExportable: false,
    }
  }

  const lastUpdate = '2026-07-21T00:00:00Z'
  const layoutWith = (amount: number): PiColonyLayout => ({
    ...importDrainLayout,
    pins: [
      importDrainLayout.pins[0],
      { pin_id: 300, type_id: 2256, contents: [{ type_id: 2073, amount }] },
    ],
  })

  function runImport(amount: number, ageHrs: number, cadenceHrs: number) {
    return simulatePinBufferStatuses({
      layout: layoutWith(amount),
      balances: [importedBalance(2073)],
      assumeImports: false,
      projectionEnabled: true,
      visitCadenceHrs: cadenceHrs,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + ageHrs * 3_600_000,
    }).find((p) => p.pinId === 300)!
  }

  it('snapshot 20h, cadência 24h, buffer aguenta → não stalled; expõe "reabastecer em ~4h"', () => {
    // Estoque grande (autonomia >> cadência) → no ritmo, reposição prevista.
    const store = runImport(1_000_000, 20, 24)
    expect(store.status).toBe('running')
    expect(store.restockDueHrs).toBeCloseTo(4, 5)
    expect(store.flows.find((f) => f.typeId === 2073)!.timeToEmptyHrs).toBeUndefined()
  })

  it('snapshot 30h, cadência 24h → atrasado: alerta real (não suprime)', () => {
    // Estoque pequeno + snapshot mais velho que a cadência → drought de verdade.
    const store = runImport(100, 30, 24)
    expect(store.status).toBe('stalled')
    expect(store.restockDueHrs).toBeUndefined()
  })

  it('esvaziaria em ~1h com snapshot fresco, cadência 24h → sub-provisionado (âmbar)', () => {
    // autonomia (100/taxa) << cadência mesmo cheio → o usuário precisa pôr mais insumo.
    const store = runImport(100, 0, 24)
    expect(store.status).toBe('starving_soon')
    expect(store.restockDueHrs).toBeUndefined()
    expect(store.flows.find((f) => f.typeId === 2073)!.timeToEmptyHrs).toBeGreaterThan(0)
  })

  it('regressão: buffer NÃO importado (produção local) → lógica inalterada, sem restock', () => {
    // Mesmo layout/estoque, mas 2073 não é importado → o refino de cadência não roda.
    const store = simulatePinBufferStatuses({
      layout: layoutWith(1_000_000),
      balances: [{ ...importedBalance(2073), isImported: false }],
      assumeImports: false,
      projectionEnabled: true,
      visitCadenceHrs: 24,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + 20 * 3_600_000,
    }).find((p) => p.pinId === 300)!
    expect(store.restockDueHrs).toBeUndefined()
  })

  it('regressão: flag OFF → nenhum tratamento de cadência de import', () => {
    const store = simulatePinBufferStatuses({
      layout: layoutWith(100),
      balances: [importedBalance(2073)],
      assumeImports: false,
      // sem projectionEnabled
      visitCadenceHrs: 24,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + 20 * 3_600_000,
    }).find((p) => p.pinId === 300)!
    expect(store.restockDueHrs).toBeUndefined()
  })
})

describe('simulateBufferStatus — fiação de produção chega em exportProductionActive/degradedEnabled (Fase B1, cobertura P2)', () => {
  // Colônia com um único pin de storage (300) que seca de verdade: rota só de
  // saída, sem contents, sem inflow. Já provado 'stalled' via
  // simulatePinBufferStatuses no describe original ("marks a storage as stalled...").
  // Aqui entramos pelo caminho real de produção — simulateBufferStatus — para travar
  // que ele deriva exportProductionActive de `balances` e propaga degradedEnabled a
  // partir de projectionEnabled (buffer-sim.ts linhas ~480-486).
  const stalledColonyLayout: PiColonyLayout = {
    links: [],
    routes: [
      { route_id: 1, source_pin_id: 300, destination_pin_id: 200, content_type_id: 2073, quantity: 200 },
    ],
    pins: [
      { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
      { pin_id: 300, type_id: 2256, contents: [] },
    ],
  }
  const edges = buildRouteEdges(stalledColonyLayout)

  // Balance sintético só para acionar `balances.some(b => b.exportedPerHour > 0)`.
  // O typeId não precisa casar com nada do layout: exportProductionActive é lido
  // puramente desse array, independente de rotas/pins.
  function activeExportBalance(typeId: number): PiCommodityBalance {
    return {
      typeId,
      name: 'Synthetic Export',
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 0,
      localSupplyPerHour: 0,
      importNeededPerHour: 0,
      surplusPerHour: 0,
      exportedPerHour: 50,
      wastedPerHour: 0,
      isImported: false,
      isExportable: true,
    }
  }

  it('stalled COM export ativo + projectionEnabled true → agregado vira degraded', () => {
    const status = simulateBufferStatus({
      layout: stalledColonyLayout,
      balances: [activeExportBalance(9999)],
      edges,
      projectionEnabled: true,
    })
    expect(status.status).toBe('degraded')
  })

  it('stalled SEM export ativo + projectionEnabled true → continua stalled', () => {
    const status = simulateBufferStatus({
      layout: stalledColonyLayout,
      balances: [], // nenhum balance exportando -> exportProductionActive = false
      edges,
      projectionEnabled: true,
    })
    expect(status.status).toBe('stalled')
  })

  it('stalled COM export ativo + projectionEnabled false → continua stalled (retrocompatibilidade)', () => {
    const status = simulateBufferStatus({
      layout: stalledColonyLayout,
      balances: [activeExportBalance(9999)],
      edges,
      // projectionEnabled omitido: a flag off tem que reproduzir o vocabulário antigo.
    })
    expect(status.status).toBe('stalled')
  })
})

describe('simulatePinBufferStatuses — bordas do restock de import (P3)', () => {
  const cadenceHrs = 24
  const lastUpdate = '2026-07-21T00:00:00Z'

  function importedBalance(typeId: number, overrides?: Partial<PiCommodityBalance>): PiCommodityBalance {
    return {
      typeId,
      name: 'Imported',
      demandPerHour: 0,
      extractionPerHour: 0,
      productionPerHour: 0,
      localSupplyPerHour: 0,
      importNeededPerHour: 100,
      surplusPerHour: 0,
      exportedPerHour: 0,
      wastedPerHour: 0,
      isImported: true,
      isExportable: false,
      ...overrides,
    }
  }

  // Uma única rota storage(300) -> factory(200) por tipo. cycleTimeSec do
  // schematic 131 é 1800s, então outPerHour = (quantity / 1800) * 3600 = quantity * 2.
  function layoutWithContents(
    contents: Array<{ type_id: number; amount: number }>,
    routes: Array<{ typeId: number; quantity: number }>
  ): PiColonyLayout {
    return {
      links: [],
      routes: routes.map((r, i) => ({
        route_id: i + 1,
        source_pin_id: 300,
        destination_pin_id: 200,
        content_type_id: r.typeId,
        quantity: r.quantity,
      })),
      pins: [
        { pin_id: 200, type_id: 2469, factory_details: { schematic_id: 131 } },
        { pin_id: 300, type_id: 2256, contents },
      ],
    }
  }

  it('elapsedHours === cadenceHrs cai no ramo "atrasado" (fronteira não suprime, mesmo com estoque enorme)', () => {
    // Tipo 2073: outPerHour = 50*2 = 100/h. Estoque de 1_000_000 dá autonomia de
    // 10_000h >> cadenceHrs — se caísse no ramo "no ritmo" isso suprimiria o alerta.
    // elapsedHours == cadenceHrs exatamente: o código testa `elapsedHours >= cadenceHrs`,
    // então a fronteira pertence ao ramo "atrasado", não ao "no ritmo".
    const layout = layoutWithContents(
      [{ type_id: 2073, amount: 1_000_000 }],
      [{ typeId: 2073, quantity: 50 }]
    )
    const store = simulatePinBufferStatuses({
      layout,
      balances: [importedBalance(2073)],
      assumeImports: false,
      projectionEnabled: true,
      visitCadenceHrs: cadenceHrs,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + cadenceHrs * 3_600_000, // elapsed === cadenceHrs
    }).find((p) => p.pinId === 300)!

    expect(store.restockDueHrs).toBeUndefined()
    const flow = store.flows.find((f) => f.typeId === 2073)!
    expect(flow.timeToEmptyHrs).toBeDefined()
    expect(flow.timeToEmptyHrs).toBeGreaterThan(0)
  })

  it('pin com múltiplos tipos importados: restockDueHrs é um valor único (do tipo "no ritmo"), não expõe um prazo por tipo', () => {
    // 2073 ("A"): outPerHour = 50*2 = 100/h, estoque 1_000_000 -> autonomia 10_000h,
    // no ritmo (elapsed 10h < cadência 24h) -> suprime e fixa restockDueHrs = 24-10 = 14.
    // 2390 ("B"): outPerHour = 5*2 = 10/h, estoque 150 -> autonomia 15h < cadência 24h,
    // sub-provisionado -> mantém o countdown real (não participa do restockDueHrs).
    const layout = layoutWithContents(
      [
        { type_id: 2073, amount: 1_000_000 },
        { type_id: 2390, amount: 150 },
      ],
      [
        { typeId: 2073, quantity: 50 },
        { typeId: 2390, quantity: 5 },
      ]
    )
    const store = simulatePinBufferStatuses({
      layout,
      balances: [importedBalance(2073), importedBalance(2390)],
      assumeImports: false,
      projectionEnabled: true,
      visitCadenceHrs: cadenceHrs,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + 10 * 3_600_000,
    }).find((p) => p.pinId === 300)!

    const flowA = store.flows.find((f) => f.typeId === 2073)!
    const flowB = store.flows.find((f) => f.typeId === 2390)!
    expect(flowA.timeToEmptyHrs).toBeUndefined()
    expect(flowB.timeToEmptyHrs).toBeCloseTo(5, 5)
    // O pin expõe UM restockDueHrs (vindo só de A, "no ritmo"); B não contribui um
    // prazo próprio — o código não trava um valor por tipo, só o mínimo entre os
    // tipos que estão no ritmo (aqui, só A está).
    expect(store.restockDueHrs).toBeCloseTo(14, 5)
  })

  it('fluxo importado no ritmo NÃO suprime o alerta de um segundo fluxo genuinamente parado no mesmo pin', () => {
    // 2073 ("A", importado): outPerHour = 100/h, estoque 1_000_000 -> no ritmo,
    // suprime seu próprio timeToEmptyHrs e expõe restockDueHrs = 14.
    // 2390 ("C", NÃO importado — sem balance correspondente): outPerHour = 20/h,
    // estoque 0 -> genuinamente parado agora (timeToEmptyHrs = 0). O refino de
    // cadência só roda para tipos em `importedTypes`, então C nunca entra nele.
    const layout = layoutWithContents(
      [
        { type_id: 2073, amount: 1_000_000 },
        { type_id: 2390, amount: 0 },
      ],
      [
        { typeId: 2073, quantity: 50 },
        { typeId: 2390, quantity: 10 },
      ]
    )
    const store = simulatePinBufferStatuses({
      layout,
      balances: [importedBalance(2073)], // 2390 não está nos balances -> não é "importado"
      assumeImports: false,
      projectionEnabled: true,
      visitCadenceHrs: cadenceHrs,
      lastUpdate,
      nowMs: Date.parse(lastUpdate) + 10 * 3_600_000,
    }).find((p) => p.pinId === 300)!

    const flowA = store.flows.find((f) => f.typeId === 2073)!
    const flowC = store.flows.find((f) => f.typeId === 2390)!
    expect(flowA.timeToEmptyHrs).toBeUndefined()
    expect(flowC.timeToEmptyHrs).toBe(0)

    // O restockDueHrs do fluxo saudável coexiste com o alerta real do outro fluxo —
    // o pin não pode se apresentar como "só esperando reposição" quando há uma
    // parada de verdade acontecendo ao mesmo tempo.
    expect(store.restockDueHrs).toBeCloseTo(14, 5)
    expect(store.timeToEmptyHrs).toBe(0)
    expect(store.limitingEmptyTypeId).toBe(2390)
    expect(store.status).toBe('stalled')
  })
})
