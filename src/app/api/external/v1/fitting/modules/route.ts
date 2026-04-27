import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'

export const dynamic = 'force-dynamic'

async function getModules(req: Request) {
  const { searchParams } = new URL(req.url)
  const typeId = searchParams.get('typeId')
  const slotType = searchParams.get('slotType')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  const where: any = {}
  if (typeId) where.typeId = parseInt(typeId)
  if (slotType) where.slotType = slotType

  const modules = await prisma.moduleStats.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
    include: {
      dogmaAttributes: searchParams.get('includeAttributes') === 'true'
    }
  })

  const total = await prisma.moduleStats.count({ where })

  return {
    data: modules,
    pagination: {
      total,
      limit,
      offset
    }
  }
}

export const GET = withErrorHandling(withExternalAuth(getModules))
