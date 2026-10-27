import {
  compressionUnitRatio,
  resolveMiningUnitPrice,
  calculateRefinedUnitPrice,
  miningPriceBasisTooltip,
} from './mining-price-resolution'

jest.mock('@/lib/server-logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

describe('compressionUnitRatio', () => {
  it('returns 1 for ice', () => {
    expect(compressionUnitRatio(true)).toBe(1)
  })

  it('returns 100 for non-ice', () => {
    expect(compressionUnitRatio(false)).toBe(100)
  })
})

describe('resolveMiningUnitPrice', () => {
  const base = { rawBuy: 0, rawSell: 0, compressedBuy: 0, compressedSell: 0 }

  it('prefers raw buy (high confidence)', () => {
    expect(
      resolveMiningUnitPrice({ isIceMiningCategory: false, ...base, rawBuy: 12.5 })
    ).toEqual({ unitPrice: 12.5, basis: 'jita_buy_raw', confidence: 'high' })
  })

  it('uses compressed buy scaled by 100 for ore', () => {
    expect(
      resolveMiningUnitPrice({
        isIceMiningCategory: false,
        ...base,
        rawBuy: 0,
        compressedBuy: 1000,
      })
    ).toEqual({ unitPrice: 10, basis: 'jita_buy_compressed', confidence: 'fallback' })
  })

  it('uses compressed buy 1:1 for ice', () => {
    expect(
      resolveMiningUnitPrice({
        isIceMiningCategory: true,
        ...base,
        rawBuy: 0,
        compressedBuy: 250000,
      })
    ).toEqual({ unitPrice: 250000, basis: 'jita_buy_compressed', confidence: 'fallback' })
  })

  it('falls back to raw sell then compressed sell', () => {
    expect(
      resolveMiningUnitPrice({
        isIceMiningCategory: false,
        ...base,
        rawSell: 9,
      })
    ).toEqual({ unitPrice: 9, basis: 'jita_sell_raw', confidence: 'fallback' })

    expect(
      resolveMiningUnitPrice({
        isIceMiningCategory: false,
        ...base,
        compressedSell: 500,
      })
    ).toEqual({ unitPrice: 5, basis: 'jita_sell_compressed', confidence: 'fallback' })
  })

  it('treats zero and negative as missing', () => {
    expect(
      resolveMiningUnitPrice({
        isIceMiningCategory: false,
        rawBuy: -1,
        rawSell: 0,
        compressedBuy: 0,
        compressedSell: 0,
      })
    ).toEqual({ unitPrice: 0, basis: 'none', confidence: 'none' })
  })

  it('returns none when all prices are zero', () => {
    expect(resolveMiningUnitPrice({ isIceMiningCategory: false, ...base })).toEqual({
      unitPrice: 0,
      basis: 'none',
      confidence: 'none',
    })
  })
})

describe('calculateRefinedUnitPrice', () => {
  it('returns 0 for empty yields', () => {
    expect(calculateRefinedUnitPrice([], { 34: 5 }, false)).toBe(0)
  })

  it('divides ore batch value by 100', () => {
    const yields = [{ materialId: 34, quantity: 400 }]
    const prices = { 34: 10 }
    expect(calculateRefinedUnitPrice(yields, prices, false)).toBe(40)
  })

  it('uses batch size 1 for ice', () => {
    const yields = [{ materialId: 16272, quantity: 100 }]
    const prices = { 16272: 2 }
    expect(calculateRefinedUnitPrice(yields, prices, true)).toBe(200)
  })
})

describe('miningPriceBasisTooltip', () => {
  it('covers all MiningPriceBasis variants', () => {
    expect(miningPriceBasisTooltip('jita_buy_raw')).toContain('buy')
    expect(miningPriceBasisTooltip('jita_buy_compressed')).toContain('compressed')
    expect(miningPriceBasisTooltip('jita_sell_raw')).toContain('sell')
    expect(miningPriceBasisTooltip('jita_sell_compressed')).toContain('compressed')
    expect(miningPriceBasisTooltip('none')).toContain('No Jita')
  })
})
