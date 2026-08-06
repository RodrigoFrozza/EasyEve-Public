export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

/**
 * POST /api/account/data/import - Import user data from a previously exported JSON
 */
export const POST = withErrorHandling(withAuth(async (request, user) => {
  const body = await request.json()
  if (!body.data || (!body.data.activities && !body.data.fits)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid data format', 400)
  }

  const { activities = [], fits = [] } = body.data
  const BATCH_SIZE = 100

  // Use transaction for atomic import
  await prisma.$transaction(async (tx) => {
    // Import activities in batches
    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE)
      const activitiesToCreate = batch.map((a: any) => {
        const { id, userId, createdAt, updatedAt, ...rest } = a
        return {
          ...rest,
          userId: user.id,
          startTime: rest.startTime ? new Date(rest.startTime) : new Date(),
          endTime: rest.endTime ? new Date(rest.endTime) : undefined,
        }
      })
      await tx.activity.createMany({ data: activitiesToCreate })
    }

    // Import fits in batches
    for (let i = 0; i < fits.length; i += BATCH_SIZE) {
      const batch = fits.slice(i, i + BATCH_SIZE)
      const fitsToCreate = batch.map((f: any) => {
        const { id, userId, createdAt, updatedAt, ...rest } = f
        return {
          ...rest,
          userId: user.id
        }
      })
      await tx.fit.createMany({ data: fitsToCreate })
    }
  })

  logger.info('DataImport', `User ${user.id} imported data`, {
    activitiesImported: activities.length,
    fitsImported: fits.length,
  })

  return { 
    success: true, 
    imported: { activities: activities.length, fits: fits.length }
  }
}))
