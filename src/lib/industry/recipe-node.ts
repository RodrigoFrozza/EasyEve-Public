import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'
import { requiredMaterialQuantity } from '@/lib/industry/production-cost'

export type BuildVsBuy = 'make' | 'buy' | 'neutral'

export interface RecipeNodeMaterial {
  typeId: number
  name: string
  quantity: number
  /** Cost to buy this quantity at the buy hub (0 if no orders). */
  buyCost: number
  buyUnitPrice: number
  /** Has a manufacturing blueprint → the UI can expand it into its own recipe. */
  manufacturable: boolean
  noOrders: boolean
}

export interface RecipeNodeResult {
  typeId: number
  name: string
  quantity: number
  runs: number
  materials: RecipeNodeMaterial[]
  /** Cost to build `quantity` from materials (sum of material buy costs). */
  makeCost: number
  /** Cost to just buy `quantity` of this item finished at the buy hub. */
  buyCost: number
  buyUnitPrice: number
  buildVsBuy: BuildVsBuy
  buyNoOrders: boolean
}

export interface RecipeNodeInput {
  productTypeId: number
  productName: string
  /** Units of output per manufacturing run (recipe.product.baseQuantity). */
  outputPerRun: number
  materials: { typeId: number; name: string; baseQuantity: number }[]
}

/**
 * One node of the production tree: to make `quantity` of a product, how much its
 * materials cost to buy vs. what the finished product costs to buy — so the UI can
 * say "make" or "buy" at each level, and drill deeper into any manufacturable
 * material. Pure: caller pre-fetches buy-hub depth and which materials are
 * manufacturable. Prices are real order-book walks (regra de ouro).
 */
export function buildRecipeNode(params: {
  input: RecipeNodeInput
  quantity: number
  me: number
  buyDepth: Record<number, MarketDepth>
  manufacturable: Set<number>
}): RecipeNodeResult {
  const { input, buyDepth, manufacturable } = params
  const quantity = Math.max(1, Math.floor(params.quantity))
  const outputPerRun = Math.max(1, input.outputPerRun)
  const runs = Math.ceil(quantity / outputPerRun)

  const materials: RecipeNodeMaterial[] = input.materials.map((m) => {
    const need = requiredMaterialQuantity(m.baseQuantity, runs, params.me)
    const sell = buyDepth[m.typeId]?.sell ?? []
    const fill = fillFromOrders(sell, need)
    return {
      typeId: m.typeId,
      name: m.name,
      quantity: need,
      buyCost: fill.avgUnitPrice * fill.filledQty,
      buyUnitPrice: sell[0]?.price ?? 0,
      manufacturable: manufacturable.has(m.typeId),
      noOrders: sell.length === 0,
    }
  })

  const makeCost = materials.reduce((s, m) => s + m.buyCost, 0)

  // Buying the finished product outright, for the make-vs-buy comparison.
  const productSell = buyDepth[input.productTypeId]?.sell ?? []
  const productFill = fillFromOrders(productSell, quantity)
  const buyCost = productFill.avgUnitPrice * productFill.filledQty
  const buyUnitPrice = productSell[0]?.price ?? 0
  const buyNoOrders = productSell.length === 0

  let buildVsBuy: BuildVsBuy = 'neutral'
  if (makeCost > 0 && buyCost > 0) buildVsBuy = makeCost < buyCost ? 'make' : 'buy'

  return {
    typeId: input.productTypeId,
    name: input.productName,
    quantity,
    runs,
    materials,
    makeCost,
    buyCost,
    buyUnitPrice,
    buildVsBuy,
    buyNoOrders,
  }
}
