import {
  aggregateStationOrders,
  isDeficit,
  pickDeficitCandidates,
  rankDeficits,
  type StationOrderAggregate,
  type DeficitRowInput,
} from '@/lib/industry/deficit-scan'

function order(type_id: number, is_buy_order: boolean, price: number, volume_remain: number) {
  return { type_id, is_buy_order, price, volume_remain }
}

describe('aggregateStationOrders', () => {
  it('sums supply/demand and tracks best prices per type', () => {
    const agg = aggregateStationOrders([
      order(34, false, 6, 100), // sell
      order(34, false, 5, 50), // cheaper sell
      order(34, true, 4, 200), // buy
      order(34, true, 3, 100), // lower buy
    ])
    const a = agg.get(34)!
    expect(a.sellVolume).toBe(150)
    expect(a.buyVolume).toBe(300)
    expect(a.bestSell).toBe(5) // lowest ask
    expect(a.bestBuy).toBe(4) // highest bid
  })

  it('ignores zero-price or zero-volume orders', () => {
    const agg = aggregateStationOrders([order(1, false, 0, 10), order(1, true, 5, 0)])
    expect(agg.has(1)).toBe(false)
  })
})

describe('isDeficit', () => {
  const base: StationOrderAggregate = { typeId: 1, sellVolume: 0, buyVolume: 0, bestSell: 0, bestBuy: 0 }
  it('flags demand that outweighs supply', () => {
    expect(isDeficit({ ...base, buyVolume: 500, sellVolume: 100 })).toBe(true)
    expect(isDeficit({ ...base, buyVolume: 500, sellVolume: 0 })).toBe(true)
  })
  it('is not a deficit when supply meets or exceeds demand, or there is no demand', () => {
    expect(isDeficit({ ...base, buyVolume: 100, sellVolume: 500 })).toBe(false)
    expect(isDeficit({ ...base, buyVolume: 0, sellVolume: 0 })).toBe(false)
  })
})

describe('pickDeficitCandidates', () => {
  it('keeps only manufacturable deficits and pre-ranks by scarcity × value', () => {
    const aggs = new Map<number, StationOrderAggregate>([
      [10, { typeId: 10, sellVolume: 0, buyVolume: 100, bestSell: 0, bestBuy: 1000 }], // deficit, buildable, high value
      [11, { typeId: 11, sellVolume: 0, buyVolume: 100, bestSell: 0, bestBuy: 10 }], // deficit, buildable, low value
      [12, { typeId: 12, sellVolume: 500, buyVolume: 10, bestSell: 5, bestBuy: 4 }], // not a deficit
      [13, { typeId: 13, sellVolume: 0, buyVolume: 100, bestSell: 0, bestBuy: 9999 }], // deficit but not buildable
    ])
    const buildable = new Set([10, 11, 12])
    const out = pickDeficitCandidates(aggs, (id) => buildable.has(id), 10)
    expect(out.map((c) => c.typeId)).toEqual([10, 11]) // 12 not deficit, 13 not buildable; 10 before 11 (value)
  })

  it('caps to the limit', () => {
    const aggs = new Map<number, StationOrderAggregate>()
    for (let i = 0; i < 20; i++) aggs.set(i, { typeId: i, sellVolume: 0, buyVolume: 100, bestSell: 0, bestBuy: 100 })
    const out = pickDeficitCandidates(aggs, () => true, 5)
    expect(out).toHaveLength(5)
  })
})

