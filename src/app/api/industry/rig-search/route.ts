export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_RESULTS = 25

/**
 * Search structure Material Efficiency rigs ("Standup M-Set … Material Efficiency")
 * for the factory config. Filtered by the ME-rig name pattern so only rigs that
 * actually reduce materials show up; the optional query narrows by product family
 * (e.g. "small ship", "component"). Read from the SDE, never a hardcoded list.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  const where = {
    published: true,
    AND: [
      { name: { contains: 'Material Efficiency', mode: 'insensitive' as const } },
      { name: { contains: 'Standup', mode: 'insensitive' as const } },
      ...(q ? [{ name: { contains: q, mode: 'insensitive' as const } }] : []),
    ],
  }

  const rigs = await prisma.eveType.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: MAX_RESULTS,
  })
  return NextResponse.json({ rigs: rigs.map((r) => ({ typeId: r.id, name: r.name })) })
}
