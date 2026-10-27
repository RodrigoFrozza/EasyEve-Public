import { appraiseItems, filterDepthByLocations } from '@/lib/appraisal/appraise'
import type { MarketDepth } from '@/lib/market-prices'

function depth(
  sell: Array<[number, number]>,
  buy: Array<[number, number]>,
  updatedAt = Date.now()
): MarketDepth {
  return {
    sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    buy: buy.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    updatedAt,
  }
}

function depthAt(
  sell: Array<[number, number, number]>,
  buy: Array<[number, number, number]>,
  updatedAt = Date.now()
): MarketDepth {
  return {
    sell: sell.map(([price, volume, locationId]) => ({ price, volume, locationId })),
    buy: buy.map(([price, volume, locationId]) => ({ price, volume, locationId })),
    updatedAt,
  }
}

describe('appraiseItems', () => {
  it('prices buy against bids and sell against asks, split as their mean', () => {
    const result = appraiseItems(
      [{ typeId: 34, name: 'Tritanium', quantity: 100 }],
      { 34: depth([[6, 1000]], [[5, 1000]]) }
    )
    const row = result.items[0]!
    expect(row.sellUnit).toBe(6) // buying from the ask
    expect(row.buyUnit).toBe(5) // selling into the bid
    expect(row.splitUnit).toBe(5.5)
    expect(row.sellTotal).toBe(600) // 100 × 6
    expect(row.buyTotal).toBe(500) // 100 × 5
    expect(row.splitTotal).toBe(550)
    expect(row.buySufficient).toBe(true)
    expect(row.sellSufficient).toBe(true)
    expect(row.noOrders).toBe(false)
  })

  it('passes volume and groupName through untouched, defaulting to null when omitted', () => {
    const withMeta = appraiseItems(
      [{ typeId: 16273, name: 'Liquid Ozone', quantity: 10, volume: 0.01, groupName: 'Ice Product' }],
      { 16273: depth([[10, 100]], [[8, 100]]) }
    )
    expect(withMeta.items[0]!.volume).toBe(0.01)
    expect(withMeta.items[0]!.groupName).toBe('Ice Product')

    const withoutMeta = appraiseItems(
      [{ typeId: 34, name: 'Tritanium', quantity: 10 }],
      { 34: depth([[10, 100]], [[8, 100]]) }
    )
    expect(withoutMeta.items[0]!.volume).toBeNull()
    expect(withoutMeta.items[0]!.groupName).toBeNull()
  })

  it('prices at the reference (not an order-book walk)', () => {
    // Book: 100 @ 10 then 50 @ 12. Reference (5% percentile of 150 vol = top 7.5
    // units) sits entirely in the 10-level → sellUnit 10, headline 10 × 150 = 1500.
    // Walking the whole book instead would give 1000 + 600 = 1600 — the headline is
    // NOT that walk.
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 150 }],
      { 1: depth([[10, 100], [12, 50]], []) }
    )
    const row = result.items[0]!
    expect(row.sellUnit).toBe(10) // reference top-of-market ask
    expect(row.sellTotal).toBe(1500) // reference × qty, NOT the 1600 walk
    expect(row.sellSufficient).toBe(true)
  })

  it('drops absurd low bids when setting the buy reference (outlier guard)', () => {
    // Bid book: 1 unit @ 100 (best), then 10000 units @ 0.5. The deep 0.5 level is
    // below 1% of the best bid (1 ISK) so the guard drops it — the reference stays
    // at 100 instead of being dragged to ~0.5 by the huge junk level.
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 10 }],
      { 1: depth([], [[100, 1], [0.5, 10000]]) }
    )
    expect(result.items[0]!.buyUnit).toBe(100)
  })

  it('flags a thin book as not sufficient but still prices the full qty at reference', () => {
    // Want 100 but only 30 units on the ask side: headline is still reference × 100
    // (a contract is priced at reference), with a hard thin-book flag.
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 100 }],
      { 1: depth([[10, 30]], []) }
    )
    const row = result.items[0]!
    expect(row.sellSufficient).toBe(false)
    expect(row.sellFilledQty).toBe(30)
    expect(row.sellUnit).toBe(10)
    expect(row.sellTotal).toBe(1000) // reference × full qty, thinness flagged separately
  })

  it('marks an item with no orders at all, not as a false zero', () => {
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 100 }],
      { 1: depth([], []) }
    )
    const row = result.items[0]!
    expect(row.noOrders).toBe(true)
    expect(row.buySufficient).toBe(false)
    expect(row.sellSufficient).toBe(false)
    expect(row.buyTotal).toBe(0)
    expect(row.sellTotal).toBe(0)
  })

  it('treats a missing type (no depth entry) as no orders', () => {
    const result = appraiseItems([{ typeId: 999, name: 'X', quantity: 5 }], {})
    expect(result.items[0]!.noOrders).toBe(true)
  })

  it('flags a stale depth snapshot (older than one refresh cycle)', () => {
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 1 }],
      { 1: depth([[10, 10]], [], Date.now() - 25 * 60 * 1000) }
    )
    expect(result.items[0]!.stale).toBe(true)
  })

  it('does not flag updatedAt=0 (no cache) as stale — it is "no data", handled by noOrders', () => {
    const result = appraiseItems(
      [{ typeId: 1, name: 'X', quantity: 1 }],
      { 1: depth([], [], 0) }
    )
    expect(result.items[0]!.stale).toBe(false)
  })

  it('filters region depth down to the requested station locations', () => {
    const hub = new Set([60003760])
    // Ask side: a cheap order sits in a remote station (999), the real hub order at 60003760.
    const filtered = filterDepthByLocations(
      { 1: depthAt([[5, 100, 999], [10, 100, 60003760]], [[8, 100, 60003760]]) },
      hub
    )
    expect(filtered[1]!.sell).toEqual([{ price: 10, volume: 100, locationId: 60003760 }])
    expect(filtered[1]!.buy).toEqual([{ price: 8, volume: 100, locationId: 60003760 }])
  })

  it('sums totals across all line items', () => {
    const result = appraiseItems(
      [
        { typeId: 1, name: 'A', quantity: 10 },
        { typeId: 2, name: 'B', quantity: 10 },
      ],
      {
        1: depth([[10, 100]], [[8, 100]]),
        2: depth([[20, 100]], [[16, 100]]),
      }
    )
    expect(result.totalSell).toBe(10 * 10 + 10 * 20) // 300
    expect(result.totalBuy).toBe(10 * 8 + 10 * 16) // 240
    expect(result.totalSplit).toBe((300 + 240) / 2) // 270
  })
})
