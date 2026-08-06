import { prisma } from '@/lib/prisma'

export type ProductionActivity = 'manufacturing' | 'reaction'

export interface ProductionRecipe {
  blueprintTypeId: number
  activity: ProductionActivity
  product: { typeId: number; name: string; baseQuantity: number }
  materials: { typeId: number; name: string; baseQuantity: number }[]
  /**
   * Base per-run job time in seconds (SDE, at ME0/TE0, no structure/skill bonus).
   * Null when the SDE row has no time for this activity. Feeds the local
   * build-time fallback (see build-time.ts) — the preferred time comes from EVE
   * Ref, already bonus-adjusted.
   */
  baseTimeSeconds: number | null
}

/** Kept for existing imports — identical shape to ProductionRecipe. */
export type ManufacturingRecipe = ProductionRecipe

const MANUFACTURING = 'manufacturing'
const REACTION = 'reaction'

/**
 * The production recipe (of a single given activity) that produces
 * `productTypeId`: which blueprint/formula makes it, its per-run output
 * quantity, and the input materials (ME-0 base quantities, activity-filtered)
 * with resolved names. Null when nothing with this activity produces this type.
 */
async function resolveRecipe(
  productTypeId: number,
  activity: ProductionActivity
): Promise<ProductionRecipe | null> {
  if (!Number.isInteger(productTypeId) || productTypeId <= 0) return null

  const product = await prisma.blueprintProduct.findFirst({
    where: { typeId: productTypeId, activity },
    select: { blueprintTypeId: true, quantity: true },
  })
  if (!product) return null

  const [materialRows, blueprint] = await Promise.all([
    prisma.blueprintMaterial.findMany({
      where: { blueprintTypeId: product.blueprintTypeId, activity },
      select: { typeId: true, quantity: true },
    }),
    prisma.blueprint.findUnique({
      where: { blueprintTypeId: product.blueprintTypeId },
      select: { manufacturingTime: true, reactionTime: true },
    }),
  ])

  // One name lookup for the product + every material.
  const typeIds = [productTypeId, ...materialRows.map((m) => m.typeId)]
  const names = await prisma.eveType.findMany({
    where: { id: { in: typeIds } },
    select: { id: true, name: true },
  })
  const nameById = new Map(names.map((n) => [n.id, n.name]))

  return {
    blueprintTypeId: product.blueprintTypeId,
    activity,
    product: {
      typeId: productTypeId,
      name: nameById.get(productTypeId) ?? `Type ${productTypeId}`,
      baseQuantity: product.quantity,
    },
    materials: materialRows.map((m) => ({
      typeId: m.typeId,
      name: nameById.get(m.typeId) ?? `Type ${m.typeId}`,
      baseQuantity: m.quantity,
    })),
    baseTimeSeconds:
      (activity === MANUFACTURING ? blueprint?.manufacturingTime : blueprint?.reactionTime) ?? null,
  }
}

/**
 * The manufacturing recipe that produces `productTypeId`. Null when nothing
 * manufactures this type — the catalogue must be populated first (Admin Script
 * `sync-blueprints`). Unchanged behavior; existing callers keep working.
 */
export async function getManufacturingRecipe(productTypeId: number): Promise<ManufacturingRecipe | null> {
  return resolveRecipe(productTypeId, MANUFACTURING)
}

/**
 * Production recipe for `productTypeId`, manufacturing-first: look up a
 * manufacturing blueprint first (preserves today's behavior for anything
 * producible both ways — a deliberate, documented choice, not an assumption),
 * and only fall back to a reaction formula when no manufacturing blueprint
 * exists. Null when neither activity produces this type.
 */
export async function getProductionRecipe(productTypeId: number): Promise<ProductionRecipe | null> {
  const manufacturing = await resolveRecipe(productTypeId, MANUFACTURING)
  if (manufacturing) return manufacturing
  return resolveRecipe(productTypeId, REACTION)
}

/**
 * Manufacturing recipes for a specific set of product typeIds (e.g. the deficit
 * scanner's candidate items) — the ones with a manufacturing blueprint, with
 * materials + names resolved in a handful of batched queries.
 */
export async function getManufacturingRecipesForTypes(
  productTypeIds: number[]
): Promise<ManufacturingRecipe[]> {
  const ids = [...new Set(productTypeIds)].filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) return []

  const productRows = await prisma.blueprintProduct.findMany({
    where: { typeId: { in: ids }, activity: MANUFACTURING },
    select: { typeId: true, blueprintTypeId: true, quantity: true },
  })
  if (productRows.length === 0) return []

  return buildRecipes(productRows)
}

/** Resolve materials + names for a set of manufacturing product rows (batched). */
async function buildRecipes(
  productRows: { typeId: number; blueprintTypeId: number; quantity: number }[]
): Promise<ManufacturingRecipe[]> {
  const blueprintIds = productRows.map((p) => p.blueprintTypeId)
  const [materialRows, blueprintRows] = await Promise.all([
    prisma.blueprintMaterial.findMany({
      where: { blueprintTypeId: { in: blueprintIds }, activity: MANUFACTURING },
      select: { blueprintTypeId: true, typeId: true, quantity: true },
    }),
    prisma.blueprint.findMany({
      where: { blueprintTypeId: { in: blueprintIds } },
      select: { blueprintTypeId: true, manufacturingTime: true },
    }),
  ])
  const manufacturingTimeByBp = new Map(
    blueprintRows.map((b) => [b.blueprintTypeId, b.manufacturingTime])
  )

  const nameIds = new Set<number>()
  productRows.forEach((p) => nameIds.add(p.typeId))
  materialRows.forEach((m) => nameIds.add(m.typeId))
  const names = await prisma.eveType.findMany({
    where: { id: { in: [...nameIds] } },
    select: { id: true, name: true },
  })
  const nameById = new Map(names.map((n) => [n.id, n.name]))

  const materialsByBp = new Map<number, { typeId: number; name: string; baseQuantity: number }[]>()
  for (const m of materialRows) {
    const list = materialsByBp.get(m.blueprintTypeId) ?? []
    list.push({ typeId: m.typeId, name: nameById.get(m.typeId) ?? `Type ${m.typeId}`, baseQuantity: m.quantity })
    materialsByBp.set(m.blueprintTypeId, list)
  }

  return productRows.map((p) => ({
    blueprintTypeId: p.blueprintTypeId,
    activity: MANUFACTURING as ProductionActivity,
    product: {
      typeId: p.typeId,
      name: nameById.get(p.typeId) ?? `Type ${p.typeId}`,
      baseQuantity: p.quantity,
    },
    materials: materialsByBp.get(p.blueprintTypeId) ?? [],
    baseTimeSeconds: manufacturingTimeByBp.get(p.blueprintTypeId) ?? null,
  }))
}
