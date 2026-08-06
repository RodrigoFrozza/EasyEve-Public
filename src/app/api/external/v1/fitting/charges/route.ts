import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'

export const dynamic = 'force-dynamic'

async function getCharges(req: Request) {
  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  const where = typeId ? { typeId: parseInt(typeId) } : {}

  const charges = await prisma.chargeStats.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' }
  })

  const total = await prisma.chargeStats.count({ where })

  return {
    data: charges,
    pagination: {
      total,
      limit,
      offset
    }
  }
}

export const GET = withErrorHandling(withExternalAuth(getCharges))
