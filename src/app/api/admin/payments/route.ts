export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/payments - List all payments with pagination and search
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limitParam = parseInt(searchParams.get('limit') || '50', 10)
  const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 50
  const skip = (page - 1) * limit

  const where = search ? {
    OR: [
      { payerCharacterName: { contains: search, mode: 'insensitive' as Prisma.QueryMode } },
      { user: { accountCode: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } },
      { user: { name: { contains: search, mode: 'insensitive' as Prisma.QueryMode } } }
    ]
  } : {}

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { status: 'asc' }, // pending before approved
        { createdAt: 'desc' }
      ],
      include: {
        user: {
          select: {
            name: true,
            accountCode: true
          }
        }
      }
    }),
    prisma.payment.count({ where })
  ])

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      hasMore: total > skip + items.length,
      pages: Math.max(1, Math.ceil(total / limit)),
    }
  }
}))
