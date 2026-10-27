import { prisma } from '@/lib/prisma'
import { getMarketAppraisal } from '@/lib/market'
import { getTypeName } from '@/lib/esi'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const confirmDeathSchema = z.object({
  activityId: z.string().min(1, 'Activity ID is required'),
  shipTypeId: z.number().min(1, 'Ship Type ID is required'),
  taxAmount: z.number().optional().default(0)
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await validateBody(request, confirmDeathSchema)
  const { activityId, shipTypeId } = body

  const shipName = await getTypeName(shipTypeId)
  const prices = await getMarketAppraisal([shipName])
  const shipValue = prices[shipName.toLowerCase()] || 0

  const progressAt = new Date().toISOString()

  const logEntry = {
    refId: `death-${crypto.randomUUID()}`,
    type: 'death',
    shipName,
    shipValue,
    date: progressAt,
  }

  const result = await prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findUnique({
      where: { id: activityId },
    })

    if (!activity) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
    }

    if (activity.userId !== user.id) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'You do not own this activity', 403)
    }

    const activityData = (activity.data as Record<string, unknown>) || {}
    const totalLost = shipValue + (Number(activityData.currentCargoValue) || 0)

    const updatedData = {
      ...activityData,
      totalLossValue: (Number(activityData.totalLossValue) || 0) + totalLost,
      currentCargoValue: 0,
      lastCargoState: '',
      lastDataAt: progressAt,
      logs: [...((activityData.logs as unknown[]) || []), logEntry],
    }

    const expectedUpdatedAt = activity.updatedAt
    const updateResult = await tx.activity.updateMany({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
      data: { data: updatedData as Prisma.InputJsonValue },
    })

    if (updateResult.count === 0) {
      throw new AppError(
        ErrorCodes.API_CONFLICT,
        'Activity was updated elsewhere; please refresh and try again',
        409
      )
    }

    const updatedActivity = await tx.activity.findUnique({
      where: { id: activityId },
    })

    if (!updatedActivity) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
    }

    return { activity: updatedActivity, lossValue: totalLost }
  })

  return result
})
