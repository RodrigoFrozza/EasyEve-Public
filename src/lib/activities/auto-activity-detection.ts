import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'
import { getCharacterMiningLedger, getCharacterWalletJournal } from '@/lib/esi'
import { logger } from '@/lib/server-logger'
import { ESI_REF_TYPES } from '@/lib/constants/activity-data'
import { 
  ACTIVITY_STALE_PAUSE_THRESHOLD_MS, 
  ACTIVITY_TERMINATION_THRESHOLD_MS,
  getLastActivityInstantForAudit 
} from './activity-automation-policy'
import { runMiningActivitySync } from '@/lib/activities/mining-activity-sync'
import type { Character, Activity } from '@prisma/client'

const COMPONENT = 'AutoActivityDetection'
const CONCURRENT_BATCH_SIZE = 5

const ACTIVITY_TYPES = {
  MINING: 'mining',
  RATTING: 'ratting',
} as const

const TRACKABLE_TAGS = [
  { tag: 'miner', type: 'mining' },
  { tag: 'ratter', type: 'ratting' },
] as const

async function isUserPremium(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionEnd: true, isTester: true },
  })

  if (!user) return false
  if (user.isTester) return true
  if (!user.subscriptionEnd) return false
  return user.subscriptionEnd > new Date()
}

async function getAutoTrackingEnabled(userId: string): Promise<boolean> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { autoTrackingEnabled: true },
  })

  return profile?.autoTrackingEnabled ?? true
}

async function hasActiveActivityForCharacter(
  userId: string,
  characterId: number,
  activityType: string
): Promise<Activity | null> {
  return await prisma.activity.findFirst({
    where: {
      userId,
      type: activityType,
      status: 'active',
      participants: {
        path: [],
        array_contains: [{ characterId }],
      },
    },
    orderBy: { startTime: 'desc' },
  })
}

async function findActiveAutoTrackedActivity(
  userId: string,
  activityType: string
): Promise<Activity | null> {
  return await prisma.activity.findFirst({
    where: {
      userId,
      type: activityType,
      status: 'active',
      // We also check if it's auto-tracked to be sure we are joining the right "kind" of activity
      data: {
        path: ['isAutoTracked'],
        equals: true,
      },
    },
    orderBy: { startTime: 'desc' },
  })
}

/**
 * Consolidates duplicate active auto-tracked activities for a user into a single one.
 * This is a "garbage collection" step to handle any race conditions or legacy duplicates.
 */
async function consolidateAutoActivities(userId: string): Promise<void> {
  try {
    for (const type of [ACTIVITY_TYPES.MINING, ACTIVITY_TYPES.RATTING] as const) {
      const activeAutoActivities = await prisma.activity.findMany({
        where: {
          userId,
          type,
          status: 'active',
          isDeleted: false,
          data: {
            path: ['isAutoTracked'],
            equals: true
          }
        },
        orderBy: { startTime: 'asc' } // Oldest first
      })

      if (activeAutoActivities.length <= 1) continue

      const [canonical, ...others] = activeAutoActivities
      logger.info(COMPONENT, `Consolidating ${others.length} duplicate ${type} activities for user ${userId} into ${canonical.id}`)

      let updatedParticipants = [...(canonical.participants as any[] || [])]
      let updatedData = { ...(canonical.data as any || {}) }

      for (const other of others) {
        // Merge participants
        const otherParticipants = other.participants as any[] || []
        for (const p of otherParticipants) {
          if (!updatedParticipants.some(up => up.characterId === p.characterId)) {
            updatedParticipants.push(p)
          }
        }

        // Merge data
        const otherData = other.data as any || {}
        if (type === ACTIVITY_TYPES.RATTING) {
          updatedData.logs = [...(updatedData.logs || []), ...(otherData.logs || [])]
          updatedData.automatedBounties = (updatedData.automatedBounties || 0) + (otherData.automatedBounties || 0)
          updatedData.automatedEss = (updatedData.automatedEss || 0) + (otherData.automatedEss || 0)
          updatedData.automatedTaxes = (updatedData.automatedTaxes || 0) + (otherData.automatedTaxes || 0)
        } else if (type === ACTIVITY_TYPES.MINING) {
          updatedData.totalQuantity = (updatedData.totalQuantity || 0) + (otherData.totalQuantity || 0)
          updatedData.baselines = { ...(updatedData.baselines || {}), ...(otherData.baselines || {}) }
        }

        // Complete and delete the duplicate
        await prisma.activity.update({
          where: { id: other.id },
          data: { 
            status: 'completed',
            endTime: new Date(),
            isDeleted: true,
            data: {
              ...(other.data as any || {}),
              consolidatedInto: canonical.id,
              consolidatedAt: new Date().toISOString()
            }
          }
        })
      }

      updatedData.detectedCharacters = updatedParticipants.length
      updatedData.lastDataAt = new Date().toISOString()
      updatedData.isConsolidated = true

      await prisma.activity.update({
        where: { id: canonical.id },
        data: {
          participants: updatedParticipants,
          data: updatedData
        }
      })

      // Notify user about consolidation
      await prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title: 'Activities Consolidated',
          content: `Your duplicate ${type === ACTIVITY_TYPES.MINING ? 'Mining' : 'Ratting'} activities have been unified into a single card for better organization.`,
          link: `/dashboard/activity?viewId=${canonical.id}`,
        },
      })
    }
  } catch (error) {
    logger.error(COMPONENT, `Error consolidating activities for user ${userId}`, error)
  }
}

