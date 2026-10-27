import {
  aggregateStationOrders,
  isDeficit,
  pickDeficitCandidates,
  rankDeficits,
  demandValueIsk,
  MIN_DEMAND_ISK,
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
      bestBuy: 140,
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

describe('rankDeficits — taxes and job cost', () => {
  function input(over: Partial<DeficitRowInput> & { productTypeId: number }): DeficitRowInput {
    return {
      productName: `Item ${over.productTypeId}`,
      stationId: 's1',
      stationName: 'Home',
      sellVolume: 0,
      buyVolume: 100,
      itemPrice: 200,
      productionCost: 100,
      buildTimeSeconds: 3600,
      outputPerRun: 1,
      demandVolume: 1,
      demandDays: 0,
      anyThin: false,
      anyNoPrice: false,
      anyStale: false,
      ...over,
    }
  }

  it('keeps profit gross when taxes are not configured (never assumes 0% silently — the route labels it)', () => {
    const [row] = rankDeficits([input({ productTypeId: 1 })])
    expect(row!.netItemPrice).toBe(200)
    expect(row!.unitProfit).toBe(100)
    expect(row!.jobCostPerUnit).toBeNull()
    expect(row!.jobCostMissing).toBe(false)
  })

  it('deducts the configured sales tax + broker fee from the sale price', () => {
    // 200 × (1 − 0.05) = 190 → profit 90, margin 90%
    const [row] = rankDeficits([input({ productTypeId: 1, revenueTaxPct: 5 })])
    expect(row!.netItemPrice).toBeCloseTo(190)
    expect(row!.unitProfit).toBeCloseTo(90)
    expect(row!.margin).toBeCloseTo(0.9)
    expect(row!.iskPerHour).toBeCloseTo(90)
  })

  it('adds the job cost to the cost basis (profit, margin and build-vs-buy)', () => {
    // net 190 − (100 + 20) = 70; margin 70/120
    const [row] = rankDeficits([input({ productTypeId: 1, revenueTaxPct: 5, jobCostPerUnit: 20 })])
    expect(row!.unitProfit).toBeCloseTo(70)
    expect(row!.margin).toBeCloseTo(70 / 120)
    expect(row!.buildVsBuy).toBe('make')

    // materials 100 + job 120 = 220 > 200 to buy ready-made → buy
    const [costly] = rankDeficits([input({ productTypeId: 2, jobCostPerUnit: 120 })])
    expect(costly!.buildVsBuy).toBe('buy')
  })

  it('reorders by net opportunity: a row whose taxes/job eat the profit drops', () => {
    const rows = rankDeficits([
      input({ productTypeId: 1, itemPrice: 200, productionCost: 100, jobCostPerUnit: 95 }), // net 5
      input({ productTypeId: 2, itemPrice: 150, productionCost: 100, jobCostPerUnit: 1 }), // net 49
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('carries the jobCostMissing flag without sinking the row as unreliable', () => {
    const [row] = rankDeficits([input({ productTypeId: 1, jobCostMissing: true })])
    expect(row!.jobCostMissing).toBe(true)
    expect(row!.reliable).toBe(true)
    expect(row!.jobCostPerUnit).toBeNull()
  })
})

describe('demand floor', () => {
  it('values demand at the best buy price, not in units', () => {
    // 50 ships at 200M vs 50 rounds of ammo at 100 ISK: same units, nothing alike.
    expect(demandValueIsk(50, 200_000_000)).toBe(10_000_000_000)
    expect(demandValueIsk(50, 100)).toBe(5_000)
    expect(demandValueIsk(50, 100)).toBeLessThan(MIN_DEMAND_ISK)
  })

  it('is 10M ISK (Rodrigo, 2026-10-26)', () => {
    expect(MIN_DEMAND_ISK).toBe(10_000_000)
  })

  it('never goes negative on bad inputs', () => {
    expect(demandValueIsk(-3, 100)).toBe(0)
  })
})

describe('rankDeficits — activity and demand value', () => {
  const base: DeficitRowInput = {
    productTypeId: 16670,
    productName: 'Crystalline Carbonide',
    stationId: 's1',
    stationName: 'Home',
    sellVolume: 0,
    buyVolume: 1000,
    itemPrice: 900,
    productionCost: 500,
    buildTimeSeconds: 10800,
    outputPerRun: 100,
    demandVolume: 20000,
    demandDays: 3,
    bestBuy: 850,
    anyThin: false,
    anyNoPrice: false,
    anyStale: false,
  }

  it('defaults to manufacturing and carries reactions through', () => {
    expect(rankDeficits([base])[0].activity).toBe('manufacturing')
    expect(rankDeficits([{ ...base, activity: 'reaction' }])[0].activity).toBe('reaction')
  })

  it('exposes the demand value it was filtered on', () => {
    expect(rankDeficits([base])[0].demandValueIsk).toBe(20000 * 850)
  })
})
