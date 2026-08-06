export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { logger } from '@/lib/server-logger'

/**
 * POST /api/account/data/delete-all - Atomic deletion of user data (activities, fits)
 */
export const POST = withErrorHandling(withAuth(async (request, user) => {
  // Transaction to ensure atomic deletion
  const [activitiesDeleted, fitsDeleted] = await prisma.$transaction([
    prisma.activity.deleteMany({ where: { userId: user.id } }),
    prisma.fit.deleteMany({ where: { userId: user.id } }),
  ])

  logger.warn('DataDelete', `User ${user.id} deleted all data`, {
    activitiesDeleted: activitiesDeleted.count,
    fitsDeleted: fitsDeleted.count,
  })

  return { success: true, message: 'All data has been deleted' }
}))
