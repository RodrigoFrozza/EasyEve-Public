import {
  buildShoppingPriceRows,
  isDeficientAtPrimary,
  findCheapestAndPriciest,
} from '@/lib/pi/shopping-prices'
import type { MarketDepth } from '@/lib/market-prices'

function depth(sell: Array<[number, number]>): MarketDepth {
  return {
    sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    buy: [],
    updatedAt: Date.now(),
  }
}

describe('buildShoppingPriceRows', () => {
  it('computes price and total available volume per source', () => {
    const rows = buildShoppingPriceRows(
      [1],
      {
        primaryDepth: { 1: depth([[10, 50], [11, 100]]) },
        secondaryDepth: { 1: depth([[12, 20]]) },
        jitaDepth: { 1: depth([[9, 500]]) },
      }
    )
    expect(rows[1]!.primary).toEqual({ price: 10, available: 150, stale: false })
    expect(rows[1]!.secondary).toEqual({ price: 12, available: 20, stale: false })
    expect(rows[1]!.jita).toEqual({ price: 9, available: 500, stale: false })
  })

  it('leaves primary/secondary undefined when not configured (not zero stock)', () => {
    const rows = buildShoppingPriceRows([1], {
      primaryDepth: null,
      secondaryDepth: null,
      jitaDepth: { 1: depth([[9, 500]]) },
    })
    expect(rows[1]!.primary).toBeUndefined()
    expect(rows[1]!.secondary).toBeUndefined()
  })

  it('reports zero available when configured but no sell orders exist', () => {
    const rows = buildShoppingPriceRows([1], {
      primaryDepth: { 1: depth([]) },
      secondaryDepth: null,
      jitaDepth: {},
    })
    expect(rows[1]!.primary).toEqual({ price: 0, available: 0, stale: false })
    expect(rows[1]!.jita).toEqual({ price: 0, available: 0, stale: false })
  })

  it('flags a source as stale when its depth snapshot is older than one refresh cycle', () => {
    const oldDepth: MarketDepth = {
      sell: [{ price: 12, volume: 20, locationId: 0 }],
      buy: [],
      updatedAt: Date.now() - 25 * 60 * 1000, // 25 min ago, past the 20 min threshold
    }
    const rows = buildShoppingPriceRows([1], {
      primaryDepth: null,
      secondaryDepth: { 1: oldDepth },
      jitaDepth: {},
    })
    expect(rows[1]!.secondary?.stale).toBe(true)
  })
})

describe('isDeficientAtPrimary', () => {
  it('flags when primary stock is below the needed quantity', () => {
    const row = {
      primary: { price: 10, available: 40, stale: false },
      jita: { price: 9, available: 500, stale: false },
    }
    expect(isDeficientAtPrimary(row, 50)).toBe(true)
    expect(isDeficientAtPrimary(row, 40)).toBe(false)
  })

  it('never flags when no primary source is configured', () => {
    const row = { jita: { price: 9, available: 0, stale: false } }
    expect(isDeficientAtPrimary(row, 9999)).toBe(false)
    expect(isDeficientAtPrimary(undefined, 9999)).toBe(false)
  })
})

describe('findCheapestAndPriciest', () => {
  it('picks the min and max price among sources with real orders', () => {
    const row = {
      primary: { price: 100, available: 50, stale: false },
      secondary: { price: 80, available: 50, stale: false },
      jita: { price: 120, available: 50, stale: false },
    }
    expect(findCheapestAndPriciest(row)).toEqual({ cheapest: 'secondary', priciest: 'jita' })
  })

  it('ignores sources with no orders (price or available at 0)', () => {
    const row = {
      primary: { price: 0, available: 0, stale: false },
      secondary: { price: 80, available: 50, stale: false },
      jita: { price: 120, available: 50, stale: false },
    }
    expect(findCheapestAndPriciest(row)).toEqual({ cheapest: 'secondary', priciest: 'jita' })
  })

  it('returns nothing when fewer than 2 sources are comparable', () => {
    expect(findCheapestAndPriciest({ jita: { price: 120, available: 50, stale: false } })).toEqual({})
    expect(findCheapestAndPriciest(undefined)).toEqual({})
  })

  it('returns nothing when all comparable sources have the same price', () => {
    const row = {
      primary: { price: 100, available: 50, stale: false },
      jita: { price: 100, available: 50, stale: false },
    }
    expect(findCheapestAndPriciest(row)).toEqual({})
  })

  it('ignores stale sources — a buy-here signal must not point at an old snapshot', () => {
    const row = {
      primary: { price: 100, available: 50, stale: false },
      secondary: { price: 10, available: 50, stale: true },
      jita: { price: 120, available: 50, stale: false },
    }
    expect(findCheapestAndPriciest(row)).toEqual({ cheapest: 'primary', priciest: 'jita' })
  })
})
