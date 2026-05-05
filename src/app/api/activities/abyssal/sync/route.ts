import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { syncAbyssalActivity } from '@/lib/activities/abyssal-sync'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')
  if (!activityId) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Activity ID is required', 400)
  }

  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      userId: user.id,
      type: 'abyssal',
    },
  })
  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Abyssal activity not found', 404)
  }

  return syncAbyssalActivity(activity)
})
