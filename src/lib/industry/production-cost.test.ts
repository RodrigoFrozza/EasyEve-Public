import { requiredMaterialQuantity, computeProductionCost } from '@/lib/industry/production-cost'
import type { MarketDepth } from '@/lib/market-prices'

function depth(sell: Array<[number, number]>, buy: Array<[number, number]> = [], updatedAt = Date.now()): MarketDepth {
  return {
    sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    buy: buy.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    updatedAt,
  }
}

describe('requiredMaterialQuantity (EVE ME formula)', () => {
  it('ME 0 is the base quantity times runs', () => {
    expect(requiredMaterialQuantity(100, 1, 0)).toBe(100)
    expect(requiredMaterialQuantity(100, 10, 0)).toBe(1000)
  })

  it('applies ME reduction to the whole job and rounds up', () => {
    // 100 × 10 runs × 0.9 = 900
    expect(requiredMaterialQuantity(100, 10, 10)).toBe(900)
    // 14.4 → documented example: 16 base @ ME10, 10 runs = 144 → 144 (exact)
    // single job: 16 × 1 × 0.9 = 14.4 → round(14.4,2)=14.4 → ceil = 15
    expect(requiredMaterialQuantity(16, 1, 10)).toBe(15)
  })

  it('never reduces a 1-per-run material below runs', () => {
    // 1 × 10 × 0.9 = 9 → ceil 9, but max(runs=10, 9) = 10
    expect(requiredMaterialQuantity(1, 10, 10)).toBe(10)
    expect(requiredMaterialQuantity(1, 1, 10)).toBe(1)
  })

  it('clamps ME to the 0–10 research range', () => {
    expect(requiredMaterialQuantity(100, 1, 999)).toBe(90) // treated as ME 10
    expect(requiredMaterialQuantity(100, 1, -5)).toBe(100) // treated as ME 0
  })
})

describe('computeProductionCost', () => {
  const materials = [
    { typeId: 34, name: 'Tritanium', baseQuantity: 100 },
    { typeId: 35, name: 'Pyerite', baseQuantity: 50 },
  ]
  const output = { typeId: 587, name: 'Rifter', baseQuantity: 1 }

  it('buys only what is not owned, walking the sell book for cost', () => {
    const result = computeProductionCost({
      materials,
      runs: 10,
      me: 0,
      owned: { 34: 400 }, // has 400 of the 1000 Tritanium needed
      materialDepth: {
        34: depth([[5, 100000]]),
        35: depth([[10, 100000]]),
      },
      output: { ...output, baseQuantity: 1 },
      outputDepth: depth([[600000, 10]], [[500000, 10]]),
    })

    const trit = result.materials.find((m) => m.typeId === 34)!
    expect(trit.requiredQuantity).toBe(1000)
    expect(trit.toBuy).toBe(600) // 1000 - 400 owned
    expect(trit.buyCost).toBe(600 * 5)

    const pye = result.materials.find((m) => m.typeId === 35)!
    expect(pye.toBuy).toBe(500) // 50 × 10, none owned
    expect(pye.buyCost).toBe(500 * 10)

    expect(result.totalMaterialCost).toBe(600 * 5 + 500 * 10) // 8000
    expect(result.outputQuantity).toBe(10) // 1 × 10 runs
    expect(result.revenueListed).toBe(600000 * 10) // best ask × qty
    expect(result.revenueImmediate).toBe(500000 * 10) // best bid × qty
    expect(result.profit).toBe(600000 * 10 - 8000)
  })

  it('computes margin as profit over material cost', () => {
    const result = computeProductionCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      materialDepth: { 34: depth([[10, 1000]]) }, // cost 100 × 10 = 1000
      output,
      outputDepth: depth([[1500, 10]], [[1200, 10]]), // listed revenue 1500
    })
    expect(result.totalMaterialCost).toBe(1000)
    expect(result.revenueListed).toBe(1500)
    expect(result.profit).toBe(500)
    expect(result.margin).toBe(0.5) // 500 / 1000
  })

  it('flags a thin material book and only counts what filled', () => {
    const result = computeProductionCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      materialDepth: { 34: depth([[10, 30]]) }, // need 100, only 30 on the book
      output,
      outputDepth: depth([[1500, 10]]),
    })
    const trit = result.materials[0]!
    expect(trit.priceSufficient).toBe(false)
    expect(trit.buyCost).toBe(30 * 10) // only the 30 it could fill
    expect(result.anyThin).toBe(true)
  })

  it('flags a material with no orders instead of a false zero cost', () => {
    const result = computeProductionCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      materialDepth: { 34: depth([]) },
      output,
      outputDepth: depth([[1500, 10]]),
    })
    expect(result.materials[0]!.noOrders).toBe(true)
    expect(result.anyNoPrice).toBe(true)
  })

  it('flags a stale snapshot', () => {
    const result = computeProductionCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      materialDepth: { 34: depth([[10, 1000]], [], Date.now() - 25 * 60 * 1000) },
      output,
      outputDepth: depth([[1500, 10]]),
    })
    expect(result.anyStale).toBe(true)
  })
})
