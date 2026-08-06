import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/logs - Fetch recent debug logs
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const pageParam = Number(searchParams.get('page') || '1')
  const limitParam = Number(searchParams.get('limit') || '50')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10
  const skip = (page - 1) * limit

  const [total, logs] = await Promise.all([
    prisma.debugLog.count(),
    prisma.debugLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            name: true,
            accountCode: true
          }
        }
      }
    }),
  ])

  return {
    items: logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}))
