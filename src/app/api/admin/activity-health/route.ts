import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const TRACKED_TYPES = ['mining', 'ratting', 'abyssal', 'exploration'] as const

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    const rows = await prisma.activity.findMany({
      where: { isDeleted: false, type: { in: [...TRACKED_TYPES] } },
      select: {
        id: true,
        type: true,
        status: true,
        startTime: true,
        updatedAt: true,
      },
      take: 1200,
      orderBy: { startTime: 'desc' },
    })

    const now = Date.now()
    const byType = TRACKED_TYPES.map((type) => {
      const items = rows.filter((row) => row.type === type)
      const active = items.filter((row) => row.status === 'active')
      const completed = items.filter((row) => row.status === 'completed')
      const staleActive = active.filter((row) => now - new Date(row.updatedAt).getTime() > 15 * 60 * 1000).length

      return {
        type,
        total: items.length,
        active: active.length,
        completed: completed.length,
        staleActive,
      }
    })

    return {
      totalTracked: rows.length,
      byType,
      generatedAt: new Date().toISOString(),
    }
  })
)
