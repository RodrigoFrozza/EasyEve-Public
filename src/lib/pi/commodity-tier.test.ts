import { getCommodityTier } from '@/lib/pi/commodity-tier'

describe('commodity-tier', () => {
  it('marks basic processor outputs as P1', () => {
    expect(getCommodityTier(2393)).toBe(1)
    expect(getCommodityTier(2398)).toBe(1)
  })

  it('keeps raw extractor materials as P0', () => {
    expect(getCommodityTier(2073)).toBe(0)
    expect(getCommodityTier(2267)).toBe(0)
    expect(getCommodityTier(2389)).toBe(0)
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
