import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getFactionAliasesForFilter,
  getGroupAliasesForClassFilter,
  normalizeShipFactionId,
  resolveShipClassId,
  type ShipClassId,
  type ShipFactionId,
} from '@/lib/ships/ship-taxonomy'

export const dynamic = 'force-dynamic'

// === CACHE ===
let shipsCache: { data: { ships: unknown[]; total: number }; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 min

/**
 * GET /api/ships - List available ships
 * Query params:
 *   - search: search by name
 *   - factionId: canonical faction id
 *   - groupId: market group id for ships
 *   - classId: canonical class id
 *   - limit: max rows
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const factionParam = (searchParams.get('factionId') ?? searchParams.get('faction') ?? 'all') as ShipFactionId
    const groupIdRaw = searchParams.get('groupId')
    const groupIdParam = groupIdRaw ? Number.parseInt(groupIdRaw, 10) : null
    const classParam = (searchParams.get('classId') ?? 'all') as ShipClassId
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '1000', 10), 5000)
    
    // Check cache for first page without filters
    const now = Date.now()
    if (!search && factionParam === 'all' && classParam === 'all' && groupIdParam == null && shipsCache && (now - shipsCache.timestamp < CACHE_TTL)) {
      return NextResponse.json(shipsCache.data)
    }

    // Build where clause for ShipStats
    const whereClauses: Array<Record<string, unknown>> = []
    if (search) {
      whereClauses.push({
        name: { contains: search, mode: 'insensitive' },
      })
    }

    if (factionParam !== 'all') {
      const aliases = getFactionAliasesForFilter(factionParam)
      if (aliases.length > 0) {
        whereClauses.push({
          OR: aliases.map((alias) => ({
            factionName: { equals: alias, mode: 'insensitive' },
          })),
        })
      }
    }

    if (groupIdParam != null && Number.isFinite(groupIdParam)) {
      whereClauses.push({
        groupId: groupIdParam,
      })
    } else if (classParam !== 'all') {
      const groupAliases = getGroupAliasesForClassFilter(classParam)
      if (groupAliases.length > 0) {
        whereClauses.push({
          OR: groupAliases.map((groupName) => ({
            groupName: { equals: groupName, mode: 'insensitive' },
          })),
        })
      }
    }

    const ships = await prisma.shipStats.findMany({
      where: whereClauses.length > 0 ? { AND: whereClauses } : {},
      select: {
        typeId: true,
        name: true,
        factionName: true,
        groupName: true,
        groupId: true,
      },
      orderBy: [{ name: 'asc' }, { typeId: 'asc' }],
      take: limit,
    })

    const shipsFormatted = ships.map(s => ({
      id: s.typeId,
      name: s.name,
      faction: s.factionName,
      groupName: s.groupName || 'Unknown',
      groupId: s.groupId,
      factionId: normalizeShipFactionId(s.factionName),
      classId: resolveShipClassId(s.groupName),
    }))

    const response = {
      ships: shipsFormatted,
      total: shipsFormatted.length
    }
    
    // Cache if it's the full list
    if (!search && factionParam === 'all' && classParam === 'all' && groupIdParam == null) {
      shipsCache = { data: response, timestamp: now }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('GET /api/ships error:', error)
    return NextResponse.json({ error: 'Failed to fetch ships' }, { status: 500 })
  }
}