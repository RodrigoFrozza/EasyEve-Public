import { prisma } from '@/lib/prisma'
import { syncExplorationActivity } from '@/lib/activities/exploration-sync'
import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')

  if (!activityId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Activity ID is required', 400)
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }
  if (activity.type !== 'exploration') {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Only exploration activities are supported by this endpoint', 400)
  }

  if (activity.userId !== user.id) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'You do not own this activity', 403)
  }

  if (activity.isPaused) {
    return activity
  }

  const updatedActivity = await syncExplorationActivity(activity)
  return updatedActivity
})
