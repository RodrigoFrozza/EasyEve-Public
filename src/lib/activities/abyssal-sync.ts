import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { getCharacterLocation } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import type { Activity } from '@prisma/client'
import { logger } from '@/lib/server-logger'

const component = 'AbyssalSync'

interface AbyssalRun {
  id: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'death'
  registrationStatus?: 'pending' | 'registered' | 'not_registered'
  tier?: string
  weather?: string
  ship?: string
  lootValue?: number
  beforeCargoState?: string
  afterCargoState?: string
}

/**
 * Syncs an Abyssal activity by checking the character's current location.
 * Automatically starts or ends runs if trackingMode is 'automatic'.
 */
export async function syncAbyssalActivity(activity: Activity): Promise<Activity> {
  const activityId = activity.id
  const activityData = (activity.data as any) || {}
  const trackingMode = activityData.trackingMode || 'automatic'

  // We only support background sync for automatic mode
  if (trackingMode !== 'automatic') {
    return activity
  }

  const participants = (activity.participants as any[]) || []
  const characterId = participants[0]?.characterId
  if (!characterId) {
    logger.warn(component, `No character ID found for activity ${activityId}`)
    return activity
  }

  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      logger.error(component, `No access token found for character ${characterId} in activity ${activityId}`)
      return activity
    }

    const locationData = await getCharacterLocation(characterId, accessToken)
    const location = locationData.location || ''
    const solarSystemId = locationData.solar_system_id || 0
    
    // Abyssal systems are either named "Abyssal Deadspace", follow the pattern (AD, ID, RD, CD, ND, TD followed by digits),
    // or have solar_system_id in the 32,000,000 range.
    const isInsideAbyss = 
      location.toLowerCase().includes('abyssal deadspace') || 
      /^[AIRCNT]D\d+$/i.test(location) || 
      (solarSystemId >= 32000000 && solarSystemId < 33000000)

    const runs = (activityData.runs as AbyssalRun[]) || []
    const activeRun = runs.find((r) => r.status === 'active')

    let updatedRuns = [...runs]
    let hasChanges = false

    if (isInsideAbyss && !activeRun) {
      // START RUN
      logger.info(component, `Detected character ${characterId} entered Abyss. Starting run for activity ${activityId}`)
      
      const defaults = activityData.lastRunDefaults || {}
      const newRun: AbyssalRun = {
        id: `abyssal-run-${randomUUID()}`,
        startTime: new Date().toISOString(),
        status: 'active',
        registrationStatus: 'pending',
        tier: defaults.tier || 'T6 (Cataclysmic)',
        weather: defaults.weather || 'Electrical',
        ship: defaults.ship || 'Gila',
        lootValue: 0,
        beforeCargoState: activityData.lastCargoState || '',
      }
      updatedRuns.push(newRun)
      hasChanges = true
    } else if (!isInsideAbyss && activeRun) {
      // END RUN
      logger.info(component, `Detected character ${characterId} exited Abyss. Ending run for activity ${activityId}`)
      updatedRuns = updatedRuns.map((run) =>
        run.id === activeRun.id
          ? {
              ...run,
              status: 'completed' as const,
              endTime: new Date().toISOString(),
              registrationStatus: 'pending' as const,
            }
          : run
      )
      hasChanges = true
    }

    const updatedData = {
      ...activityData,
      runs: updatedRuns,
      lastSyncAt: new Date().toISOString(),
      lastDataAt: hasChanges ? new Date().toISOString() : activityData.lastDataAt,
    }

    return await prisma.activity.update({
      where: { id: activityId },
      data: { data: updatedData },
    })
  } catch (error) {
    logger.error(component, `Failed to sync Abyssal activity ${activityId}`, error)
    throw error
  }
}
