import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

export interface PiReferencePriceView {
  typeId: number
  price: number
  source: string | null
  confidence: string | null
  updatedAt: string
}

/**
 * Load a user's manual reference prices as a typeId→price map, used as a final
 * fallback when no live market order exists for a commodity. Returns {} on error
 * so pricing never breaks.
 */
export async function loadReferencePrices(
  userId: string,
  typeIds?: number[]
): Promise<Record<number, number>> {
  try {
    const rows = await prisma.piReferencePrice.findMany({
      where: {
        userId,
        ...(typeIds && typeIds.length > 0 ? { typeId: { in: typeIds } } : {}),
      },
      select: { typeId: true, price: true },
    })
    const map: Record<number, number> = {}
    for (const r of rows) if (r.price > 0) map[r.typeId] = r.price
    return map
  } catch (error) {
    logger.warn('PI_REFERENCE_PRICE', `Failed to load reference prices for ${userId}`, error)
    return {}
  }
}

export async function listReferencePrices(userId: string): Promise<PiReferencePriceView[]> {
  const rows = await prisma.piReferencePrice.findMany({
    where: { userId },
    orderBy: { typeId: 'asc' },
  })
  return rows.map((r) => ({
    typeId: r.typeId,
    price: r.price,
    source: r.source,
    confidence: r.confidence,
    updatedAt: r.updatedAt.toISOString(),
  }))
}

export async function upsertReferencePrice(
  userId: string,
  typeId: number,
  price: number,
  source?: string | null,
  confidence?: string | null
): Promise<void> {
  await prisma.piReferencePrice.upsert({
    where: { userId_typeId: { userId, typeId } },
    create: { userId, typeId, price, source: source ?? null, confidence: confidence ?? null },
    update: { price, source: source ?? null, confidence: confidence ?? null },
  })
}

export async function deleteReferencePrice(userId: string, typeId: number): Promise<void> {
  await prisma.piReferencePrice.deleteMany({ where: { userId, typeId } })
}
