import {
  computeDemandModel,
  computeIncomingRouteThroughput,
} from '@/lib/pi/demand-model'
import { analyzeColonyLayout } from '@/lib/pi/production-graph'
import type { PiColonyLayout, PiColonySummary } from '@/lib/pi/types'

const nowMs = Date.parse('2024-01-01T12:00:00Z')

const summary: PiColonySummary = {
  owner_id: 1,
  planet_id: 40000010,
  planet_type: 'gas',
  solar_system_id: 30000142,
  upgrade_level: 0,
  num_pins: 6,
  last_update: new Date().toISOString(),
}

/** extractor → storage → P1 basic → storage → P2 advanced → launchpad */
const storageHubLayout: PiColonyLayout = {
  links: [],
  routes: [
    { route_id: 1, source_pin_id: 100, destination_pin_id: 200, content_type_id: 2309, quantity: 3000 },
    { route_id: 2, source_pin_id: 101, destination_pin_id: 200, content_type_id: 2268, quantity: 3000 },
    { route_id: 3, source_pin_id: 200, destination_pin_id: 210, content_type_id: 2309, quantity: 3000 },
    { route_id: 4, source_pin_id: 200, destination_pin_id: 211, content_type_id: 2268, quantity: 3000 },
    { route_id: 5, source_pin_id: 210, destination_pin_id: 200, content_type_id: 2390, quantity: 60 },
    { route_id: 6, source_pin_id: 211, destination_pin_id: 200, content_type_id: 3645, quantity: 60 },
    { route_id: 7, source_pin_id: 200, destination_pin_id: 230, content_type_id: 2390, quantity: 80 },
    { route_id: 8, source_pin_id: 200, destination_pin_id: 230, content_type_id: 3645, quantity: 80 },
    { route_id: 9, source_pin_id: 230, destination_pin_id: 300, content_type_id: 9832, quantity: 5 },
  ],
  pins: [
    {
      pin_id: 100,
      type_id: 3060,
      install_time: '2024-01-01T00:00:00Z',
      expiry_time: '2024-01-03T00:00:00Z',
      extractor_details: { product_type_id: 2309, qty_per_cycle: 5000, cycle_time: 1800 },
    },
    {
      pin_id: 101,
      type_id: 3060,
      install_time: '2024-01-01T00:00:00Z',
      expiry_time: '2024-01-03T00:00:00Z',
      extractor_details: { product_type_id: 2268, qty_per_cycle: 5000, cycle_time: 1800 },
    },
    { pin_id: 200, type_id: 2541 },
    { pin_id: 210, type_id: 2469, factory_details: { schematic_id: 123 } },
    { pin_id: 211, type_id: 2469, factory_details: { schematic_id: 121 } },
    { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 66 } },
    { pin_id: 300, type_id: 2256 },
  ],
}

describe('coolant storage-hub chain', () => {
  it('counts storage → factory throughput on advanced inputs', () => {
    const incoming = computeIncomingRouteThroughput(storageHubLayout)
    expect(incoming.get(230)?.get(2390)).toBeCloseTo(80, 0)
    expect(incoming.get(230)?.get(3645)).toBeCloseTo(80, 0)
  })

  it('potential and current balances include coolant production with P1 demand', () => {
    const result = computeDemandModel(storageHubLayout, nowMs)

    const electrolytes = result.potential.find((b) => b.typeId === 2390)
    const water = result.potential.find((b) => b.typeId === 3645)
    const coolant = result.potential.find((b) => b.typeId === 9832)

    expect(electrolytes?.productionPerHour).toBeGreaterThan(0)
    expect(water?.productionPerHour).toBeGreaterThan(0)
    expect(electrolytes?.demandPerHour).toBeGreaterThan(0)
    expect(water?.demandPerHour).toBeGreaterThan(0)
    expect(coolant?.productionPerHour).toBeGreaterThan(0)

    const curElectrolytes = result.current.find((b) => b.typeId === 2390)
    const curWater = result.current.find((b) => b.typeId === 3645)
    const curCoolant = result.current.find((b) => b.typeId === 9832)

    expect(curElectrolytes?.demandPerHour).toBeGreaterThan(0)
    expect(curWater?.demandPerHour).toBeGreaterThan(0)
    expect(curCoolant?.productionPerHour).toBeGreaterThan(0)
  })

  it('matches user symptom when storage→P2 routes are missing', () => {
    const brokenLayout: PiColonyLayout = {
      ...storageHubLayout,
      routes: storageHubLayout.routes.filter(
        (r) => !(r.source_pin_id === 200 && r.destination_pin_id === 230)
      ),
    }

    const result = computeDemandModel(brokenLayout, nowMs)
    const curCoolant = result.current.find((b) => b.typeId === 9832)
    const curElectrolytes = result.current.find((b) => b.typeId === 2390)

    // Without storage→advanced routes, cascade still has local P1 in the pool
    expect(curCoolant?.productionPerHour).toBeGreaterThan(0)
    expect(curElectrolytes?.demandPerHour).toBeGreaterThan(0)
  })

  it('analyzeColonyLayout end-to-end', () => {
    const analysis = analyzeColonyLayout({
      characterId: 1,
      characterName: 'Test',
      summary,
      layout: storageHubLayout,
      nowMs,
    })

    const coolant = analysis.balances.current.find((b) => b.typeId === 9832)
    expect(coolant?.productionPerHour).toBeGreaterThan(0)
    expect(analysis.exitTypeId).toBe(9832)
  })
})
