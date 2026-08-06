import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const faction = searchParams.get('faction')

  try {
    // We search for types that are likely combat anomalies.
    // Usually these are in specific groups like "Combat Anomaly" (GroupID 666... wait let me check)
    // For now, filtering by name pattern linked to the faction is a robust way to start if we don't have the exact groupIDs yet.
    
    const types = await prisma.eveType.findMany({
      where: {
        AND: [
          faction ? { name: { contains: faction } } : {},
          {
            OR: [
              { name: { contains: 'Hub' } },
              { name: { contains: 'Haven' } },
              { name: { contains: 'Sanctum' } },
              { name: { contains: 'Den' } },
              { name: { contains: 'Refuge' } },
              { name: { contains: 'Forlorn' } },
              { name: { contains: 'Forsaken' } },
              { name: { contains: 'Rally Point' } },
              { name: { contains: 'Patrol' } },
              { name: { contains: 'Horde' } },
              { name: { contains: 'Squad' } },
              { name: { contains: 'Hive' } },
            ]
          },
          { published: true }
        ]
      },
      select: {
        id: true,
        name: true,
        groupId: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(types)
  } catch (error: any) {
    console.error('Error fetching anomalies from SDE:', error)
    if (error && typeof error === 'object') {
      console.error('Prisma Error Details:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      })
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
