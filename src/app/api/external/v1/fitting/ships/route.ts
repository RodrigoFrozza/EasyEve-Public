import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'

export const dynamic = 'force-dynamic'

async function getShips(req: Request) {
  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  const where = typeId ? { typeId: parseInt(typeId) } : {}

  const ships = await prisma.shipStats.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    include: {
      traits: true,
      // Optionally include dogma attributes if requested
      dogmaAttributes: searchParams.get('includeAttributes') === 'true'
    }
  })

  const total = await prisma.shipStats.count({ where })

  return {
    data: ships,
    pagination: {
      total,
      limit,
      offset
    }
  }
}

export const GET = withErrorHandling(withExternalAuth(getShips))