/**
 * Detects mining activity using the ESI Mining Ledger.
 * To avoid false positives from daily cumulative data, we compare current quantity 
 * against a baseline stored in sdeCache.
 */
async function detectMiningActivity(character: Character): Promise<{ detected: boolean; data?: any }> {
  const { id: characterId, name: characterName } = character

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) return { detected: false }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    // Fetch ledger
    const ledger = await getCharacterMiningLedger(characterId, accessToken)

    // If ESI fails (null), we skip to avoid resetting baselines or triggering false positives
    if (ledger === null) return { detected: false }

    const todayEntries = ledger.filter((entry: any) => entry.date === today)
    const totalQuantity = todayEntries.reduce((sum: number, entry: any) => sum + (entry.quantity || 0), 0)

    if (todayEntries.length === 0) {
      // Ensure we have a baseline of 0 if ledger has no entries for today yet
      const baselineKey = `mining_baseline_${characterId}_${today}`
      await prisma.sdeCache.upsert({
        where: { key: baselineKey },
        update: { value: { qty: 0, timestamp: now.toISOString() } },
        create: { key: baselineKey, value: { qty: 0, timestamp: now.toISOString() } }
      })
      return { detected: false }
    }

    // Check baseline in cache to see if quantity increased since last check
    const baselineKey = `mining_baseline_${characterId}_${today}`
    const baselineRecord = await prisma.sdeCache.findUnique({ where: { key: baselineKey } })
    const baselineQty = baselineRecord ? (baselineRecord.value as { qty: number }).qty : null

    // Update baseline in cache immediately
    await prisma.sdeCache.upsert({
      where: { key: baselineKey },
      update: { value: { qty: totalQuantity, timestamp: now.toISOString() } },
      create: { key: baselineKey, value: { qty: totalQuantity, timestamp: now.toISOString() } }
    })

    // If we have a baseline and quantity increased -> DETECTED
    // If it's the first check (baseline null), we wait for next run to see increase
    const hasIncreased = baselineQty !== null && totalQuantity > (baselineQty + 0.1) // Add small epsilon

    if (hasIncreased) {
      return {
        detected: true,
        data: {
          totalQuantity: Math.max(0, totalQuantity - (baselineQty || 0)),
          detectedAt: now.toISOString(),
        },
      }
    }

    return { detected: false }
  } catch (error) {
    logger.error(COMPONENT, `Error detecting mining for ${characterName}`, error)
    return { detected: false }
  }
}

