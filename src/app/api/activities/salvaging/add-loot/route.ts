import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { recalcSalvagingLootTotalsFromLogs } from '@/lib/activities/salvaging-data-recalc'
import type { SalvagingLogLike } from '@/lib/activities/salvaging-logs-merge'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

const addLootSchema = z.object({
  activityId: z.string().min(1, 'Activity ID is required'),
  loot: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().min(1),
      })
    )
    .min(1, 'At least one loot item is required'),
  fullCargoAfter: z.string().min(1, 'Full cargo after paste is required'),
  label: z.string().max(180).optional(),
  spaceType: z.string().max(120).optional(),
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await validateBody(request, addLootSchema)
  const { activityId, loot, fullCargoAfter, label, spaceType } = body

  const itemNames = loot.map((item) => item.name)
  const { getMarketAppraisalWithIds } = await import('@/lib/market')
  const appraisal = await getMarketAppraisalWithIds(itemNames)

  let addedValue = 0
  const processedLoot = loot.map((item) => {
    const data = appraisal[item.name.toLowerCase()] || { price: 0, id: 0 }
    const total = data.price * item.quantity
    addedValue += total
    return { ...item, price: data.price, total, typeId: data.id }
  })

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

    if (activity.type !== 'salvaging') {
      throw new AppError(
        ErrorCodes.VALIDATION_FAILED,
        'Only salvaging activities are supported by this endpoint',
        400
      )
    }

    if (activity.status !== 'active') {
      throw new AppError(
        ErrorCodes.VALIDATION_FAILED,
        'Cannot add loot to a completed activity',
        400
      )
    }

    const resolvedSpaceType = spaceType || activity.space || 'Highsec'
    const progressAt = new Date().toISOString()
    const activityData = (activity.data as Record<string, unknown>) || {}

    const logEntry = {
      refId: `salvage-${crypto.randomUUID()}`,
      type: 'salvage' as const,
      label: label?.trim() || undefined,
      spaceType: resolvedSpaceType,
      value: addedValue,
      items: processedLoot,
      date: progressAt,
    }

    const mergedLogs: SalvagingLogLike[] = [
      ...(((activityData.logs as SalvagingLogLike[] | undefined) || [])),
      logEntry,
    ]
    const totals = recalcSalvagingLootTotalsFromLogs(mergedLogs)

    const updatedData = {
      ...activityData,
      ...totals,
      lastCargoState: fullCargoAfter,
      currentSpaceType: resolvedSpaceType,
      logs: mergedLogs,
      lastDataAt: progressAt,
      lastSyncAt: progressAt,
    }

    const expectedUpdatedAt = activity.updatedAt
    const updateResult = await tx.activity.updateMany({
      where: { id: activityId, updatedAt: expectedUpdatedAt },
      data: {
        data: updatedData as Prisma.InputJsonValue,
        space: resolvedSpaceType,
      },
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

    return { activity: updatedActivity, addedValue }
  })

  return result
})
