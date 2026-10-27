import { rankWhatToProduce, type WhatToProduceInput } from '@/lib/industry/what-to-produce'
import { META_GROUP } from '@/lib/industry/meta-group'

function input(over: Partial<WhatToProduceInput> & { productTypeId: number }): WhatToProduceInput {
  return {
    productName: `Item ${over.productTypeId}`,
    metaGroupId: META_GROUP.TECH_I,
    owned: false,
    bestMe: 10,
    bestTe: 20,
    materialCost: 100,
    sellPrice: 150,
    dailyVolume: 100,
    buildTimeSeconds: 3600,
    outputPerRun: 1,
    anyThin: false,
    anyNoPrice: false,
    anyStale: false,
    ...over,
  }
}

describe('rankWhatToProduce', () => {
  it('computes profit, ISK/h, tier and opportunity score', () => {
    // profit 50 × 1 = 50/job; 3600s = 1h -> 50 ISK/h; × velocity 100 -> 5000
    const [row] = rankWhatToProduce([input({ productTypeId: 1, metaGroupId: META_GROUP.TECH_II })])
    expect(row!.unitProfit).toBe(50)
    expect(row!.iskPerHour).toBe(50)
    expect(row!.opportunityScore).toBe(5000)
    expect(row!.tier).toBe('t2')
  })

  it('sinks a profitable item that barely trades (SVR)', () => {
    const rows = rankWhatToProduce([
      // huge ISK/h but sells 1/day -> tiny opportunity
      input({ productTypeId: 1, sellPrice: 1100, materialCost: 100, dailyVolume: 1 }),
      // modest ISK/h but sells 5000/day -> big opportunity
      input({ productTypeId: 2, sellPrice: 120, materialCost: 100, dailyVolume: 5000 }),
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('flags wouldFlood when build rate exceeds market velocity', () => {
    // 3600s build -> 24 units/day; market only trades 5/day -> flood
    const flood = rankWhatToProduce([input({ productTypeId: 1, dailyVolume: 5 })])[0]!
    expect(flood.wouldFlood).toBe(true)
    // market trades 100000/day -> no flood
    const ok = rankWhatToProduce([input({ productTypeId: 2, dailyVolume: 100000 })])[0]!
    expect(ok.wouldFlood).toBe(false)
  })

  it('leaves score null and does not flood when build time is unknown', () => {
    const [row] = rankWhatToProduce([input({ productTypeId: 1, buildTimeSeconds: null })])
    expect(row!.iskPerHour).toBeNull()
    expect(row!.opportunityScore).toBeNull()
    expect(row!.wouldFlood).toBe(false)
  })

  it('sinks unreliable (no sell price) rows below scored ones', () => {
    const rows = rankWhatToProduce([
      input({ productTypeId: 1, sellPrice: 0, anyNoPrice: true }),
      input({ productTypeId: 2, sellPrice: 200, materialCost: 100 }),
    ])
    expect(rows[0]!.productTypeId).toBe(2)
    expect(rows[1]!.reliable).toBe(false)
  })

  it('carries the owned flag and faction tier through', () => {
    const [row] = rankWhatToProduce([
      input({ productTypeId: 1, metaGroupId: META_GROUP.FACTION, owned: true }),
    ])
    expect(row!.tier).toBe('faction')
    expect(row!.owned).toBe(true)
  })
})
