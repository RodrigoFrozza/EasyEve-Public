import { getCommodityTier } from '@/lib/pi/commodity-tier'

describe('commodity-tier', () => {
  it('marks basic processor outputs as P1', () => {
    expect(getCommodityTier(2393)).toBe(1)
    expect(getCommodityTier(2398)).toBe(1)
  })

  it('keeps raw extractor materials as P0', () => {
    expect(getCommodityTier(2073)).toBe(0)
    expect(getCommodityTier(2267)).toBe(0)
    expect(getCommodityTier(2268)).toBe(0) // Aqueous Liquids
  })

  // These 14 were mis-tiered until 2026-10-23 (generator read market group 1335
  // as P1 and patched with heuristics). The SDE market group and the SDE customs
  // base value both put them here.
  it('classifies the previously mis-tiered commodities by their SDE market group', () => {
    // P1 (Processed Materials, 1334) — were P0
    for (const id of [2389, 2390, 2392, 2397, 2401, 3683, 9828]) expect(getCommodityTier(id)).toBe(1)
    // P2 (Refined Commodities, 1335) — were P1
    for (const id of [2317, 2321, 2327, 3691, 3697, 9830]) expect(getCommodityTier(id)).toBe(2)
    // P3 (Specialized Commodities, 1336) — was P2
    expect(getCommodityTier(2345)).toBe(3) // Camera Drones
  })

  it('marks advanced industry outputs as P2', () => {
    expect(getCommodityTier(3689)).toBe(2)
    expect(getCommodityTier(9838)).toBe(2)
    expect(getCommodityTier(2463)).toBe(2)
  })

  it('marks high-tech outputs as P3', () => {
    expect(getCommodityTier(2344)).toBe(3)
  })
})