async function detectRattingActivity(character: Character): Promise<{ detected: boolean; data?: any }> {
  const { id: characterId, name: characterName } = character

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) return { detected: false }

    const now = new Date()
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
    
    // Fetch recent journal entries - fetch back to 30 mins ago to ensure we capture the start
    const journal = await getCharacterWalletJournal(characterId, thirtyMinutesAgo)

    const relevantEntries = (journal || [])
      .filter((entry: any) => {
        const entryDate = new Date(entry.date)
        const refType = (entry.ref_type || '').toLowerCase()
        
        const isBounty = ESI_REF_TYPES.BOUNTY.some(t => refType === t)
        const isEss = ESI_REF_TYPES.ESS.some(t => refType === t)
        const isTax = ESI_REF_TYPES.TAX.some(t => refType === t)

        return entryDate >= thirtyMinutesAgo && (isBounty || isEss || isTax)
      })
      .map((entry: any) => {
        const refType = (entry.ref_type || '').toLowerCase()
        let type = 'bounty'
        if (ESI_REF_TYPES.ESS.some(t => refType === t)) type = 'ess'
        if (ESI_REF_TYPES.TAX.some(t => refType === t)) type = 'tax'

        return {
          ...entry,
          type,
          amount: Math.abs(entry.amount || 0),
          charName: characterName,
          date: entry.date,
        }
      })

    if (relevantEntries.length > 0) {
      const automatedBounties = relevantEntries
        .filter(e => e.type === 'bounty')
        .reduce((sum, e) => sum + e.amount, 0)
      
      const automatedEss = relevantEntries
        .filter(e => e.type === 'ess')
        .reduce((sum, e) => sum + e.amount, 0)

      const automatedTaxes = relevantEntries
        .filter(e => e.type === 'tax')
        .reduce((sum, e) => sum + e.amount, 0)

      // Find earliest entry date to set as activity start time
      const earliestDate = relevantEntries.reduce((min, e) => {
        const d = new Date(e.date).getTime()
        return d < min ? d : min
      }, now.getTime())

      return {
        detected: true,
        data: {
          logs: relevantEntries,
          automatedBounties,
          automatedEss,
          automatedTaxes,
          detectedAt: now.toISOString(),
          startTime: new Date(earliestDate).toISOString(),
        },
      }
    }

    return { detected: false }
  } catch (error) {
    logger.error(COMPONENT, `Error detecting ratting for ${characterName}`, error)
    return { detected: false }
  }
}

