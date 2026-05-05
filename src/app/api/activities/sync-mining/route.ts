import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { runMiningActivitySync } from '@/lib/activities/mining-activity-sync'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')
  const mode = searchParams.get('mode') as 'initial' | 'regular' | null

  if (!activityId) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Activity ID is required', 400)
  }

  return runMiningActivitySync({
    userId: user.id,
    activityId,
    mode,
  })
})
