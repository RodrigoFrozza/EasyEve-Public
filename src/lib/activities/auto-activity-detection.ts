import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'
import { getCharacterMiningLedger, getCharacterWalletJournal, getCharacterLocation } from '@/lib/esi'
import { resolveSystemGeo } from '@/lib/mining-system-geo'
import { inferNpcFactionFromRegion } from '@/lib/constants/region-npc-factions'
import {
  buildEntryMapForDate,
  readMiningDetectionCache,
  refreshMiningDetectionCacheForActivity,
  sumEntryQuantities,
  writeMiningDetectionCache,
} from '@/lib/esi/mining-ledger'
import { logger } from '@/lib/server-logger'
import { getErrorCode } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { ESI_REF_TYPES } from '@/lib/constants/activity-data'
import {
  ACTIVITY_STALE_PAUSE_THRESHOLD_MS,
  ACTIVITY_TERMINATION_THRESHOLD_MS,
  backfillProgressTimestamps,
  getLastActivityInstantForAudit,
  isSafeAutoPauseInstant,
  resolveProgressInstantForPause,
  resolveStalePauseInstant,
} from './activity-automation-policy'
import { syncRattingWalletForActivity } from '@/lib/activities/ratting-wallet-sync'
import { runMiningActivitySync } from '@/lib/activities/mining-activity-sync'
import {
  buildRattingLogFromJournalEntry,
  classifyRattingJournalRefType,
} from '@/lib/activities/ratting-log-dedup'
import {
  discardZeroValueActivity,
  isRattingTooYoungToDiscard,
  isZeroGrossActivity,
} from '@/lib/activities/activity-completion-policy'
import { scheduleLootIntelIngest } from '@/lib/analytics/loot-intel-dispatch'
import {
  hasActiveActivityForCharacter,
  hasActiveEscalationsForCharacter,
  getLastCompletedRattingEndTimeForCharacter,
} from '@/lib/activities/activity-participant-queries'
import { hasTrackableTag, TRACKABLE_TAGS } from '@/lib/activities/trackable-tags'
import { getRattingRollingWindowStart } from '@/lib/activities/ratting-detection-window'
import type { Character, Activity } from '@prisma/client'

const COMPONENT = 'AutoActivityDetection'
const CONCURRENT_BATCH_SIZE = 5
const STALE_AUDIT_DEDUPE_MS = 5 * 60 * 1000

let lastStaleAuditAtMs = 0

// One re-auth notification per character+type per day — the detector runs every
// ~15 min, so without this it would spam a broken token every cycle.
const DETECTION_AUTH_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000

const ESI_AUTH_ERROR_CODES = new Set<string>([
  ErrorCodes.ESI_NO_TOKEN,
  ErrorCodes.ESI_TOKEN_EXPIRED,
  ErrorCodes.ESI_TOKEN_INVALID,
  ErrorCodes.API_UNAUTHORIZED,
  ErrorCodes.API_FORBIDDEN,
])

/** True when an ESI error means the character must re-authenticate (bad token / missing scope). */
function isEsiAuthError(err: unknown): boolean {
  const status =
    (err as { response?: { status?: number } })?.response?.status ??
    (err as { status?: number })?.status
  if (status === 401 || status === 403) return true
  const code = getErrorCode(err)
  return code != null && ESI_AUTH_ERROR_CODES.has(code)
}

/**
 * Surfaces a silent detection auth failure to the user instead of swallowing it
 * (CLAUDE.md rule 3 — same class as the 26-day-mute payment bug). Deduped per
 * character+type per day via sdeCache so the 15-min detector doesn't spam.
 */