async function handleUserAutoTracking(userId: string): Promise<{ started: number; ended: number }> {
  // Proactively consolidate any existing duplicates before checking for new activity
  await consolidateAutoActivities(userId)

  const isPremium = await isUserPremium(userId)
  if (!isPremium) return { started: 0, ended: 0 }

  const autoTrackingEnabled = await getAutoTrackingEnabled(userId)
  if (!autoTrackingEnabled) return { started: 0, ended: 0 }

  const characters = await prisma.character.findMany({
    where: { userId },
  })

  const detectedByType: Record<string, { char: Character; data: any }[]> = {
    mining: [],
    ratting: [],
  }

  const processedCharIds = new Set<number>()

  for (const char of characters) {
    const charTags = (char.tags as string[] || []).map(t => t.toLowerCase())

    for (const { tag, type } of TRACKABLE_TAGS) {
      if (processedCharIds.has(char.id)) break
      if (!charTags.includes(tag)) {
        // Only log at debug level to avoid spamming, but helps troubleshooting
        logger.debug(COMPONENT, `Character ${char.name} (${char.id}) lacks tag '${tag}' for ${type} tracking`)
        continue
      }

      const existingActivity = await hasActiveActivityForCharacter(userId, char.id, type)
      
      // If there is an active (non-paused) activity, we skip to avoid duplicates
      if (existingActivity && !existingActivity.isPaused) {
        logger.debug(COMPONENT, `Character ${char.name} is already in an active ${type} activity (${existingActivity.id})`)
        processedCharIds.add(char.id)
        continue
      }

      let detectionResult: { detected: boolean; data?: any }
      if (type === ACTIVITY_TYPES.MINING) {
        detectionResult = await detectMiningActivity(char)
      } else {
        detectionResult = await detectRattingActivity(char)
      }

      if (detectionResult.detected) {
        if (existingActivity && existingActivity.isPaused) {
          // Resume existing paused activity
          // We use retrospective resume: the pause ended when the FIRST new event happened
          const resumeTime = detectionResult.data.startTime 
            ? new Date(detectionResult.data.startTime) 
            : new Date()
          
          const pausedAtTime = existingActivity.pausedAt ? new Date(existingActivity.pausedAt) : resumeTime
          const additionalPauseTime = Math.max(0, resumeTime.getTime() - pausedAtTime.getTime())

          await prisma.activity.update({
            where: { id: existingActivity.id },
            data: { 
              isPaused: false, 
              pausedAt: null,
              accumulatedPausedTime: (existingActivity.accumulatedPausedTime || 0) + additionalPauseTime,
              data: {
                ...(existingActivity.data as any || {}),
                lastDataAt: resumeTime.toISOString(), // Mark progress at the actual resume time
                lastSyncAt: new Date().toISOString(),
              }
            }
          })

          // Notify user about resume
          await prisma.notification.create({
            data: {
              userId,
              type: 'system',
              title: 'Activity Resumed',
              content: `Your ${type} activity was automatically resumed after detecting new progress (Character: ${char.name}).`,
              link: `/dashboard/activity?viewId=${existingActivity.id}`,
            },
          })

          logger.info(COMPONENT, `Resumed paused ${type} activity ${existingActivity.id} for character ${char.id} (Pause duration added: ${additionalPauseTime}ms)`)
        } else {
          // Prepare for new activity creation
          detectedByType[type].push({ char, data: detectionResult.data })
        }
        processedCharIds.add(char.id)
      }
    }
  }

  let totalStarted = 0
  for (const activityType of [ACTIVITY_TYPES.MINING, ACTIVITY_TYPES.RATTING] as const) {
    const detectedChars = detectedByType[activityType]
    if (detectedChars.length === 0) continue

    // Check if there's already an active auto-tracked activity of this type for the user
    const existingActivity = await findActiveAutoTrackedActivity(userId, activityType)

    if (existingActivity) {
      // JOIN EXISTING ACTIVITY
      const currentParticipants = existingActivity.participants as any[] || []
      const newParticipants = detectedChars.map(({ char }) => ({
        characterId: char.id,
        characterName: char.name,
        fit: null,
      }))
      
      const updatedParticipants = [...currentParticipants]
      for (const np of newParticipants) {
        if (!updatedParticipants.some(p => p.characterId === np.characterId)) {
          updatedParticipants.push(np)
        }
      }

      const currentData = existingActivity.data as any || {}
      
      // Prepare incremental data
      const incrementalData: any = {
        lastSyncAt: new Date().toISOString(),
        lastDataAt: new Date().toISOString(),
      }

      if (activityType === ACTIVITY_TYPES.RATTING) {
        incrementalData.logs = detectedChars.flatMap(d => d.data.logs)
        incrementalData.automatedBounties = detectedChars.reduce((sum, d) => sum + d.data.automatedBounties, 0)
        incrementalData.automatedEss = detectedChars.reduce((sum, d) => sum + d.data.automatedEss, 0)
        incrementalData.automatedTaxes = detectedChars.reduce((sum, d) => sum + d.data.automatedTaxes, 0)
      } else if (activityType === ACTIVITY_TYPES.MINING) {
        incrementalData.totalQuantity = detectedChars.reduce((sum, d) => sum + d.data.totalQuantity, 0)
        incrementalData.baselines = detectedChars.reduce((acc, d) => ({ ...acc, ...d.data.baselines }), {})
      }

      // Merge with current data
      const updatedData = {
        ...currentData,
        lastSyncAt: incrementalData.lastSyncAt,
        lastDataAt: incrementalData.lastDataAt,
        detectedCharacters: updatedParticipants.length,
      }

      if (activityType === ACTIVITY_TYPES.RATTING) {
        updatedData.logs = [...(currentData.logs || []), ...incrementalData.logs]
        updatedData.automatedBounties = (currentData.automatedBounties || 0) + incrementalData.automatedBounties
        updatedData.automatedEss = (currentData.automatedEss || 0) + incrementalData.automatedEss
        updatedData.automatedTaxes = (currentData.automatedTaxes || 0) + incrementalData.automatedTaxes
      } else if (activityType === ACTIVITY_TYPES.MINING) {
        updatedData.totalQuantity = (currentData.totalQuantity || 0) + incrementalData.totalQuantity
        updatedData.baselines = { ...(currentData.baselines || {}), ...incrementalData.baselines }
      }

      await prisma.activity.update({
        where: { id: existingActivity.id },
        data: {
          participants: updatedParticipants,
          data: updatedData,
          isPaused: false,
          pausedAt: null,
        },
      })

      // Notify user about joining
      const charNames = detectedChars.map(d => d.char.name).join(', ')
      await prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title: 'Character Added',
          content: `${charNames} joined your ongoing ${activityType === ACTIVITY_TYPES.MINING ? 'Mining' : 'Ratting'} activity.`,
          link: `/dashboard/activity?viewId=${existingActivity.id}`,
        },
      })

      logger.info(COMPONENT, `Added ${detectedChars.length} characters to existing auto-activity ${existingActivity.id} (${activityType})`)
    } else {
      // CREATE NEW ACTIVITY
      const participants = detectedChars.map(({ char }) => ({
        characterId: char.id,
        characterName: char.name,
        fit: null,
      }))

      // Find the overall earliest start time among all characters for this activity
      let earliestStartTime = new Date()
      if (activityType === ACTIVITY_TYPES.RATTING) {
        const times = detectedChars
          .map(d => new Date(d.data.startTime).getTime())
          .filter(t => !isNaN(t))
        if (times.length > 0) {
          earliestStartTime = new Date(Math.min(...times))
        }
      }

      // Aggregate initial data from all characters
      const initialData: any = {
        isAutoTracked: true,
        autoTrackingStartedAt: new Date().toISOString(),
        detectedCharacters: detectedChars.length,
        iskTrend: 'stable',
        lastSyncAt: new Date().toISOString(),
        lastDataAt: new Date().toISOString(),
      }

      if (activityType === ACTIVITY_TYPES.RATTING) {
        initialData.logs = detectedChars.flatMap(d => d.data.logs)
        initialData.automatedBounties = detectedChars.reduce((sum, d) => sum + d.data.automatedBounties, 0)
        initialData.automatedEss = detectedChars.reduce((sum, d) => sum + d.data.automatedEss, 0)
        initialData.automatedTaxes = detectedChars.reduce((sum, d) => sum + d.data.automatedTaxes, 0)
      } else if (activityType === ACTIVITY_TYPES.MINING) {
        initialData.totalQuantity = detectedChars.reduce((sum, d) => sum + d.data.totalQuantity, 0)
        initialData.baselines = detectedChars.reduce((acc, d) => ({ ...acc, ...d.data.baselines }), {})
        // Stay false until runMiningActivitySync(mode: 'initial') snapshots the ledger; true + empty
        // baselines made regular sync attribute the entire same-day ESI cumulative to this session.
        initialData.hasInitialBaseline = false
      }

      const newActivity = await prisma.activity.create({
        data: {
          userId,
          type: activityType,
          status: 'active',
          participants,
          startTime: earliestStartTime,
          data: initialData,
        },
      })

      if (activityType === ACTIVITY_TYPES.MINING) {
        try {
          await runMiningActivitySync({
            userId,
            activityId: newActivity.id,
            mode: 'initial',
          })
        } catch (error) {
          logger.error(COMPONENT, 'Initial mining sync failed for auto-tracked activity', error, {
            activityId: newActivity.id,
            userId,
          })
        }
      }

      // Notify user about auto-start
      await prisma.notification.create({
        data: {
          userId,
          type: 'system',
          title: 'Nova Atividade Detectada',
          content: `Uma nova atividade de ${activityType === ACTIVITY_TYPES.MINING ? 'Mineração' : 'Ratting'} foi iniciada automaticamente para seus personagens.`,
          link: `/dashboard/activity?viewId=${newActivity.id}`,
        },
      })

      totalStarted++
      logger.info(COMPONENT, `Started auto-activity ${activityType} for user ${userId} with ${detectedChars.length} characters (StartTime: ${earliestStartTime.toISOString()})`)
    }
  }

  return { started: totalStarted, ended: 0 }
}

