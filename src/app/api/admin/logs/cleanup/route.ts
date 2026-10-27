import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

const DEFAULT_RETENTION_DAYS = 7

/**
 * POST /api/admin/logs/cleanup — Remove debug logs older than retention window.
 * Call from a scheduler (e.g. cron) instead of coupling cleanup to GET /api/admin/logs.
 */
export const POST = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request, _user) => {
    let retentionDays = DEFAULT_RETENTION_DAYS
    try {
      const body = await request.json().catch(() => ({}))
      if (typeof body?.retentionDays === 'number' && body.retentionDays >= 1 && body.retentionDays <= 90) {
        retentionDays = body.retentionDays
      }
    } catch {
      // empty body is fine
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)

    const result = await prisma.debugLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    return { deleted: result.count, retentionDays, cutoff: cutoff.toISOString() }
  })
)