async function notifyDetectionAuthFailureOnce(
  userId: string,
  characterId: number,
  characterName: string,
  activityType: string
): Promise<void> {
  const key = `detect_auth_fail_notif:${characterId}:${activityType}`
  try {
    const cached = await prisma.sdeCache.findUnique({ where: { key } })
    const lastMs =
      cached?.value && typeof cached.value === 'object' && !Array.isArray(cached.value)
        ? Number((cached.value as { at?: number }).at) || 0
        : 0
    if (Date.now() - lastMs < DETECTION_AUTH_NOTIFY_COOLDOWN_MS) return

    const label = activityType === ACTIVITY_TYPES.MINING ? 'mineração' : 'ratting'
    await prisma.notification.create({
      data: {
        userId,
        type: 'system',
        title: 'Reautenticação necessária',
        content: `Não foi possível ler a atividade de ${label} de ${characterName} — o acesso ESI expirou ou falta permissão. Faça login novamente autorizando todos os scopes para voltar a rastrear automaticamente.`,
        link: '/dashboard/characters',
      },
    })
    await prisma.sdeCache.upsert({
      where: { key },
      create: { key, value: { at: Date.now() } },
      update: { value: { at: Date.now() } },
    })
    logger.warn(
      COMPONENT,
      `Detection auth failure surfaced for ${characterName} (${characterId}) [${activityType}]`
    )
  } catch (err) {
    logger.error(COMPONENT, `Failed to notify detection auth failure for ${characterId}`, err)
  }
}

async function tryRattingWalletSyncBeforeAudit(
  activity: Activity
): Promise<{ activity: Activity; syncFailed: boolean }> {
  if (activity.type !== ACTIVITY_TYPES.RATTING) return { activity, syncFailed: false }
  try {
    return { activity: await syncRattingWalletForActivity(activity), syncFailed: false }
  } catch (err) {
    logger.warn(COMPONENT, `Pre-audit ratting wallet sync failed for ${activity.id}`, err)
    // Signal failure so the caller does NOT discard on stale data — the real ISK
    // may simply not be synced yet (same silent-failure class as the Holding bug).
    return { activity, syncFailed: true }
  }
}

async function applyProgressBackfillIfNeeded(activity: Activity): Promise<Activity> {
  const backfilled = backfillProgressTimestamps(activity, { allowUpdatedAtFallback: true })
  if (!backfilled) return activity

  const updated = await prisma.activity.update({
    where: { id: activity.id },
    data: { data: backfilled as object },
  })
  logger.info(COMPONENT, `[AUDIT] Backfilled lastDataAt for ${activity.type} activity ${activity.id}`)
  return updated
}

const ACTIVITY_TYPES = {
  MINING: 'mining',
  RATTING: 'ratting',
} as const

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
          // Quantities and baselines are recalculated by post-consolidation sync.
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

      if (type === ACTIVITY_TYPES.MINING) {
        try {
          await runMiningActivitySync({
            userId,
            activityId: canonical.id,
            mode: 'regular',
          })
        } catch (error) {
          logger.error(COMPONENT, 'Post-consolidation mining sync failed', error, {
            activityId: canonical.id,
            userId,
          })
        }
      }
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
  const { id: characterId, name: characterName, userId } = character

  try {
    const { accessToken, error: tokenError } = await getValidAccessToken(characterId)
    if (!accessToken) {
      if (tokenError) {
        await notifyDetectionAuthFailureOnce(userId, characterId, characterName, ACTIVITY_TYPES.MINING)
      }
      return { detected: false }
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const ledger = await getCharacterMiningLedger(characterId, accessToken)

    if (ledger === null) return { detected: false }

    const todayEntries = ledger.filter((entry) => entry.date === today)
    const currentEntries = buildEntryMapForDate(characterId, todayEntries, today)
    const currentTotal = sumEntryQuantities(currentEntries)

    const previousCache = await readMiningDetectionCache(characterId, today)
    const previousEntries = previousCache?.entries ?? {}
    const previousTotal = previousCache ? previousCache.aggregateQty : null

    if (todayEntries.length === 0) {
      await writeMiningDetectionCache(characterId, today, {})
      return { detected: false }
    }

    const hasIncreased =
      previousTotal !== null && currentTotal > previousTotal + 0.1

    await writeMiningDetectionCache(characterId, today, currentEntries)

    if (hasIncreased) {
      const delta = Math.max(0, currentTotal - (previousTotal || 0))
      return {
        detected: true,
        data: {
          totalQuantity: delta,
          detectedAt: now.toISOString(),
          startTime: now.toISOString(),
          pendingBaselines: { ...previousEntries },
        },
      }
    }

    return { detected: false }
  } catch (error) {
    logger.error(COMPONENT, `Error detecting mining for ${characterName}`, error)
    return { detected: false }
  }
}

/**
 * Resolves npcFaction/space from the character's current location, so
 * auto-detected ratting sessions don't start with a permanent 'unknown'
 * placeholder. Best-effort: any failure (missing scope, ESI error, region
 * not in the static map) just means the fields stay unset, never a wrong
 * guess or a literal 'unknown' string.
 */
