export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_RESULTS = 15

/**
 * Autocomplete for the production-cost calculator: published items matching the
 * query that actually have a manufacturing OR reaction blueprint/formula. Two
 * batched queries (name match, then keep only those with a manufacturing or
 * reaction product) — avoids offering items nothing can build. Many reaction
 * outputs (fuel blocks, composites, advanced moon materials) have no
 * manufacturing blueprint at all and would otherwise be unfindable. Empty until
 * the blueprint catalogue is populated.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ items: [] })

  const candidates = await prisma.eveType.findMany({
    where: { published: true, name: { contains: q, mode: 'insensitive' } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 80,
  })
  if (candidates.length === 0) return NextResponse.json({ items: [] })

  const manufacturable = await prisma.blueprintProduct.findMany({
    where: { typeId: { in: candidates.map((c) => c.id) }, activity: { in: ['manufacturing', 'reaction'] } },
    select: { typeId: true },
  })
  const buildable = new Set(manufacturable.map((m) => m.typeId))

  const items = candidates
    .filter((c) => buildable.has(c.id))
    .slice(0, MAX_RESULTS)
    .map((c) => ({ typeId: c.id, name: c.name }))

  return NextResponse.json({ items })
}
