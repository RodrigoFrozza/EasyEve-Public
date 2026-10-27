export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { getProductionRecipe } from '@/lib/industry/get-blueprint'
import { resolveHubDepth } from '@/lib/industry/market-depth'
import { loadIndustryConfig } from '@/lib/industry/config-store'
import { buildRecipeNode } from '@/lib/industry/recipe-node'

/**
 * One node of the production tree: the recipe for `quantity` of `typeId`, priced
 * at the buy hub, with make-vs-buy and which materials are themselves
 * manufacturable (so the UI can expand them). Called lazily as the user drills in.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const body = (await request.json().catch(() => ({}))) as { typeId?: number; quantity?: number }
  const typeId = Number(body.typeId)
  if (!Number.isInteger(typeId) || typeId <= 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'typeId required', 400)
  }
  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1))

  const recipe = await getProductionRecipe(typeId)
  if (!recipe) {
    // Not manufacturable or reaction-producible — a leaf. The caller usually only
    // asks for producible materials, but guard anyway.
    return NextResponse.json({ manufacturable: false })
  }

  const config = await loadIndustryConfig(user.id)
  const characterIds = user.characters.map((c) => c.id)
  const buyHub = config.buyHubs[0]!
  const materialTypeIds = recipe.materials.map((m) => m.typeId)
  const typeIds = [typeId, ...materialTypeIds]
  // Reactions have no Material Efficiency — never apply the configured default ME
  // to a reaction's material quantities.
  const me = recipe.activity === 'reaction' ? 0 : config.defaultMe

  const [buyDepth, manufacturableRows] = await Promise.all([
    resolveHubDepth(buyHub, characterIds, typeIds),
    prisma.blueprintProduct.findMany({
      where: { typeId: { in: materialTypeIds }, activity: { in: ['manufacturing', 'reaction'] } },
      select: { typeId: true },
    }),
  ])

  const node = buildRecipeNode({
    input: {
      productTypeId: typeId,
      productName: recipe.product.name,
      outputPerRun: recipe.product.baseQuantity,
      materials: recipe.materials,
    },
    quantity,
    me,
    buyDepth: buyDepth.depth,
    manufacturable: new Set(manufacturableRows.map((r) => r.typeId)),
  })

  return NextResponse.json({ manufacturable: true, buyLabel: buyHub.name, me, activity: recipe.activity, ...node })
})