/**
 * Global safety audit: Pauses activities that have been inactive for > 90 minutes.
 * Uses the canonical policy from activity-automation-policy.ts.
 */
export async function terminateStaleActivities(): Promise<number> {
  const now = new Date()
  const nowMs = now.getTime()
  let auditCount = 0

  try {
    // 1. Handle Active -> Paused (90m threshold)
    const activeStale = await prisma.activity.findMany({
      where: {
        status: 'active',
        isDeleted: false,
        isPaused: false,
      },
    })

    for (const activity of activeStale) {
      const lastActivityTime = getLastActivityInstantForAudit({
        startTime: activity.startTime,
        data: activity.data,
        updatedAt: activity.updatedAt
      })

      if (nowMs - lastActivityTime.getTime() > ACTIVITY_STALE_PAUSE_THRESHOLD_MS) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            isPaused: true,
            pausedAt: lastActivityTime, // Pause retrospectively at the last activity instant
          }
        })

        // Notify user about pause
        await prisma.notification.create({
          data: {
            userId: activity.userId,
            type: 'system',
            title: 'Activity Paused',
            content: `Your ${activity.type} activity was automatically paused due to inactivity (60m).`,
            link: `/dashboard/activity?viewId=${activity.id}`,
          },
        })

        auditCount++
      }
    }

    // 2. Handle Paused -> Completed (6h threshold)
    const pausedThreshold = new Date(nowMs - ACTIVITY_TERMINATION_THRESHOLD_MS)
    const pausedStale = await prisma.activity.findMany({
      where: {
        status: 'active',
        isDeleted: false,
        isPaused: true,
        pausedAt: {
          not: null,
          lt: pausedThreshold
        }
      }
    })

    for (const activity of pausedStale) {
      // Finalize the time spent in the paused state
      const additionalPauseTime = activity.pausedAt 
        ? now.getTime() - new Date(activity.pausedAt).getTime()
        : 0

      await prisma.activity.update({
        where: { id: activity.id },
        data: {
          status: 'completed',
          endTime: now,
          accumulatedPausedTime: (activity.accumulatedPausedTime || 0) + additionalPauseTime,
          data: {
            ...(activity.data as any || {}),
            autoTerminatedAt: now.toISOString(),
            terminationReason: 'auto_terminated_6h_pause'
          }
        }
      })

      // Notify user about completion
      await prisma.notification.create({
        data: {
          userId: activity.userId,
          type: 'system',
          title: 'Activity Completed',
          content: `Your ${activity.type} activity was automatically finished after 6 hours of being paused.`,
          link: `/dashboard/activity?viewId=${activity.id}`,
        },
      })

      auditCount++
    }

  } catch (error) {
    logger.error(COMPONENT, 'Failed to run stale activities audit', error)
  }

  return auditCount
}

