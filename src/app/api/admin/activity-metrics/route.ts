import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [launchRejected, syncFailed, flagToggles] = await Promise.all([
      prisma.securityEvent.count({
        where: {
          event: 'ACTIVITY_LAUNCH_REJECTED',
          createdAt: { gte: since },
        },
      }),
      prisma.debugLog.count({
        where: {
          level: 'error',
          createdAt: { gte: since },
          OR: [{ message: { contains: 'sync', mode: 'insensitive' } }, { url: { contains: '/api/activities/' } }],
        },
      }),
      prisma.securityEvent.count({
        where: {
          event: 'ADMIN_FEATURE_FLAG_UPDATED',
          createdAt: { gte: since },
        },
      }),
    ])

    return {
      windowHours: 24,
      launchRejected,
      syncFailed,
      flagToggles,
      generatedAt: new Date().toISOString(),
    }
  })
)
