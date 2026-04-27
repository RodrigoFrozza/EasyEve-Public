import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'
import { getCharacterMiningLedger, getCharacterWalletJournal, getCharacterLocation } from '@/lib/esi'
import { logger } from '@/lib/server-logger'
import type { Character, Activity, User } from '@prisma/client'

const COMPONENT = 'AutoActivityDetection'

const AUTO_TIMEOUT_MINUTES = 55
const CONCURRENT_BATCH_SIZE = 5
const ESI_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const ACTIVITY_TYPES = {
  MINING: 'mining',
  RATTING: 'ratting',
  ABYSSAL: 'abyssal',
} as const

const esiCache = new Map<string, { data: any; timestamp: number }>()

async function getCachedEsiData<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
  const cached = esiCache.get(key)
  if (cached && Date.now() - cached.timestamp < ESI_CACHE_TTL) {
    return cached.data as T
  }
  
  const data = await fetchFn()
  esiCache.set(key, { data, timestamp: Date.now() })
  return data
}

function clearOldCacheEntries(): void {
  const now = Date.now()
  for (const [key, value] of esiCache.entries()) {
    if (now - value.timestamp > ESI_CACHE_TTL) {
      esiCache.delete(key)
    }
  }
}

interface DetectionResult {
  characterId: number
  characterName: string
  activityType: string
  detected: boolean
  data?: any
}

async function isUserPremium(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionEnd: true },
  })

  if (!user?.subscriptionEnd) return false
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
  const activity = await prisma.activity.findFirst({
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

  return activity
}

async function createAutoActivity(
  userId: string,
  characterId: number,
  characterName: string,
  activityType: string,
  initialData: any = {}
): Promise<Activity> {
  logger.info(COMPONENT, `Creating auto-activity for user ${userId}, char ${characterId}, type ${activityType}`)

  const activity = await prisma.activity.create({
    data: {
      userId,
      type: activityType,
      status: 'active',
      characterId,
      participants: [{ characterId, characterName, fit: null }],
      data: {
        ...initialData,
        isAutoTracked: true,
        autoTrackingStartedAt: new Date().toISOString(),
      },
    },
  })

  return activity
}

async function updateActivityLastSync(activityId: string): Promise<void> {
  await prisma.activity.update({
    where: { id: activityId },
    data: {
      data: {
        lastAutoSyncAt: new Date().toISOString(),
      },
    },
  })
}

async function shouldEndActivity(activity: Activity): Promise<boolean> {
  const activityData = (activity.data as any) || {}
  const lastSync = activityData.lastAutoSyncAt

  if (!lastSync) {
    return false
  }

  const lastSyncDate = new Date(lastSync)
  const now = new Date()
  const diffMinutes = (now.getTime() - lastSyncDate.getTime()) / (1000 * 60)

  return diffMinutes > AUTO_TIMEOUT_MINUTES
}

async function detectMiningActivity(character: Character): Promise<{ detected: boolean; data?: any }> {
  const { id: characterId, name: characterName, userId } = character

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      return { detected: false }
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const ledger = await getCharacterMiningLedger(characterId, accessToken, undefined, oneHourAgo.toISOString())

    if (!ledger || ledger.length === 0) {
      return { detected: false }
    }

    const totalQuantity = ledger.reduce((sum: number, entry: any) => sum + (entry.quantity || 0), 0)

    if (totalQuantity > 0) {
      return {
        detected: true,
        data: {
          oreMined: ledger,
          totalQuantity,
          detectedAt: new Date().toISOString(),
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
  const { id: characterId, name: characterName, userId } = character

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      return { detected: false }
    }

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const journal = await getCharacterWalletJournal(characterId, new Date())

    const relevantEntries = (journal || []).filter((entry: any) => {
      const entryDate = new Date(entry.date)
      const refType = (entry.ref_type || '').toLowerCase()
      return (
        entryDate >= oneHourAgo &&
        (refType === 'bounty' || refType === 'corporate_donation' || refType === 'transaction_tax')
      )
    })

    const totalBounty = relevantEntries
      .filter((e: any) => e.ref_type?.toLowerCase() === 'bounty')
      .reduce((sum: number, e: any) => sum + Math.abs(e.amount || 0), 0)

    if (relevantEntries.length > 0) {
      return {
        detected: true,
        data: {
          logs: relevantEntries,
          totalBounty,
          detectedAt: new Date().toISOString(),
        },
      }
    }

    return { detected: false }
  } catch (error) {
    logger.error(COMPONENT, `Error detecting ratting for ${characterName}`, error)
    return { detected: false }
  }
}

async function detectAbyssalActivity(character: Character): Promise<{ detected: boolean; data?: any }> {
  const { id: characterId, name: characterName, userId } = character

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      return { detected: false }
    }

    const locationData = await getCharacterLocation(characterId, accessToken)
    const location = locationData.location || ''
    const solarSystemId = locationData.solar_system_id || 0

    const isInsideAbyss =
      location.toLowerCase().includes('abyssal deadspace') ||
      /^[AIRCNT]D\d+$/i.test(location) ||
      (solarSystemId >= 32000000 && solarSystemId < 33000000)

    if (isInsideAbyss) {
      return {
        detected: true,
        data: {
          location,
          solarSystemId,
          detectedAt: new Date().toISOString(),
        },
      }
    }

    return { detected: false }
  } catch (error) {
    logger.error(COMPONENT, `Error detecting abyssal for ${characterName}`, error)
    return { detected: false }
  }
}