describe('rankDeficits', () => {
  function input(over: Partial<DeficitRowInput> & { productTypeId: number }): DeficitRowInput {
    return {
      productName: `Item ${over.productTypeId}`,
      stationId: 's1',
      stationName: 'Home',
      sellVolume: 0,
      buyVolume: 100,
      itemPrice: 150,
      productionCost: 100,
      buildTimeSeconds: null,
      outputPerRun: 1,
      demandVolume: 1,
      demandDays: 0,
      anyThin: false,
      anyNoPrice: false,
      anyStale: false,
      ...over,
    }
  }

  it('computes margin and build-vs-buy', () => {
    const [row] = rankDeficits([input({ productTypeId: 1, itemPrice: 150, productionCost: 100 })])
    expect(row!.margin).toBeCloseTo(0.5)
    expect(row!.buildVsBuy).toBe('make') // 100 to build < 150 to buy
  })

  it('marks buy when building costs more than buying the finished item', () => {
    const [row] = rankDeficits([input({ productTypeId: 1, itemPrice: 100, productionCost: 150 })])
    expect(row!.buildVsBuy).toBe('buy')
  })

  it('falls back to margin ordering when no row has a build time (ISK/h unknown)', () => {
    const rows = rankDeficits([
      input({ productTypeId: 1, itemPrice: 110, productionCost: 100 }), // 10%
      input({ productTypeId: 2, itemPrice: 300, productionCost: 100 }), // 200%
      input({ productTypeId: 3, itemPrice: 150, productionCost: 0, anyNoPrice: true }), // unreliable
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1, 3])
  })

  it('computes net ISK/h from unit profit × output per run ÷ build hours', () => {
    // profit 50/unit × 2 units/run = 100 per job; 1800s = 0.5h -> 200 ISK/h
    const [row] = rankDeficits([
      input({ productTypeId: 1, itemPrice: 150, productionCost: 100, outputPerRun: 2, buildTimeSeconds: 1800 }),
    ])
    expect(row!.iskPerHour).toBe(200)
  })

  it('ranks by ISK/h, so a fat-margin item with a huge build time loses to a lean, fast one', () => {
    const rows = rankDeficits([
      // 200% margin but 100h build -> tiny ISK/h
      input({ productTypeId: 1, itemPrice: 300, productionCost: 100, buildTimeSeconds: 360000 }),
      // 20% margin but 6min build -> big ISK/h
      input({ productTypeId: 2, itemPrice: 120, productionCost: 100, buildTimeSeconds: 360 }),
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('ranks timed rows above untimed ones, and unreliable last', () => {
    const rows = rankDeficits([
      input({ productTypeId: 1, itemPrice: 300, productionCost: 100 }), // reliable, no time
      input({ productTypeId: 2, itemPrice: 110, productionCost: 100, buildTimeSeconds: 3600 }), // timed -> has ISK/h
      input({ productTypeId: 3, itemPrice: 150, productionCost: 0, anyNoPrice: true }), // unreliable
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1, 3])
  })

  it('weights the score by demand: same ISK/h, higher demand ranks first', () => {
    const rows = rankDeficits([
      input({ productTypeId: 1, buildTimeSeconds: 3600, demandVolume: 10 }),
      input({ productTypeId: 2, buildTimeSeconds: 3600, demandVolume: 1000 }),
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('a lean, high-demand item beats a fat-margin item almost nobody buys', () => {
    const rows = rankDeficits([
      // huge ISK/h but demand of 1 unit -> tiny opportunity
      input({ productTypeId: 1, itemPrice: 1100, productionCost: 100, buildTimeSeconds: 3600, demandVolume: 1 }),
      // modest ISK/h but demand of 5000 -> big opportunity
      input({ productTypeId: 2, itemPrice: 120, productionCost: 100, buildTimeSeconds: 3600, demandVolume: 5000 }),
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('computes opportunityScore = ISK/h × demand and passes demandDays through', () => {
    // profit 50/unit × 1 = 50 per job; 3600s = 1h -> 50 ISK/h; × demand 200 -> 10000
    const [row] = rankDeficits([
      input({ productTypeId: 1, itemPrice: 150, productionCost: 100, buildTimeSeconds: 3600, demandVolume: 200, demandDays: 3 }),
    ])
    expect(row!.iskPerHour).toBe(50)
    expect(row!.opportunityScore).toBe(10000)
    expect(row!.demandDays).toBe(3)
  })

  it('leaves opportunityScore null when ISK/h is unknown (no build time)', () => {
    const [row] = rankDeficits([input({ productTypeId: 1, demandVolume: 5000 })])
    expect(row!.iskPerHour).toBeNull()
    expect(row!.opportunityScore).toBeNull()
  })
})
