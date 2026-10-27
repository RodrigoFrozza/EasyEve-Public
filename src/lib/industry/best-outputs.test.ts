import { rankBestOutputs, type BestOutputRowInput } from '@/lib/industry/best-outputs'

function input(over: Partial<BestOutputRowInput> & { productTypeId: number }): BestOutputRowInput {
  return {
    productName: `Item ${over.productTypeId}`,
    bestMe: 10,
    bestTe: 20,
    materialCost: 100,
    sellPrice: 150,
    buildTimeSeconds: 3600,
    outputPerRun: 1,
    sellDemand: 100,
    anyThin: false,
    anyNoPrice: false,
    anyStale: false,
    ...over,
  }
}

describe('rankBestOutputs', () => {
  it('computes profit, ISK/h and opportunity score', () => {
    // profit 50 × 1 unit = 50 per job; 3600s = 1h -> 50 ISK/h; × demand 100 -> 5000
    const [row] = rankBestOutputs([input({ productTypeId: 1 })])
    expect(row!.unitProfit).toBe(50)
    expect(row!.margin).toBeCloseTo(0.5)
    expect(row!.iskPerHour).toBe(50)
    expect(row!.opportunityScore).toBe(5000)
  })

  it('ranks by ISK/h × demand: a lean high-demand item beats a fat-margin one nobody buys', () => {
    const rows = rankBestOutputs([
      input({ productTypeId: 1, sellPrice: 1100, materialCost: 100, sellDemand: 1 }), // huge ISK/h, no demand
      input({ productTypeId: 2, sellPrice: 120, materialCost: 100, sellDemand: 5000 }), // modest, big demand
    ])
    expect(rows.map((r) => r.productTypeId)).toEqual([2, 1])
  })

  it('leaves ISK/h and score null when build time is unknown', () => {
    const [row] = rankBestOutputs([input({ productTypeId: 1, buildTimeSeconds: null })])
    expect(row!.iskPerHour).toBeNull()
    expect(row!.opportunityScore).toBeNull()
  })

  it('marks a row unreliable and sinks it when there is no sell price', () => {
    const rows = rankBestOutputs([
      input({ productTypeId: 1, sellPrice: 200, materialCost: 100 }), // reliable, scored
      input({ productTypeId: 2, sellPrice: 0, anyNoPrice: true }), // no price -> unreliable
    ])
    expect(rows[0]!.productTypeId).toBe(1)
    expect(rows[1]!.reliable).toBe(false)
    expect(rows[1]!.opportunityScore).toBeNull()
  })

  it('passes a money-losing build through with negative ISK/h (does not hide it)', () => {
    const [row] = rankBestOutputs([input({ productTypeId: 1, sellPrice: 80, materialCost: 100 })])
    expect(row!.unitProfit).toBe(-20)
    expect(row!.iskPerHour).toBe(-20) // -20 per job over 1h
    expect(row!.opportunityScore).toBe(-2000)
  })
})
