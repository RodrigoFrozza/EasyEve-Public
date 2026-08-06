import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { syncRattingWalletForActivity } from '@/lib/activities/ratting-wallet-sync'
import { syncLootForActivity, AUTO_LOOT_SUPPORTED_TYPES } from '@/lib/activities/container-loot-sync'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')
  const syncType = searchParams.get('type') || 'wallet'

  if (!activityId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Activity ID is required', 400)
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, userId: user.id }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  if (activity.isPaused) {
    return activity
  }

  switch (syncType) {
    case 'loot':
      if (!AUTO_LOOT_SUPPORTED_TYPES.includes(activity.type)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Loot sync not supported for ${activity.type}`, 400)
      }
      return syncLootForActivity(activity)
    case 'wallet':
    default:
      if (activity.type !== 'ratting' && activity.type !== 'escalations') {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Wallet sync only supported for ratting and escalations activities',
          400
        )
      }
      return syncRattingWalletForActivity(activity)
  }
})
