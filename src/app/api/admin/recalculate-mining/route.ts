import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { logger } from '@/lib/server-logger'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
  logger.info('ADMIN', 'Starting recalculation API')
  
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') !== 'false'
  const forceAll = searchParams.get('forceAll') === 'true'
  const MAX_SUSPICIOUS_VALUE = 1000000000 // 1B ISK

  logger.info('ADMIN', `Recalculation params: dryRun=${dryRun}, forceAll=${forceAll}`)

  const BATCH_SIZE = 50
  let skip = 0
  let totalProcessed = 0
  const results: any[] = []

  while (true) {
    const activities = await prisma.activity.findMany({
      where: { type: 'mining' },
      skip,
      take: BATCH_SIZE,
    })

    if (activities.length === 0) break

    logger.info('ADMIN', `Processing batch: ${activities.length} activities (skip=${skip})`)

    for (const activity of activities) {
      const data = activity.data as any
      if (!data || !data.logs || !data.totalEstimatedValue) {
        continue
      }

      if (data.totalEstimatedValue < MAX_SUSPICIOUS_VALUE && !forceAll) {
        continue
      }

      logger.info('ADMIN', `Processing activity ${activity.id} with value ${data.totalEstimatedValue}`)

      // Guard against double-correction
      if (data.wasInflated) {
        logger.info('ADMIN', `Skipping activity ${activity.id} - already inflated`)
        continue
      }

      const newLogs: any[] = []
      let newTotalValue = 0
      const newOreBreakdown: any = JSON.parse(JSON.stringify(data.oreBreakdown || {}))
      const newParticipantBreakdown: any = JSON.parse(JSON.stringify(data.participantBreakdown || {}))

      Object.keys(newOreBreakdown).forEach(k => newOreBreakdown[k].estimatedValue = 0)
      Object.keys(newParticipantBreakdown).forEach(k => newParticipantBreakdown[k].estimatedValue = 0)

      for (const logItem of data.logs) {
        const isIce = logItem.oreName?.toLowerCase().includes('ice') || logItem.oreName?.toLowerCase().includes('glacial')
        const ratio = isIce ? 1 : 100

        const oldVal = logItem.estimatedValue || 0
        const newVal = oldVal / ratio

        const updatedLog = { ...logItem, estimatedValue: newVal }
        newLogs.push(updatedLog)
        newTotalValue += newVal

        const typeId = logItem.typeId
        if (typeId && newOreBreakdown[typeId]) {
          newOreBreakdown[typeId].estimatedValue += newVal
        }

        const charId = logItem.characterId
        if (charId && newParticipantBreakdown[charId]) {
          newParticipantBreakdown[charId].estimatedValue += newVal
        }
      }

      const participantEarnings: any = {}
      Object.keys(newParticipantBreakdown).forEach(charId => {
        participantEarnings[charId] = newParticipantBreakdown[charId].estimatedValue
      })

      const updatedData = {
        ...data,
        logs: newLogs,
        totalEstimatedValue: newTotalValue,
        miningValue: newTotalValue,
        oreBreakdown: newOreBreakdown,
        participantBreakdown: newParticipantBreakdown,
        participantEarnings: participantEarnings,
        recalculatedAt: new Date().toISOString(),
        wasInflated: true
      }

      results.push({
        id: activity.id,
        oldValue: data.totalEstimatedValue,
        newValue: newTotalValue
      })

      if (!dryRun) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { data: updatedData }
        })
      }
    }

    skip += BATCH_SIZE
  }

  logger.info('ADMIN', `Recalculation complete. Processed ${results.length} items.`)

  return NextResponse.json({
    success: true,
    dryRun,
    processedCount: results.length,
    details: results
  })
}))
