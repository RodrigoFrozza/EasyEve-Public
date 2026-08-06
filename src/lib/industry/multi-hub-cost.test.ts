import { computeMultiHubCost, type HubDepthSet } from '@/lib/industry/multi-hub-cost'
import type { MarketDepth } from '@/lib/market-prices'

function depth(sell: Array<[number, number]>, buy: Array<[number, number]> = [], updatedAt = Date.now()): MarketDepth {
  return {
    sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    buy: buy.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    updatedAt,
  }
}

function hub(hubId: string, depthByType: Record<number, MarketDepth>): HubDepthSet {
  return { hubId, hubName: hubId, depth: depthByType }
}

const output = { typeId: 587, name: 'Rifter', baseQuantity: 1 }

describe('computeMultiHubCost', () => {
  it('picks the cheapest hub per material and sums those into the total', () => {
    const result = computeMultiHubCost({
      materials: [
        { typeId: 34, name: 'Tritanium', baseQuantity: 100 },
        { typeId: 35, name: 'Pyerite', baseQuantity: 50 },
      ],
      runs: 1,
      me: 0,
      owned: {},
      buyHubs: [
        hub('jita', { 34: depth([[5, 1000]]), 35: depth([[12, 1000]]) }),
        hub('amarr', { 34: depth([[6, 1000]]), 35: depth([[10, 1000]]) }),
      ],
      output,
      sellDepth: depth([[1000, 10]], [[900, 10]]),
    })

    const trit = result.materials.find((m) => m.typeId === 34)!
    expect(trit.cheapestHubId).toBe('jita') // 5 < 6
    expect(trit.buyCost).toBe(100 * 5)

    const pye = result.materials.find((m) => m.typeId === 35)!
    expect(pye.cheapestHubId).toBe('amarr') // 10 < 12
    expect(pye.buyCost).toBe(50 * 10)

    // Best-case (buy each where cheapest): 500 + 500 = 1000
    expect(result.totalMaterialCost).toBe(1000)
  })

  it('reports a per-hub total for buying everything at one hub', () => {
    const result = computeMultiHubCost({
      materials: [
        { typeId: 34, name: 'Tritanium', baseQuantity: 100 },
        { typeId: 35, name: 'Pyerite', baseQuantity: 50 },
      ],
      runs: 1,
      me: 0,
      owned: {},
      buyHubs: [
        hub('jita', { 34: depth([[5, 1000]]), 35: depth([[12, 1000]]) }),
        hub('amarr', { 34: depth([[6, 1000]]), 35: depth([[10, 1000]]) }),
      ],
      output,
      sellDepth: depth([[1000, 10]]),
    })
    const jita = result.hubTotals.find((h) => h.hubId === 'jita')!
    const amarr = result.hubTotals.find((h) => h.hubId === 'amarr')!
    expect(jita.total).toBe(100 * 5 + 50 * 12) // 1100
    expect(amarr.total).toBe(100 * 6 + 50 * 10) // 1100
  })

  it('skips hubs with no orders for a material when choosing the cheapest', () => {
    const result = computeMultiHubCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      buyHubs: [
        hub('jita', { 34: depth([]) }), // no orders
        hub('amarr', { 34: depth([[6, 1000]]) }),
      ],
      output,
      sellDepth: depth([[1000, 10]]),
    })
    const trit = result.materials[0]!
    expect(trit.cheapestHubId).toBe('amarr')
    expect(trit.quotes.find((q) => q.hubId === 'jita')!.noOrders).toBe(true)
    const jita = result.hubTotals.find((h) => h.hubId === 'jita')!
    expect(jita.anyMissing).toBe(true)
  })

  it('flags anyNoPrice when no hub can supply a material', () => {
    const result = computeMultiHubCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      buyHubs: [hub('jita', { 34: depth([]) }), hub('amarr', { 34: depth([]) })],
      output,
      sellDepth: depth([[1000, 10]]),
    })
    expect(result.materials[0]!.cheapestHubId).toBeNull()
    expect(result.anyNoPrice).toBe(true)
  })

  it('subtracts owned quantity before pricing', () => {
    const result = computeMultiHubCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 10, // needs 1000
      me: 0,
      owned: { 34: 600 },
      buyHubs: [hub('jita', { 34: depth([[5, 100000]]) })],
      output,
      sellDepth: depth([[1000, 10]]),
    })
    const trit = result.materials[0]!
    expect(trit.toBuy).toBe(400)
    expect(trit.buyCost).toBe(400 * 5)
  })

  it('computes profit against listed revenue at the sell hub', () => {
    const result = computeMultiHubCost({
      materials: [{ typeId: 34, name: 'Tritanium', baseQuantity: 100 }],
      runs: 1,
      me: 0,
      owned: {},
      buyHubs: [hub('jita', { 34: depth([[10, 1000]]) })], // cost 1000
      output,
      sellDepth: depth([[1500, 10]], [[1200, 10]]),
    })
    expect(result.totalMaterialCost).toBe(1000)
    expect(result.revenueListed).toBe(1500)
    expect(result.profit).toBe(500)
    expect(result.margin).toBe(0.5)
  })
})
