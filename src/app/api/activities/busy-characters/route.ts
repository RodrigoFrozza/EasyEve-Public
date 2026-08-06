import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

/**
 * Lightweight, type-agnostic list of characterIds busy in any active
 * activity. The main GET /api/activities list is filtered by `type` (the
 * currently-viewed tab), so it can't tell the launch wizard a character is
 * busy in a different activity type — this fills that gap without touching
 * the paginated/typed listing endpoint.
 */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const activeActivities = await prisma.activity.findMany({
    where: { userId: user.id, isDeleted: false, status: 'active' },
    select: { participants: true },
  })

  const characterIds = Array.from(
    new Set(
      activeActivities.flatMap((activity) => {
        const participants = (activity.participants as Array<{ characterId: number }>) || []
        return participants.map((p) => p.characterId)
      })
    )
  )

  return { characterIds }
})
