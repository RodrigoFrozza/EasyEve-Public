import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const TRACKED_TYPES = ['mining', 'ratting', 'abyssal', 'exploration', 'salvaging'] as const
const STUCK_ACTIVE_RUN_MS = 25 * 60 * 1000

type AbyssalRunRow = {
  status?: string
  startTime?: string
  registrationStatus?: string
}

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
        data: true,
      },
      take: 1200,
      orderBy: { startTime: 'desc' },
    })

    const now = Date.now()
    const byType = TRACKED_TYPES.map((type) => {
      const items = rows.filter((row) => row.type === type)
      const active = items.filter((row) => row.status === 'active')
      const completed = items.filter((row) => row.status === 'completed')
      const staleActive = active.filter(
        (row) => now - new Date(row.updatedAt).getTime() > 15 * 60 * 1000
      ).length

      let pendingRuns = 0
      let stuckActiveRuns = 0

      if (type === 'abyssal') {
        for (const item of items) {
          const runs = ((item.data as Record<string, unknown>)?.runs as AbyssalRunRow[]) || []
          pendingRuns += runs.filter((run) => run.registrationStatus === 'pending').length
          stuckActiveRuns += runs.filter((run) => {
            if (run.status !== 'active' || !run.startTime) return false
            return now - new Date(run.startTime).getTime() > STUCK_ACTIVE_RUN_MS
          }).length
        }
      }

      return {
        type,
        total: items.length,
        active: active.length,
        completed: completed.length,
        staleActive,
        ...(type === 'abyssal' ? { pendingRuns, stuckActiveRuns } : {}),
      }
    })

    return {
      totalTracked: rows.length,
      byType,
      generatedAt: new Date().toISOString(),
    }
  })
)
