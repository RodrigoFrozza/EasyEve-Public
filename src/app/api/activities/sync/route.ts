import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { syncRattingWalletForActivity } from '@/lib/activities/ratting-wallet-sync'
import { syncRattingLootForActivity } from '@/lib/activities/ratting-loot-sync'

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

  switch (syncType) {
    case 'loot':
      return syncRattingLootForActivity(activity)
    case 'wallet':
    default:
      return syncRattingWalletForActivity(activity)
  }
})
