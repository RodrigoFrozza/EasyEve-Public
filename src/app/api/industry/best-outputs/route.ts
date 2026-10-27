export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getManufacturingRecipesForTypes } from '@/lib/industry/get-blueprint'
import { computeProductionCost } from '@/lib/industry/production-cost'
import { localBuildTimeSeconds } from '@/lib/industry/build-time'
import { resolveHubDepth } from '@/lib/industry/market-depth'
import { loadIndustryConfig } from '@/lib/industry/config-store'
import { getOwnedBlueprintProducts } from '@/lib/industry/owned-products'
import { rankBestOutputs, type BestOutputRowInput } from '@/lib/industry/best-outputs'

// Owned blueprint sets are bounded, but cap defensively so a huge collection
// can't blow up the material fan-out.
const MAX_PRODUCTS = 120

/**
 * "Best outputs": rank the items the user can build from their OWNED blueprints
 * (real ME/TE) by net ISK/h × sell-hub demand. Batch-priced like the deficit
 * scanner — one buy-hub depth for materials + one sell-hub depth for outputs, so
 * ESI cost stays bounded regardless of how many blueprints are owned. v1 costs
 * materials only; the per-item calculator (opened from a row) adds job cost,
 * taxes and skills.
 */
export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const config = await loadIndustryConfig(user.id)
  const characterIds = user.characters.map((c) => c.id)

  // Dedupe by product (best ME/TE wins if two blueprints make the same item).
  const owned = await getOwnedBlueprintProducts(user.id)
  const byProduct = new Map<number, { bestMe: number; bestTe: number }>()
  for (const o of owned) {
    const cur = byProduct.get(o.productTypeId)
    if (!cur) byProduct.set(o.productTypeId, { bestMe: o.bestMe, bestTe: o.bestTe })
    else {
      cur.bestMe = Math.max(cur.bestMe, o.bestMe)
      cur.bestTe = Math.max(cur.bestTe, o.bestTe)
    }
  }
  const productTypeIds = [...byProduct.keys()].slice(0, MAX_PRODUCTS)

  if (productTypeIds.length === 0) {
    return NextResponse.json({ rows: [], needsBlueprints: true })
  }

  const recipes = await getManufacturingRecipesForTypes(productTypeIds)
  const recipeByProduct = new Map(recipes.map((r) => [r.product.typeId, r]))
  const materialTypeIds = [...new Set(recipes.flatMap((r) => r.materials.map((m) => m.typeId)))]

  const buyHub = config.buyHubs[0]!
  const sellHub = config.sellHub ?? buyHub

  const [buyDepth, sellResolved] = await Promise.all([
    resolveHubDepth(buyHub, characterIds, materialTypeIds),
    resolveHubDepth(sellHub, characterIds, productTypeIds),
  ])

  const inputs: BestOutputRowInput[] = []
  for (const productTypeId of productTypeIds) {
    const recipe = recipeByProduct.get(productTypeId)
    if (!recipe) continue
    const best = byProduct.get(productTypeId)!

    const cost = computeProductionCost({
      materials: recipe.materials,
      runs: 1,
      me: best.bestMe,
      owned: {},
      materialDepth: buyDepth.depth,
      output: recipe.product,
      outputDepth: undefined,
    })

    const outputPerRun = Math.max(1, recipe.product.baseQuantity)
    const materialCost = cost.totalMaterialCost / outputPerRun

    // Sell valuation at the configured sell hub: listed sell price (fall back to
    // best buy when nothing is listed), and demand = total buy-order volume there.
    const sellDepth = sellResolved.depth[productTypeId]
    const sellPrice = sellDepth?.sell[0]?.price ?? sellDepth?.buy[0]?.price ?? 0
    const sellDemand = (sellDepth?.buy ?? []).reduce((sum, level) => sum + level.volume, 0)

    // Local base time × real owned TE (no structure/skill bonus — labeled).
    const buildTimeSeconds = localBuildTimeSeconds(recipe.baseTimeSeconds, 1, best.bestTe)

    inputs.push({
      productTypeId,
      productName: recipe.product.name,
      bestMe: best.bestMe,
      bestTe: best.bestTe,
      materialCost,
      sellPrice,
      buildTimeSeconds,
      outputPerRun,
      sellDemand,
      anyThin: cost.anyThin,
      anyNoPrice: cost.anyNoPrice,
      anyStale: cost.anyStale,
    })
  }

  return NextResponse.json({
    rows: rankBestOutputs(inputs),
    buyLabel: buyHub.name,
    sellLabel: sellResolved.hubName,
  })
})