async function handleUserAutoTracking(userId: string): Promise<{ started: number; ended: number }> {
  const started: number[] = []
  const ended: number[] = []

  const isPremium = await isUserPremium(userId)
  if (!isPremium) {
    logger.info(COMPONENT, `User ${userId} is not premium, skipping`)
    return { started: 0, ended: 0 }
  }

  const autoTrackingEnabled = await getAutoTrackingEnabled(userId)
  if (!autoTrackingEnabled) {
    logger.info(COMPONENT, `User ${userId} has auto-tracking disabled, skipping`)
    return { started: 0, ended: 0 }
  }

  const characters = await prisma.character.findMany({
    where: { userId },
  })

  logger.info(COMPONENT, `Checking ${characters.length} characters for user ${userId}`)

  const detectedByType: Record<string, { char: Character; data: any }[]> = {
    mining: [],
    ratting: [],
    abyssal: [],
  }

  for (const char of characters) {
    const charTags = char.tags as string[] || []

    for (const activityType of [ACTIVITY_TYPES.MINING, ACTIVITY_TYPES.RATTING, ACTIVITY_TYPES.ABYSSAL]) {
      const hasTag = charTags.includes(activityType.toLowerCase()) || charTags.includes(activityType)
      if (!hasTag && charTags.length > 0) {
        continue
      }

      const existingActivity = await hasActiveActivityForCharacter(userId, char.id, activityType)
      if (existingActivity) {
        logger.info(COMPONENT, `Skipping char ${char.name} - already has active ${activityType} activity`)
        continue
      }

      let detectionResult: { detected: boolean; data: any }

      if (activityType === ACTIVITY_TYPES.MINING) {
        detectionResult = await detectMiningActivity(char) as { detected: boolean; data: any }
      } else if (activityType === ACTIVITY_TYPES.RATTING) {
        detectionResult = await detectRattingActivity(char) as { detected: boolean; data: any }
      } else {
        detectionResult = await detectAbyssalActivity(char) as { detected: boolean; data: any }
      }

      if (detectionResult.detected) {
        detectedByType[activityType].push({ char, data: detectionResult.data })
      }
    }
  }

  for (const activityType of [ACTIVITY_TYPES.MINING, ACTIVITY_TYPES.RATTING, ACTIVITY_TYPES.ABYSSAL]) {
    const detectedChars = detectedByType[activityType]
    
    if (detectedChars.length === 0) {
      continue
    }

    const participants = detectedChars.map(({ char, data }) => ({
      characterId: char.id,
      characterName: char.name,
      fit: null,
    }))

    const activityData = {
      isAutoTracked: true,
      autoTrackingStartedAt: new Date().toISOString(),
      detectedCharacters: detectedChars.length,
    }

    await prisma.activity.create({
      data: {
        userId,
        type: activityType,
        status: 'active',
        participants,
        data: activityData,
      },
    })

    started.push(detectedChars.length)
    logger.info(COMPONENT, `Started auto-activity ${activityType} with ${detectedChars.length} characters: ${participants.map(p => p.characterName).join(', ')}`)
  }

  return { started: started.length, ended: ended.length }
}

export async function runAutoActivityDetection(): Promise<{ processed: number; started: number; ended: number }> {
  logger.info(COMPONENT, 'Starting auto-activity detection cron')

  clearOldCacheEntries()

  const now = new Date()
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000) 
  const lastSyncKey = 'last_auto_track'
  
  const lastSyncRecord = await prisma.sdeCache.findUnique({
    where: { key: lastSyncKey },
  })
  
  const lastSync = lastSyncRecord?.value as { timestamp?: string; processedUsers?: string[] } | null
  const lastProcessedUserIds: string[] = lastSync?.processedUsers || []
  const lastTimestamp = lastSync?.timestamp ? new Date(lastSync.timestamp) : new Date(0)
  const shouldRotate = now.getTime() - lastTimestamp.getTime() > 10 * 60 * 1000

  const users = await prisma.user.findMany({
    where: {
      subscriptionEnd: { gt: new Date() },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  let usersToProcess: typeof users
  if (shouldRotate || lastProcessedUserIds.length === 0) {
    const maxUsersPerRun = Math.min(50, Math.ceil(users.length / 6))
    usersToProcess = users.slice(0, maxUsersPerRun)
  } else {
    const processedSet = new Set(lastProcessedUserIds)
    usersToProcess = users.filter(u => !processedSet.has(u.id))
    if (usersToProcess.length === 0) {
      usersToProcess = users.slice(0, Math.ceil(users.length / 6))
    }
  }

  logger.info(COMPONENT, `Processing ${usersToProcess.length} of ${users.length} users`)

  const chunkSize = CONCURRENT_BATCH_SIZE
  let totalStarted = 0

  for (let i = 0; i < usersToProcess.length; i += chunkSize) {
    const batch = usersToProcess.slice(i, i + chunkSize)
    const results = await Promise.all(
      batch.map(user => handleUserAutoTracking(user.id))
    )
    
    totalStarted += results.reduce((sum, r) => sum + r.started, 0)
    
    if (i + chunkSize < usersToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const processedUserIds = usersToProcess.map(u => u.id)
  
  await prisma.sdeCache.upsert({
    where: { key: lastSyncKey },
    update: { value: { timestamp: now.toISOString(), processedUsers: processedUserIds } },
    create: { key: lastSyncKey, value: { timestamp: now.toISOString(), processedUsers: processedUserIds } },
  })

  logger.info(COMPONENT, `Auto-detection complete: ${usersToProcess.length} users, ${totalStarted} activities`)

  return { processed: usersToProcess.length, started: totalStarted, ended: 0 }
}

export type { DetectionResult }