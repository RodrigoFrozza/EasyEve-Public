import type { Activity } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCharacterWalletJournal } from '@/lib/esi'
import { ESI_REF_TYPES } from '@/lib/constants/activity-data'
import { logger } from '@/lib/server-logger'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

const component = 'Activity:Sync'

/**
 * Server-only ratting wallet sync for an activity row (caller must enforce ownership).
 */
export async function syncRattingWalletForActivity(activity: Activity): Promise<Activity> {
  const activityId = activity.id

  if (activity.type !== 'ratting') {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Sync only supported for ratting activities', 400)
  }

  const participants = activity.participants as any[]
  if (!participants || participants.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No participants to sync', 400)
  }

  const startTimeManual = new Date(activity.startTime)
  const startTime = new Date(startTimeManual.getTime() - 30 * 60 * 1000)
  const endTimeLimit = activity.endTime
    ? new Date(new Date(activity.endTime).getTime() + 168 * 60 * 1000)
    : new Date(Date.now() + 5 * 60 * 1000)

  logger.info(component, `START INCREMENTAL SYNC for Activity ID: ${activityId}`)
  logger.info(component, `Window (UTC): ${startTime.toISOString()} to ${endTimeLimit.toISOString()}`)

  const activityData = (activity.data as any) || {}
  const existingLogs = activityData.logs || []
  const logMap = new Map<string, any>()

  existingLogs.forEach((log: any) => {
    const key = `${log.charId}-${log.refId}-${log.type}-${new Date(log.date).getTime()}`
    logMap.set(key, log)
  })

  let totalExisting = 0
  let totalNewCount = 0

  for (const participant of participants) {
    const charId = participant.characterId
    const charName = participant.characterName || `Citizen ${charId}`

    try {
      const journal = await getCharacterWalletJournal(charId, endTimeLimit)

      if (Array.isArray(journal)) {
        logger.info(component, `${charName}: Fetched ${journal.length} entries from ESI.`)

        journal.forEach((entry: any) => {
          const entryDate = new Date(entry.date)
          const refType = (entry.ref_type || '').toLowerCase()
          const refId = entry.id?.toString()

          if (entryDate >= startTime && entryDate <= endTimeLimit) {
            const rawAmount = entry.amount || 0
            let type: 'bounty' | 'ess' | 'tax' | null = null

            if (ESI_REF_TYPES.TAX.some(t => refType === t || refType.includes(t))) {
              type = 'tax'
            } else if (ESI_REF_TYPES.BOUNTY.some(t => refType === t || refType.includes(t))) {
              type = 'bounty'
            } else if (ESI_REF_TYPES.ESS.some(t => refType === t || refType.includes(t))) {
              type = 'ess'
            }

            if (type && refId) {
              const amount = type === 'tax' ? rawAmount : Math.abs(rawAmount)
              const entryTimestamp = new Date(entry.date).getTime()
              const compositeKey = `${charId}-${refId}-${type}-${entryTimestamp}`

              if (!logMap.has(compositeKey)) {
                logger.debug(component, `NEW ${type.toUpperCase()}: ${amount.toLocaleString()} ISK for ${charName}`)
                totalNewCount++
                logMap.set(compositeKey, {
                  refId,
                  date: entry.date,
                  amount,
                  type,
                  charName,
                  charId
                })
              } else {
                totalExisting++
              }
            }
          }
        })
      }
    } catch (err) {
      logger.error(component, `Failed to sync earnings for character ${charName} (${charId})`, err)
    }
  }

  const allLogs = Array.from(logMap.values())

  let totalBounties = 0
  let totalEss = 0
  let totalTaxes = 0
  const participantEarnings: Record<number, number> = {}

  allLogs.forEach(log => {
    if (log.type === 'bounty') {
      totalBounties += log.amount
    } else if (log.type === 'ess') {
      totalEss += log.amount
    } else if (log.type === 'tax') {
      totalTaxes += Math.abs(log.amount)
    }

    if (!participantEarnings[log.charId]) participantEarnings[log.charId] = 0
    participantEarnings[log.charId] += log.amount
  })

  const lastEssPaymentAt = allLogs.find((log) => log.type === 'ess')?.date

  allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const additionalBounties = activityData.additionalBounties || 0
  const startTimeMs = new Date(activity.startTime).getTime()
  const hoursElapsed = (Date.now() - startTimeMs) / 3600000

  const currentTotalIsk = (totalBounties + additionalBounties + totalEss + (activityData.estimatedLootValue || 0) + (activityData.estimatedSalvageValue || 0))
  const currentIskPerHour = currentTotalIsk / Math.max(0.1, hoursElapsed)

  const previousIskPerHour = activityData.currentIskPerHour || 0
  let iskTrend = 'stable'

  if (previousIskPerHour > 0) {
    const diff = currentIskPerHour - previousIskPerHour
    const threshold = previousIskPerHour * 0.05
    if (diff > threshold) iskTrend = 'up'
    else if (diff < -threshold) iskTrend = 'down'
  }

  const previousAutomatedBounties = activityData.automatedBounties || 0
  const previousAutomatedEss = activityData.automatedEss || 0
  const previousLogsCount = existingLogs.length
  const totalsChanged =
    previousAutomatedBounties !== totalBounties ||
    previousAutomatedEss !== totalEss ||
    previousLogsCount !== allLogs.length ||
    totalNewCount > 0

  const updatedData = {
    ...activityData,
    automatedBounties: totalBounties,
    automatedEss: totalEss,
    automatedTaxes: totalTaxes,
    grossBounties: totalBounties + totalEss + additionalBounties,
    participantEarnings,
    logs: allLogs,
    currentIskPerHour,
    iskTrend,
    lastSyncAt: new Date().toISOString(),
    lastSyncWithChangesAt: totalsChanged ? new Date().toISOString() : activityData.lastSyncWithChangesAt,
    lastSyncChangeCount: totalNewCount,
    syncCount: (activityData.syncCount || 0) + 1,
    lastEssPaymentAt: lastEssPaymentAt || activityData.lastEssPaymentAt
  }

  logger.info(component, `END SYNC Summary: ${totalNewCount} New | ${totalExisting} Existing | ${allLogs.length} Total`)
  logger.info(component, `Value: Bounty: ${totalBounties.toLocaleString()} | ESS: ${totalEss.toLocaleString()} | Tax: ${totalTaxes.toLocaleString()}`)

  logger.info(component, 'Sync complete', {
    event: 'sync_ratting_complete',
    activityId,
    totalNew: totalNewCount,
    totalExisting,
    totalLogs: allLogs.length,
    earnings: {
      bounty: totalBounties,
      ess: totalEss,
      tax: totalTaxes
    }
  })

  return prisma.activity.update({
    where: { id: activityId },
    data: { data: updatedData }
  })
}
