import { prisma } from '@/lib/prisma'

export interface OwnedBlueprintProduct {
  /** The item the blueprint manufactures (BlueprintProduct.typeId). */
  productTypeId: number
  /** The blueprint type owned (CharacterBlueprint.typeId == Blueprint.blueprintTypeId). */
  blueprintTypeId: number
  /** Best material efficiency across the owned copies of this blueprint. */
  bestMe: number
  /** Best time efficiency across the owned copies. */
  bestTe: number
}

/**
 * The manufacturable products a user can build from blueprints they actually own,
 * each with the best ME/TE across their owned copies. Drives the "best outputs"
 * (best-to-build) view. Manufacturing only for now (mirrors the deficit scanner);
 * reactions/invention could follow. Empty when no blueprints have been synced yet
 * — the caller shows an explicit "sync your blueprints" state, never a fabricated
 * list.
 */
export async function getOwnedBlueprintProducts(userId: string): Promise<OwnedBlueprintProduct[]> {
  const owned = await prisma.characterBlueprint.findMany({
    where: { character: { userId } },
    select: { typeId: true, materialEfficiency: true, timeEfficiency: true },
  })
  if (owned.length === 0) return []

  // Best ME/TE per owned blueprint type (a user may hold several copies).
  const bestByBp = new Map<number, { bestMe: number; bestTe: number }>()
  for (const bp of owned) {
    const cur = bestByBp.get(bp.typeId)
    if (!cur) {
      bestByBp.set(bp.typeId, { bestMe: bp.materialEfficiency, bestTe: bp.timeEfficiency })
    } else {
      cur.bestMe = Math.max(cur.bestMe, bp.materialEfficiency)
      cur.bestTe = Math.max(cur.bestTe, bp.timeEfficiency)
    }
  }

  const blueprintTypeIds = [...bestByBp.keys()]
  // Map each owned blueprint type to the product it manufactures.
  const products = await prisma.blueprintProduct.findMany({
    where: { blueprintTypeId: { in: blueprintTypeIds }, activity: 'manufacturing' },
    select: { blueprintTypeId: true, typeId: true },
  })

  const result: OwnedBlueprintProduct[] = []
  for (const p of products) {
    const best = bestByBp.get(p.blueprintTypeId)
    if (!best) continue
    result.push({
      productTypeId: p.typeId,
      blueprintTypeId: p.blueprintTypeId,
      bestMe: best.bestMe,
      bestTe: best.bestTe,
    })
  }
  return result
}
