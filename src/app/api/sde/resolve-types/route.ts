import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveTypeNames } from '@/lib/sde'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { typeIds, names: nameList } = body as { typeIds?: number[]; names?: string[] }

    if (Array.isArray(nameList) && nameList.length > 0) {
      const cleaned = [...new Set(nameList.map((n) => `${n}`.trim()).filter(Boolean))].slice(0, 120)
      if (cleaned.length === 0) {
        return NextResponse.json({})
      }
      const rows = await prisma.eveType.findMany({
        where: {
          published: true,
          OR: cleaned.map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })),
        },
        select: { id: true, name: true },
      })
      const byLower = new Map<string, { id: number; name: string }>()
      for (const r of rows) {
        byLower.set(r.name.toLowerCase(), { id: r.id, name: r.name })
      }
      const out: Record<string, { id: number; name: string }> = {}
      for (const n of cleaned) {
        const hit = byLower.get(n.toLowerCase())
        if (hit) out[n] = hit
      }
      return NextResponse.json(out)
    }

    if (!typeIds || !Array.isArray(typeIds)) {
      return NextResponse.json({ error: 'typeIds or names array required' }, { status: 400 })
    }

    const names = await resolveTypeNames(typeIds)
    return NextResponse.json(names)
  } catch (error) {
    console.error('Error resolving type names:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