export async function runAutoActivityDetection(): Promise<{ processed: number; started: number; ended: number }> {
  const CACHE_KEY_ROTATION = 'auto_track_rotation'
  const BATCH_SIZE = 50 // Process 50 users per run (increased from 20 for faster coverage)

  try {
    // 1. Get rotation state
    const rotationRecord = await prisma.sdeCache.findUnique({ where: { key: CACHE_KEY_ROTATION } })
    const rotation = rotationRecord?.value as { lastIndex: number } | null
    const currentIndex = rotation?.lastIndex || 0

    // 2. Get eligible users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { subscriptionEnd: { gt: new Date() } },
          { isTester: true },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    if (users.length === 0) return { processed: 0, started: 0, ended: 0 }

    const totalUsers = users.length
    const startIndex = currentIndex % totalUsers
    const usersToProcess = users.slice(startIndex, startIndex + BATCH_SIZE)
    
    // Wrap around if needed
    if (usersToProcess.length < BATCH_SIZE && totalUsers > usersToProcess.length) {
      const remaining = BATCH_SIZE - usersToProcess.length
      usersToProcess.push(...users.slice(0, remaining))
    }

    const userIds = usersToProcess.map(u => u.id)
    logger.info(COMPONENT, `Starting detection for ${userIds.length} users (index: ${startIndex})`)

    // 3. Process detection for users in batches
    let startedCount = 0
    for (let i = 0; i < userIds.length; i += CONCURRENT_BATCH_SIZE) {
      const batch = userIds.slice(i, i + CONCURRENT_BATCH_SIZE)
      const results = await Promise.all(batch.map(uid => handleUserAutoTracking(uid)))
      startedCount += results.reduce((sum, r) => sum + r.started, 0)
      
      if (i + CONCURRENT_BATCH_SIZE < userIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // 4. Terminate stale activities (Global safety)
    const endedCount = await terminateStaleActivities()

    // 5. Update rotation state
    const nextOffset = (startIndex + userIds.length) % totalUsers
    await prisma.sdeCache.upsert({
      where: { key: CACHE_KEY_ROTATION },
      create: { key: CACHE_KEY_ROTATION, value: { lastIndex: nextOffset, lastRun: new Date().toISOString() } },
      update: { value: { lastIndex: nextOffset, lastRun: new Date().toISOString() } }
    })

    return {
      processed: userIds.length,
      started: startedCount,
      ended: endedCount
    }
  } catch (error) {
    logger.error(COMPONENT, 'Critical error in runAutoActivityDetection', error)
    throw error
  }
}