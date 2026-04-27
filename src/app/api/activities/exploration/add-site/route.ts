import { prisma } from '@/lib/prisma'
import { getMarketAppraisal } from '@/lib/market'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { z } from 'zod'

const addSiteSchema = z.object({
  activityId: z.string().min(1, 'Activity ID is required'),
  siteName: z.string().min(1, 'Site name is required'),
  spaceType: z.enum(['data', 'relic', 'ghost', 'sleeper', 'superior_ghost']),
  loot: z.array(z.object({
    name: z.string(),
    quantity: z.number().min(1)
  })).min(1, 'At least one loot item is required'),
  fullCargoAfter: z.string().optional()
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await validateBody(request, addSiteSchema)
  const { activityId, loot, siteName, spaceType, fullCargoAfter } = body

  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  if (activity.userId !== user.id) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'You do not own this activity', 403)
  }

  // 1. Appraise the loot and get IDs
  const itemNames = loot.map((item: any) => item.name)
  const { getMarketAppraisalWithIds } = await import('@/lib/market')
  const appraisal = await getMarketAppraisalWithIds(itemNames)
  
  let addedValue = 0
  const processedLoot = loot.map((item: any) => {
    const data = appraisal[item.name.toLowerCase()] || { price: 0, id: 0 }
    const total = data.price * item.quantity
    addedValue += total
    return { ...item, price: data.price, total, typeId: data.id }
  })

  // 2. Prepare the log entry
  const logEntry = {
    type: 'site',
    siteName,
    spaceType,
    value: addedValue,
    items: processedLoot,
    date: new Date().toISOString()
  }

  // 3. Update Activity Data
  const activityData = (activity.data as any) || {}
  const updatedData = {
    ...activityData,
    totalLootValue: (activityData.totalLootValue || 0) + addedValue,
    currentCargoValue: (activityData.currentCargoValue || 0) + addedValue,
    lastCargoState: fullCargoAfter, // Save for next delta
    currentSpaceType: spaceType,
    logs: [...(activityData.logs || []), logEntry]
  }

  const updatedActivity = await prisma.activity.update({
    where: { id: activityId },
    data: { 
      data: updatedData,
      space: spaceType // Sync primary field
    }
  })

  return { 
    activity: updatedActivity,
    addedValue 
  }
})
