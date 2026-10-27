import {
  buildRouteEdges,
  exportedTypeIds,
  getRoutedToExportTypeIds,
  getTerminalExportTypeIds,
} from '@/lib/pi/route-graph'
import type { PiColonyLayout } from '@/lib/pi/types'

describe('route-graph', () => {
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
      {
        route_id: 2,
        source_pin_id: 200,
        destination_pin_id: 300,
        content_type_id: 2390,
        quantity: 5,
      },
    ],
    pins: [
      {
        pin_id: 100,
        type_id: 3060,
        extractor_details: { product_type_id: 2073, qty_per_cycle: 1000, cycle_time: 1800 },
      },
      {
        pin_id: 200,
        type_id: 2469,
        factory_details: { schematic_id: 131 },
      },
      {
        pin_id: 300,
        type_id: 2256,
        contents: [{ type_id: 2390, amount: 100 }],
      },
    ],
  }

  it('classifies route edges', () => {
    const edges = buildRouteEdges(layout)
    expect(edges).toHaveLength(2)
    expect(edges[0]?.kind).toBe('extractorToFactory')
    expect(edges[1]?.kind).toBe('toExportStore')
  })

  it('detects exportable types including highest tier and stored unused', () => {
    const produced = new Set<number>([2390])
    const recipeInputs = new Set<number>([2073])
    const exports = exportedTypeIds(layout, produced, recipeInputs)
    expect(exports.has(2390)).toBe(true)
    expect(exports.has(2073)).toBe(false)
  })

  it('getTerminalExportTypeIds excludes buffer hops consumed by downstream factories', () => {
    const multiTierLayout: PiColonyLayout = {
      links: [],
      routes: [
        { route_id: 1, source_pin_id: 210, destination_pin_id: 220, content_type_id: 2398, quantity: 20 },
        { route_id: 2, source_pin_id: 220, destination_pin_id: 230, content_type_id: 2398, quantity: 40 },
        { route_id: 3, source_pin_id: 230, destination_pin_id: 300, content_type_id: 3689, quantity: 5 },
      ],
      pins: [
        { pin_id: 210, type_id: 2469, factory_details: { schematic_id: 126 } },
        { pin_id: 220, type_id: 2541 },
        { pin_id: 230, type_id: 2472, factory_details: { schematic_id: 73 } },
        { pin_id: 300, type_id: 2256 },
      ],
    }

    const edges = buildRouteEdges(multiTierLayout)
    const routed = getRoutedToExportTypeIds(edges)
    const terminal = getTerminalExportTypeIds(edges)

    expect(routed.has(2398)).toBe(true)
    expect(terminal.has(2398)).toBe(false)
    expect(terminal.has(3689)).toBe(true)
  })
})
