import { prisma } from '@/lib/prisma'
import { getMarketAppraisal } from '@/lib/market'
import { getTypeName } from '@/lib/esi'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
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

  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  if (activity.userId !== user.id) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'You do not own this activity', 403)
  }

  // 1. Get Ship Name and Value
  const shipName = await getTypeName(shipTypeId)
  const prices = await getMarketAppraisal([shipName])
  const shipValue = prices[shipName.toLowerCase()] || 0

  // 2. Prepare the log entry
  const logEntry = {
    type: 'death',
    shipName,
    shipValue,
    date: new Date().toISOString()
  }

  // 3. Update Activity Data
  const activityData = (activity.data as any) || {}
  
  // Total value reflects the loss
  const totalLost = shipValue + (activityData.currentCargoValue || 0)
  
  const updatedData = {
    ...activityData,
    totalLossValue: (activityData.totalLossValue || 0) + totalLost,
    currentCargoValue: 0, // Loot is gone on death
    lastCargoState: '',  // Cargo is empty now
    logs: [...(activityData.logs || []), logEntry]
  }

  const updatedActivity = await prisma.activity.update({
    where: { id: activityId },
    data: { 
      data: updatedData
    }
  })

  return { 
    activity: updatedActivity,
    lossValue: totalLost
  }
})
