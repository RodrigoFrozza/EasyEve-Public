import { computeColonyGrid, gridHeadroomFor } from '@/lib/pi/pi-grid'
import { CC_GRID_BY_LEVEL, pinGridLoad } from '@/lib/pi/pi-grid-data'
import type { PiColonyLayout, PiPin } from '@/lib/pi/types'

function pin(type_id: number, extra: Partial<PiPin> = {}): PiPin {
  return { pin_id: Math.floor(Math.random() * 1e9), type_id, ...extra }
}

function layout(pins: PiPin[]): PiColonyLayout {
  return { pins, routes: [], links: [] }
}

describe('computeColonyGrid', () => {
  it('sums real ESI pin loads and extractor heads against the CC-level budget', () => {
    // Barren, CC level 5. Loads (ESI dogma):
    //  2474 Advanced Industry Facility 700/500
    //  2544 Launchpad                  700/3600
    //  2541 Storage Facility           700/500
    //  2848 Extractor Control Unit     2600/400 base + 550/110 per head
    //  2524 Command Center             provides budget, consumes nothing
    const l = layout([
      pin(2524),
      pin(2474),
      pin(2474),
      pin(2544),
      pin(2541),
      pin(2848, {
        extractor_details: {
          heads: [
            { head_id: 0, latitude: 0, longitude: 0 },
            { head_id: 1, latitude: 0, longitude: 0 },
            { head_id: 2, latitude: 0, longitude: 0 },
          ],
        },
      }),
    ])

    const g = computeColonyGrid(l, 5)

    const expectedPower = 700 * 2 + 700 + 700 + (2600 + 3 * 550) // 7050
    const expectedCpu = 500 * 2 + 3600 + 500 + (400 + 3 * 110) // 5830
    expect(g.power.used).toBe(expectedPower)
    expect(g.cpu.used).toBe(expectedCpu)
    expect(g.power.total).toBe(CC_GRID_BY_LEVEL[5]!.power) // 19000
    expect(g.cpu.total).toBe(CC_GRID_BY_LEVEL[5]!.cpu) // 25415
    expect(g.power.utilization).toBeCloseTo(expectedPower / 19000)
    expect(g.cpu.utilization).toBeCloseTo(expectedCpu / 25415)
    expect(g.binding).toBe('power')
    expect(g.utilization).toBeCloseTo(expectedPower / 19000)
    expect(g.overCapacity).toBe(false)
    expect(g.excludesLinks).toBe(true)
  })

  it('does not charge grid for the Command Center itself', () => {
    const g = computeColonyGrid(layout([pin(2524)]), 3)
    expect(g.power.used).toBe(0)
    expect(g.cpu.used).toBe(0)
    expect(g.power.total).toBe(CC_GRID_BY_LEVEL[3]!.power)
  })

  it('groups the breakdown by role with per-role loads', () => {
    const g = computeColonyGrid(layout([pin(2474), pin(2474), pin(2544)]), 5)
    const factory = g.breakdown.find((b) => b.role === 'advanced_processor')
    const launchpad = g.breakdown.find((b) => b.role === 'launchpad')
    expect(factory).toMatchObject({ count: 2, power: 1400, cpu: 1000 })
    expect(launchpad).toMatchObject({ count: 1, power: 700, cpu: 3600 })
  })

  it('flags over-capacity when load exceeds the budget', () => {
    // Level 0 budget is tiny (6000/1675); a launchpad alone (700/3600) blows CPU.
    const g = computeColonyGrid(layout([pin(2544)]), 0)
    expect(g.overCapacity).toBe(true)
    expect(g.binding).toBe('cpu')
    expect(g.cpu.utilization).toBeGreaterThan(1)
  })

  it('computes headroom limited by the tighter of power/CPU', () => {
    const l = layout([pin(2524), pin(2474), pin(2474), pin(2544), pin(2541)])
    const g = computeColonyGrid(l, 5)
    // remaining: power 19000-2800=16200, cpu 25415-5100=20315
    // one more advanced facility (700/500): byPower=23, byCpu=40 -> 23
    const headroom = gridHeadroomFor(g, pinGridLoad(2474))
    expect(headroom).toBe(Math.min(Math.floor(16200 / 700), Math.floor(20315 / 500)))
    expect(headroom).toBe(23)
  })
})
