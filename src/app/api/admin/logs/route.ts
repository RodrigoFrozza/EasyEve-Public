import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/logs - Fetch recent debug logs with auto-cleanup
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  // Log retention cleanup runs via POST /api/admin/logs/cleanup (scheduler), not on every read.

  const logs = await prisma.debugLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: {
        select: {
          name: true,
          accountCode: true
        }
      }
    }
  })

  return logs
}))
