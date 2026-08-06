import { buildRecipeNode, type RecipeNodeInput } from '@/lib/industry/recipe-node'
import type { MarketDepth } from '@/lib/market-prices'

function depth(sell: Array<[number, number]>): MarketDepth {
  return { sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })), buy: [], updatedAt: Date.now() }
}

const input: RecipeNodeInput = {
  productTypeId: 100,
  productName: 'Widget',
  outputPerRun: 1,
  materials: [
    { typeId: 34, name: 'Tritanium', baseQuantity: 100 },
    { typeId: 35, name: 'Pyerite', baseQuantity: 50 },
  ],
}

describe('buildRecipeNode', () => {
  it('prices materials and compares make vs buy', () => {
    const node = buildRecipeNode({
      input,
      quantity: 1,
      me: 0,
      buyDepth: {
        34: depth([[5, 1000]]), // 100 × 5 = 500
        35: depth([[10, 1000]]), // 50 × 10 = 500
        100: depth([[2000, 10]]), // finished Widget costs 2000
      },
      manufacturable: new Set(),
    })
    expect(node.makeCost).toBe(1000) // 500 + 500
    expect(node.buyCost).toBe(2000)
    expect(node.buildVsBuy).toBe('make') // 1000 < 2000
    expect(node.materials.map((m) => m.buyCost)).toEqual([500, 500])
  })

  it('says buy when materials cost more than the finished item', () => {
    const node = buildRecipeNode({
      input,
      quantity: 1,
      me: 0,
      buyDepth: { 34: depth([[50, 1000]]), 35: depth([[50, 1000]]), 100: depth([[1000, 10]]) },
      manufacturable: new Set(),
    })
    expect(node.makeCost).toBe(100 * 50 + 50 * 50) // 7500
    expect(node.buyCost).toBe(1000)
    expect(node.buildVsBuy).toBe('buy')
  })

  it('scales materials by runs needed for the requested quantity', () => {
    const node = buildRecipeNode({
      input: { ...input, outputPerRun: 10 }, // 10 per run
      quantity: 25, // needs 3 runs
      me: 0,
      buyDepth: { 34: depth([[1, 1_000_000]]), 35: depth([[1, 1_000_000]]), 100: depth([]) },
      manufacturable: new Set(),
    })
    expect(node.runs).toBe(3) // ceil(25 / 10)
    expect(node.materials.find((m) => m.typeId === 34)!.quantity).toBe(300) // 100 × 3 runs, ME 0
  })

  it('marks which materials are manufacturable (expandable)', () => {
    const node = buildRecipeNode({
      input,
      quantity: 1,
      me: 0,
      buyDepth: { 34: depth([[5, 1000]]), 35: depth([[10, 1000]]), 100: depth([[2000, 10]]) },
      manufacturable: new Set([35]),
    })
    expect(node.materials.find((m) => m.typeId === 34)!.manufacturable).toBe(false)
    expect(node.materials.find((m) => m.typeId === 35)!.manufacturable).toBe(true)
  })

  it('flags no orders and stays neutral when the finished item has no market', () => {
    const node = buildRecipeNode({
      input,
      quantity: 1,
      me: 0,
      buyDepth: { 34: depth([[5, 1000]]), 35: depth([[10, 1000]]), 100: depth([]) },
      manufacturable: new Set(),
    })
    expect(node.buyNoOrders).toBe(true)
    expect(node.buildVsBuy).toBe('neutral') // can't compare without a buy price
  })
})