async function resolveNpcFactionFromCharacterLocation(
  characterId: number,
  accessToken: string
): Promise<{ npcFaction?: string; space?: string }> {
  try {
    const location = await getCharacterLocation(characterId, accessToken)
    if (!location.solar_system_id) return {}

    const geoMap = await resolveSystemGeo([location.solar_system_id])
    const geo = geoMap[location.solar_system_id]
    if (!geo) return {}

    const npcFaction = inferNpcFactionFromRegion(geo.regionName, geo.securityBand)

    return {
      ...(npcFaction ? { npcFaction } : {}),
      ...(geo.securityBand ? { space: geo.securityBand } : {}),
    }
  } catch (error) {
    logger.warn(COMPONENT, `Failed to resolve location-based npcFaction for character ${characterId}`, error)
    return {}
  }
}

async function detectRattingActivity(character: Character): Promise<{ detected: boolean; data?: any }> {
  const { id: characterId, name: characterName, userId } = character

  try {
    const { accessToken, error: tokenError } = await getValidAccessToken(characterId)
    if (!accessToken) {
      // A broken/expired token must not silently mean "no ratting" — otherwise a
      // ratter with a dead token never auto-tracks and never learns why.
      if (tokenError) {
        await notifyDetectionAuthFailureOnce(userId, characterId, characterName, ACTIVITY_TYPES.RATTING)
      }
      return { detected: false }
    }

    const now = new Date()
    const thirtyMinutesAgo = getRattingRollingWindowStart(now)

    // Never re-absorb journal entries already attributed to a session that just
    // completed — otherwise the same bounty/ESS/tax gets counted again in a brand
    // new auto-detected session covering the same time range.
    const lastCompletedEndTime = await getLastCompletedRattingEndTimeForCharacter(userId, characterId)
    const windowStart =
      lastCompletedEndTime && lastCompletedEndTime > thirtyMinutesAgo
        ? lastCompletedEndTime
        : thirtyMinutesAgo

    // Fetch recent journal entries - fetch back to 30 mins ago to ensure we capture the start
    const journal = await getCharacterWalletJournal(characterId, thirtyMinutesAgo)

    const relevantEntries = (journal || [])
      .filter((entry: any) => {
        const entryDate = new Date(entry.date)
        const refType = (entry.ref_type || '').toLowerCase()

        const isBounty = ESI_REF_TYPES.BOUNTY.some(t => refType === t || refType.includes(t))
        const isEss = ESI_REF_TYPES.ESS.some(t => refType === t || refType.includes(t))
        const isTax = ESI_REF_TYPES.TAX.some(t => refType === t || refType.includes(t))

        return entryDate > windowStart && (isBounty || isEss || isTax)
      })
      .map((entry: any) => {
        const refType = (entry.ref_type || '').toLowerCase()
        const type = classifyRattingJournalRefType(refType) ?? 'bounty'

        return buildRattingLogFromJournalEntry(entry, characterId, characterName, type)
      })

    if (relevantEntries.length > 0) {
      const automatedBounties = relevantEntries
        .filter(e => e.type === 'bounty')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
      
      const automatedEss = relevantEntries
        .filter(e => e.type === 'ess')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

      const automatedTaxes = relevantEntries
        .filter(e => e.type === 'tax')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

      // Find earliest entry date to set as activity start time
      const earliestDate = relevantEntries.reduce((min, e) => {
        const d = new Date(e.date).getTime()
        return d < min ? d : min
      }, now.getTime())

      const locationFaction = await resolveNpcFactionFromCharacterLocation(characterId, accessToken)

      return {
        detected: true,
        data: {
          logs: relevantEntries,
          automatedBounties,
          automatedEss,
          automatedTaxes,
          detectedAt: now.toISOString(),
          startTime: new Date(earliestDate).toISOString(),
          ...locationFaction,
        },
      }
    }

    return { detected: false }
  } catch (error) {
    if (isEsiAuthError(error)) {
      await notifyDetectionAuthFailureOnce(userId, characterId, characterName, ACTIVITY_TYPES.RATTING)
    }
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

  const processedCharIdsByType: Record<string, Set<number>> = {
    mining: new Set(),
    ratting: new Set(),
  }

  for (const char of characters) {
    for (const { tag, type } of TRACKABLE_TAGS) {
      if (processedCharIdsByType[type].has(char.id)) continue

      const tagKind = tag === 'miner' ? 'miner' : 'ratter'
      if (!hasTrackableTag(char.tags as string[], tagKind)) {
        logger.debug(
          COMPONENT,
          `Character ${char.name} (${char.id}) lacks tag '${tag}' for ${type} tracking`
        )
        continue
      }

      if (type === ACTIVITY_TYPES.RATTING) {
        const activeEscalations = await hasActiveEscalationsForCharacter(userId, char.id)
        // A *paused* escalations session must block ratting auto-create too — it will
        // eventually resume and its own wallet sync will re-absorb the same bounty
        // journal entries a freshly auto-created ratting session just claimed,
        // double-counting the same ISK across both activity types.
        if (activeEscalations) {
          logger.debug(
            COMPONENT,
            `Character ${char.name} has ${activeEscalations.isPaused ? 'paused' : 'active'} escalations session (${activeEscalations.id}); skipping ratting auto-create`
          )
          processedCharIdsByType[type].add(char.id)
          continue
        }
      }

      const existingActivity = await hasActiveActivityForCharacter(userId, char.id, type)

      // If there is an active (non-paused) activity, we skip to avoid duplicates
      if (existingActivity && !existingActivity.isPaused) {
        logger.debug(
          COMPONENT,
          `Character ${char.name} is already in an active ${type} activity (${existingActivity.id})`
        )
        processedCharIdsByType[type].add(char.id)
        continue
      }

      let detectionResult: { detected: boolean; data?: Record<string, unknown> }
      if (type === ACTIVITY_TYPES.MINING) {
        detectionResult = await detectMiningActivity(char)
      } else {
        detectionResult = await detectRattingActivity(char)
      }

      if (detectionResult.detected && detectionResult.data) {
        const detectionData = detectionResult.data
        if (existingActivity && existingActivity.isPaused) {
          // Resume existing paused activity
          // We use retrospective resume: the pause ended when the FIRST new event happened
          const startTimeValue = detectionData.startTime
          const resumeTime =
            typeof startTimeValue === 'string' || typeof startTimeValue === 'number'
              ? new Date(startTimeValue)
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
          detectedByType[type].push({ char, data: detectionData })
        }
        processedCharIdsByType[type].add(char.id)
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
        incrementalData.pendingBaselines = detectedChars.reduce(
          (acc, d) => ({ ...acc, ...(d.data.pendingBaselines || {}) }),
          {}
        )
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
        updatedData.pendingBaselines = {
          ...(currentData.pendingBaselines || {}),
          ...incrementalData.pendingBaselines,
        }
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

      if (activityType === ACTIVITY_TYPES.MINING) {
        const newCharIds = detectedChars.map((d) => d.char.id)
        try {
          await runMiningActivitySync({
            userId,
            activityId: existingActivity.id,
            mode: 'initial',
            baselineScope: 'newParticipantsOnly',
            newParticipantCharacterIds: newCharIds,
          })
          await runMiningActivitySync({
            userId,
            activityId: existingActivity.id,
            mode: 'regular',
          })
        } catch (error) {
          logger.error(COMPONENT, 'Initial mining sync failed for late-joining characters', error, {
            activityId: existingActivity.id,
            userId,
          })
        }
      }

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
          .map((d) => new Date(d.data.startTime).getTime())
          .filter((t) => !isNaN(t))
        if (times.length > 0) {
          earliestStartTime = new Date(Math.min(...times))
        }
      } else if (activityType === ACTIVITY_TYPES.MINING) {
        const times = detectedChars
          .map((d) => new Date(d.data.startTime || d.data.detectedAt).getTime())
          .filter((t) => !isNaN(t))
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

      let resolvedSpace: string | undefined
      if (activityType === ACTIVITY_TYPES.RATTING) {
        initialData.logs = detectedChars.flatMap(d => d.data.logs)
        initialData.automatedBounties = detectedChars.reduce((sum, d) => sum + d.data.automatedBounties, 0)
        initialData.automatedEss = detectedChars.reduce((sum, d) => sum + d.data.automatedEss, 0)
        initialData.automatedTaxes = detectedChars.reduce((sum, d) => sum + d.data.automatedTaxes, 0)

        // Best-effort from the character's actual location (see
        // resolveNpcFactionFromCharacterLocation) — left unset rather than a
        // placeholder string when it can't be resolved, so it never gets
        // treated as real data by loot-intel aggregation downstream.
        const resolvedFaction = detectedChars.find((d) => d.data.npcFaction)?.data.npcFaction
        if (resolvedFaction) initialData.npcFaction = resolvedFaction
        resolvedSpace = detectedChars.find((d) => d.data.space)?.data.space
      } else if (activityType === ACTIVITY_TYPES.MINING) {
        initialData.pendingBaselines = detectedChars.reduce(
          (acc, d) => ({ ...acc, ...(d.data.pendingBaselines || {}) }),
          {}
        )
        initialData.hasInitialBaseline = false
      }

      const newActivity = await prisma.activity.create({
        data: {
          userId,
          type: activityType,
          status: 'active',
          participants,
          startTime: earliestStartTime,
          ...(activityType === ACTIVITY_TYPES.RATTING && resolvedSpace ? { space: resolvedSpace } : {}),
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
          await runMiningActivitySync({
            userId,
            activityId: newActivity.id,
            mode: 'regular',
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

/** Run auto-tracking detection for a single user (dashboard refresh, admin, etc.). */
export async function runAutoTrackingForUser(
  userId: string
): Promise<{ started: number; ended: number }> {
  return handleUserAutoTracking(userId)
}

function resolveActivityForStalePreview(activity: Activity): Activity {
  const backfilled = backfillProgressTimestamps(activity, { allowUpdatedAtFallback: true })
  if (!backfilled) return activity
  return { ...activity, data: backfilled as Activity['data'] }
}

export type StaleAuditPreviewAction =
  | { action: 'pause'; activityId: string; type: string; lastActiveMinutes: number; pauseAt: string }
  | { action: 'complete'; activityId: string; type: string; pausedHours: number }
  | { action: 'discard'; activityId: string; type: string; reason: string }
  | { action: 'skip'; activityId: string; type: string; reason: string }

/** Read-only preview for dry-run in admin scripts. */
export async function previewStaleActivityAudit(nowMs: number = Date.now()): Promise<StaleAuditPreviewAction[]> {
  const actions: StaleAuditPreviewAction[] = []
  const now = new Date(nowMs)

  const activeStale = await prisma.activity.findMany({
    where: { status: 'active', isDeleted: false, isPaused: false },
  })

  for (const activity of activeStale) {
    const resolved = resolveActivityForStalePreview(activity)
    const lastActivityTime = getLastActivityInstantForAudit({
      startTime: resolved.startTime,
      data: resolved.data,
      updatedAt: resolved.updatedAt,
    })
    const inactiveMs = nowMs - lastActivityTime.getTime()
    if (inactiveMs <= ACTIVITY_STALE_PAUSE_THRESHOLD_MS) continue

    const pauseInstant = isZeroGrossActivity(activity)
      ? (() => {
          const progress = resolveProgressInstantForPause({
            startTime: resolved.startTime,
            data: resolved.data,
          })
          const candidate = progress ?? lastActivityTime
          return isSafeAutoPauseInstant(resolved, candidate, nowMs) ? candidate : null
        })()
      : resolveStalePauseInstant(
          {
            startTime: resolved.startTime,
            data: resolved.data,
            updatedAt: resolved.updatedAt,
          },
          nowMs
        )

    if (!pauseInstant) {
      if (isZeroGrossActivity(activity)) {
        if (activity.type === 'ratting' && isRattingTooYoungToDiscard(activity, nowMs)) {
          actions.push({
            action: 'skip',
            activityId: activity.id,
            type: activity.type,
            reason: 'ratting session younger than minimum discard age',
          })
        } else {
          actions.push({
            action: 'discard',
            activityId: activity.id,
            type: activity.type,
            reason: 'zero gross income with no safe pause instant',
          })
        }
      } else {
        actions.push({
          action: 'skip',
          activityId: activity.id,
          type: activity.type,
          reason: 'no safe progress instant (would zero session timer)',
        })
      }
      continue
    }

    actions.push({
      action: 'pause',
      activityId: activity.id,
      type: activity.type,
      lastActiveMinutes: Math.floor(inactiveMs / 60000),
      pauseAt: pauseInstant.toISOString(),
    })
  }

  const pausedThreshold = new Date(nowMs - ACTIVITY_TERMINATION_THRESHOLD_MS)
  const pausedStale = await prisma.activity.findMany({
    where: {
      status: 'active',
      isDeleted: false,
      isPaused: true,
      pausedAt: { not: null, lt: pausedThreshold },
    },
  })

  for (const activity of pausedStale) {
    const lastActive = activity.pausedAt ? new Date(activity.pausedAt) : now
    if (isZeroGrossActivity(activity)) {
      if (activity.type === 'ratting' && isRattingTooYoungToDiscard(activity, nowMs)) {
        actions.push({
          action: 'skip',
          activityId: activity.id,
          type: activity.type,
          reason: 'ratting session younger than minimum discard age',
        })
      } else {
        actions.push({
          action: 'discard',
          activityId: activity.id,
          type: activity.type,
          reason: 'zero gross income after 6h pause',
        })
      }
    } else {
      actions.push({
        action: 'complete',
        activityId: activity.id,
        type: activity.type,
        pausedHours: Math.floor((nowMs - lastActive.getTime()) / 3600000),
      })
    }
  }

  return actions
}

/**
 * Global safety audit: Pauses activities inactive for > 60 minutes; completes paused > 6h.
 * Uses the canonical policy from activity-automation-policy.ts.
 */
export async function terminateStaleActivities(options?: { userId?: string }): Promise<number> {
  const now = new Date()
  const nowMs = now.getTime()
  let auditCount = 0
  const userFilter = options?.userId ? { userId: options.userId } : {}

  try {
    logger.info(COMPONENT, 'Starting global safety audit for stale activities...', userFilter)

    // 1. Handle Active -> Paused (60m threshold)
    const activeStale = await prisma.activity.findMany({
      where: {
        status: 'active',
        isDeleted: false,
        isPaused: false,
        ...userFilter,
      },
    })

    for (const activity of activeStale) {
      try {
        let current = await applyProgressBackfillIfNeeded(activity)

        let rattingSyncFailed = false
        if (current.type === ACTIVITY_TYPES.RATTING) {
          const synced = await tryRattingWalletSyncBeforeAudit(current)
          current = synced.activity
          rattingSyncFailed = synced.syncFailed
        }

        const lastActivityTime = getLastActivityInstantForAudit({
          startTime: current.startTime,
          data: current.data,
          updatedAt: current.updatedAt,
        })

        const diffMinutes = Math.floor((nowMs - lastActivityTime.getTime()) / 60000)

        if (nowMs - lastActivityTime.getTime() > ACTIVITY_STALE_PAUSE_THRESHOLD_MS) {
          let pauseInstant: Date | null

          if (isZeroGrossActivity(current)) {
            const progress = resolveProgressInstantForPause({
              startTime: current.startTime,
              data: current.data,
            })
            const candidate = progress ?? lastActivityTime
            pauseInstant = isSafeAutoPauseInstant(current, candidate, nowMs) ? candidate : null
          } else {
            pauseInstant = resolveStalePauseInstant(
              {
                startTime: current.startTime,
                data: current.data,
                updatedAt: current.updatedAt,
              },
              nowMs
            )
          }

          if (!pauseInstant) {
            if (isZeroGrossActivity(current) && !isRattingTooYoungToDiscard(current, nowMs) && !rattingSyncFailed) {
              logger.info(
                COMPONENT,
                `[AUDIT] Discarding stale zero-gross ${current.type} activity ${current.id} (no safe pause instant)`
              )
              await discardZeroValueActivity(prisma, current.id)
              await prisma.notification.create({
                data: {
                  userId: current.userId,
                  type: 'system',
                  title: 'Empty Activity Removed',
                  content: `Your ${current.type} activity with no recorded income was removed after 60 minutes of inactivity.`,
                  link: '/dashboard/activity',
                },
              })
              auditCount++
            } else {
              logger.warn(
                COMPONENT,
                `[AUDIT] Skipping auto-pause for ${current.type} activity ${current.id}: no safe progress instant (would zero session timer)`
              )
            }
            continue
          }

          logger.info(
            COMPONENT,
            `[AUDIT] Pausing stale ${current.type} activity ${current.id} (last active ${diffMinutes}m ago)`
          )

          const existingData = (current.data as Record<string, unknown>) || {}
          const pauseAtIso = pauseInstant.toISOString()
          const dataPatch: Record<string, unknown> = { ...existingData }
          if (!existingData.lastDataAt) {
            dataPatch.lastDataAt = pauseAtIso
          }

          await prisma.activity.update({
            where: { id: current.id },
            data: {
              isPaused: true,
              pausedAt: pauseInstant,
              data: dataPatch as object,
            },
          })

          if (current.type === ACTIVITY_TYPES.MINING) {
            const participants = (current.participants as Array<{ characterId: number }>) || []
            await refreshMiningDetectionCacheForActivity(participants)
          }

          await prisma.notification.create({
            data: {
              userId: current.userId,
              type: 'system',
              title: 'Activity Paused',
              content: `Your ${current.type} activity was automatically paused due to inactivity (60m).`,
              link: `/dashboard/activity?viewId=${current.id}`,
            },
          })

          auditCount++
        }
      } catch (err) {
        logger.error(COMPONENT, `Error pausing stale activity ${activity.id}`, err)
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
        },
        ...userFilter,
      }
    })

    for (const activity of pausedStale) {
      try {
        let current = activity
        let rattingSyncFailed = false
        if (current.type === ACTIVITY_TYPES.RATTING) {
          const synced = await tryRattingWalletSyncBeforeAudit(current)
          current = synced.activity
          rattingSyncFailed = synced.syncFailed
        }

        const lastActive = current.pausedAt ? new Date(current.pausedAt) : new Date()
        const diffHours = Math.floor((nowMs - lastActive.getTime()) / (3600000))

        if (isZeroGrossActivity(current) && !isRattingTooYoungToDiscard(current, nowMs) && !rattingSyncFailed) {
          logger.info(
            COMPONENT,
            `[AUDIT] Discarding stale paused zero-gross ${current.type} activity ${current.id} (paused ${diffHours}h ago)`
          )
          await discardZeroValueActivity(prisma, current.id)
          await prisma.notification.create({
            data: {
              userId: current.userId,
              type: 'system',
              title: 'Empty Activity Removed',
              content: `Your ${current.type} activity with no recorded income was removed after being paused for 6 hours.`,
              link: '/dashboard/activity',
            },
          })
          auditCount++
          continue
        }

        logger.info(
          COMPONENT,
          `[AUDIT] Completing stale paused ${current.type} activity ${current.id} (paused ${diffHours}h ago)`
        )

        const additionalPauseTime = current.pausedAt
          ? now.getTime() - new Date(current.pausedAt).getTime()
          : 0

        const completedActivity = await prisma.activity.update({
          where: { id: current.id },
          data: {
            status: 'completed',
            endTime: now,
            accumulatedPausedTime: (current.accumulatedPausedTime || 0) + additionalPauseTime,
            data: {
              ...((current.data as Record<string, unknown>) || {}),
              autoTerminatedAt: now.toISOString(),
              terminationReason: 'auto_terminated_6h_pause',
            },
          },
        })

        if (current.type === ACTIVITY_TYPES.MINING) {
          const participants = (current.participants as Array<{ characterId: number }>) || []
          await refreshMiningDetectionCacheForActivity(participants)
        }

        scheduleLootIntelIngest(completedActivity)

        await prisma.notification.create({
          data: {
            userId: current.userId,
            type: 'system',
            title: 'Activity Completed',
            content: `Your ${current.type} activity was automatically finished after 6 hours of being paused.`,
            link: `/dashboard/activity?viewId=${current.id}`,
          },
        })

        auditCount++
      } catch (err) {
        logger.error(COMPONENT, `Error completing stale activity ${activity.id}`, err)
      }
    }

    if (auditCount > 0) {
      logger.info(COMPONENT, `[AUDIT] Safety audit complete. Actioned ${auditCount} activities.`)
    }
  } catch (error) {
    logger.error(COMPONENT, 'Global safety audit failed', error)
  }

  return auditCount
}

export function terminateStaleActivitiesForUser(userId: string): Promise<number> {
  return terminateStaleActivities({ userId })
}

const USER_STALE_AUDIT_COOLDOWN_MS = 5 * 60 * 1000
const USER_STALE_AUDIT_CACHE_PREFIX = 'stale_audit_user:'

/** Runs stale pause/complete for one user (throttled). Safe to call from activity API polling. */
export async function maybeRunStaleAuditForUser(userId: string): Promise<void> {
  const cacheKey = `${USER_STALE_AUDIT_CACHE_PREFIX}${userId}`
  const cached = await prisma.sdeCache.findUnique({ where: { key: cacheKey } })
  const lastRun =
    cached?.value && typeof cached.value === 'object' && !Array.isArray(cached.value)
      ? Number((cached.value as { at?: number }).at) || 0
      : 0

  if (Date.now() - lastRun < USER_STALE_AUDIT_COOLDOWN_MS) {
    return
  }

  const activeCount = await prisma.activity.count({
    where: { userId, status: 'active', isDeleted: false },
  })
  if (activeCount === 0) {
    return
  }

  await terminateStaleActivitiesForUser(userId)

  await prisma.sdeCache.upsert({
    where: { key: cacheKey },
    create: { key: cacheKey, value: { at: Date.now() } },
    update: { value: { at: Date.now() } },
  })
}

/** Avoid duplicate stale audits when audit-activity-safety and auto-activity-detection run close together. */
export async function terminateStaleActivitiesIfDue(): Promise<number> {
  const nowMs = Date.now()
  if (nowMs - lastStaleAuditAtMs < STALE_AUDIT_DEDUPE_MS) {
    logger.info(COMPONENT, 'Skipping stale audit — already run within dedupe window')
    return 0
  }
  lastStaleAuditAtMs = nowMs
  return terminateStaleActivities()
}

export async function runAutoActivityDetection(): Promise<{ processed: number; started: number; ended: number }> {
  const CACHE_KEY_ROTATION = 'auto_track_rotation'
  const BATCH_SIZE = 50 // Process 50 users per run (increased from 20 for faster coverage)
  const now = new Date()

  try {
    // 1. Terminate stale activities (Global safety) - Run FIRST for guaranteed cleanup
    const endedCount = await terminateStaleActivitiesIfDue()

    // 2. Get rotation state
    const rotationRecord = await prisma.sdeCache.findUnique({ where: { key: CACHE_KEY_ROTATION } })
    const rotation = rotationRecord?.value as { lastIndex: number } | null
    const currentIndex = rotation?.lastIndex || 0

    // 3. Get eligible users
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { subscriptionEnd: { gt: now } },
          { isTester: true },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    if (users.length === 0) return { processed: 0, started: 0, ended: endedCount }

    const activeAutoTracked = await prisma.activity.findMany({
      where: {
        status: 'active',
        isDeleted: false,
        isPaused: false,
        type: { in: [ACTIVITY_TYPES.MINING, ACTIVITY_TYPES.RATTING] },
        data: {
          path: ['isAutoTracked'],
          equals: true,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    })
    const priorityUserIds = activeAutoTracked.map((a) => a.userId)

    const totalUsers = users.length
    const startIndex = currentIndex % totalUsers
    const usersToProcess = users.slice(startIndex, startIndex + BATCH_SIZE)
    
    // Wrap around if needed
    if (usersToProcess.length < BATCH_SIZE && totalUsers > usersToProcess.length) {
      const remaining = BATCH_SIZE - usersToProcess.length
      usersToProcess.push(...users.slice(0, remaining))
    }

    const rotatedIds = usersToProcess.map((u) => u.id)
    const userIds = [...new Set([...priorityUserIds, ...rotatedIds])]
    logger.info(
      COMPONENT,
      `Starting detection for ${userIds.length} users (${priorityUserIds.length} priority, index: ${startIndex})`
    )

    // 4. Process detection for users in batches
    let startedCount = 0
    for (let i = 0; i < userIds.length; i += CONCURRENT_BATCH_SIZE) {
      const batch = userIds.slice(i, i + CONCURRENT_BATCH_SIZE)
      
      // Resilient batch processing: individual user failures don't stop the whole run
      const results = await Promise.allSettled(batch.map(uid => handleUserAutoTracking(uid)))
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          startedCount += result.value.started
        } else {
          logger.error(COMPONENT, `Error processing user tracking`, result.reason)
        }
      }
      
      if (i + CONCURRENT_BATCH_SIZE < userIds.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // 5. Update rotation state
    const nextOffset = (startIndex + userIds.length) % totalUsers
    await prisma.sdeCache.upsert({
      where: { key: CACHE_KEY_ROTATION },
      create: { key: CACHE_KEY_ROTATION, value: { lastIndex: nextOffset, lastRun: now.toISOString() } },
      update: { value: { lastIndex: nextOffset, lastRun: now.toISOString() } }
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