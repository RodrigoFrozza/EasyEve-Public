export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { syncRattingWalletForActivity } from '@/lib/activities/ratting-wallet-sync'
import { runMiningActivitySync } from '@/lib/activities/mining-activity-sync'
import { hasPremiumAccess } from '@/lib/utils'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { z } from 'zod'
import { validateLaunchActivityInput, launchActivityTypeSchema } from '@/lib/activities/activity-launch'

const createActivitySchema = z.object({
  type: launchActivityTypeSchema,
  participants: z.array(z.object({
    characterId: z.number()
  }).passthrough()).min(1, 'At least one participant is required'),
  typeId: z.number().optional(),
  region: z.string().optional(),
  space: z.string().optional(),
  characterId: z.number().optional(),
}).passthrough()

export const GET = withErrorHandling(async (request: Request) => {
  const startedAt = Date.now()
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const lightList = searchParams.get('light') === '1'
  const rawPage = Number.parseInt(searchParams.get('page') || '1', 10)
  const rawLimit = Number.parseInt(searchParams.get('limit') || '10', 10)
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 10
  
  const baseWhere: any = { userId: user.id, isDeleted: false }
  if (type) {
    baseWhere.type = type.toLowerCase()
  }

  const completedWhere = { ...baseWhere, status: 'completed' }

  let activeActivities, completedActivities, totalCompleted

  try {
    ;[activeActivities, totalCompleted, completedActivities] = await prisma.$transaction([
      prisma.activity.findMany({
        where: { ...baseWhere, status: 'active' },
        orderBy: { startTime: 'desc' },
        include: { item: true }
      }),
      prisma.activity.count({ where: completedWhere }),
      prisma.activity.findMany({
        where: completedWhere,
        orderBy: { startTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { item: true }
      })
    ])
  } catch (dbError) {
    logger.error('API/activities', 'Failed to fetch activities payload', dbError, {
      userId: user.id,
      type,
      page,
      limit
    })
    throw new AppError(ErrorCodes.DATABASE_ERROR, 'Failed to fetch activities', 500)
  }

  const stripHeavyLogs = <T extends { status: string; data: unknown }>(row: T): T => {
    if (!lightList || row.status !== 'completed') return row
    const d = row.data as Record<string, unknown> | null
    if (!d || typeof d !== 'object' || !Array.isArray(d.logs)) return row
    const { logs, ...rest } = d as { logs: unknown[] } & Record<string, unknown>
    return {
      ...row,
      data: { ...rest, logCount: logs.length },
    } as T
  }

  const payload = {
    active: activeActivities.map(stripHeavyLogs),
    history: completedActivities.map(stripHeavyLogs),
    pagination: {
      total: totalCompleted,
      activeCount: activeActivities.length,
      page,
      limit,
      totalPages: Math.ceil(totalCompleted / limit)
    }
  }

  logger.info('API/activities', 'Fetched activity payload', {
    userId: user.id,
    type,
    page,
    limit,
    activeCount: activeActivities.length,
    historyCount: completedActivities.length,
    durationMs: Date.now() - startedAt,
  })

  return payload
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await validateBody(request, createActivitySchema)
  const {
    type,
    typeId,
    region,
    space,
    participants,
    characterId,
    ...extraData
  } = body
  const typeLower = type.toLowerCase()

  const launchValidation = validateLaunchActivityInput({
    type: typeLower,
    participants,
    region,
    space,
    data: extraData as Record<string, unknown>,
  })
  if (!launchValidation.isValid) {
    await prisma.securityEvent.create({
      data: {
        event: 'ACTIVITY_LAUNCH_REJECTED',
        userId: user.id,
        path: '/api/activities',
        details: {
          reason: launchValidation.issues[0] || 'invalid_configuration',
          type: typeLower,
        },
      },
    })
    throw new AppError(ErrorCodes.VALIDATION_FAILED, launchValidation.issues[0] || 'Invalid activity configuration', 400)
  }

  const rawParticipantIds = participants.map((p: { characterId: number }) => p.characterId)
  const uniqueParticipantIds = [...new Set(rawParticipantIds)]
  if (uniqueParticipantIds.length !== rawParticipantIds.length) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Duplicate participant characters are not allowed', 400)
  }

  const ownedCharacters = await prisma.character.findMany({
    where: { userId: user.id, id: { in: uniqueParticipantIds } }
  })

  if (ownedCharacters.length !== uniqueParticipantIds.length) {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      'Invalid participants: every character must belong to your account',
      400
    )
  }

  const idToChar = new Map(ownedCharacters.map(c => [c.id, c]))

  const trimOptionalString = (value: unknown, maxLen: number): string | undefined => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return trimmed.slice(0, maxLen)
  }

  const sanitizedParticipants = participants.map((p: Record<string, unknown>) => {
    const cid = p.characterId as number
    const c = idToChar.get(cid)
    if (!c) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Invalid participant character', 400)
    }
    const fit = trimOptionalString(p.fit, 512)
    const fitName = trimOptionalString(p.fitName, 512)
    const shipTypeId =
      typeof p.shipTypeId === 'number' && Number.isFinite(p.shipTypeId) ? (p.shipTypeId as number) : undefined

    return {
      characterId: c.id,
      characterName: c.name,
      ...(fit !== undefined ? { fit } : {}),
      ...(fitName !== undefined ? { fitName } : {}),
      ...(shipTypeId !== undefined ? { shipTypeId } : {}),
    }
  })

  // Check if module is active
  const moduleConfig = await prisma.modulePrice.findUnique({
    where: { module: type.toLowerCase() }
  })
  
  if (moduleConfig && !moduleConfig.isActive) {
    await prisma.securityEvent.create({
      data: {
        event: 'ACTIVITY_LAUNCH_REJECTED',
        userId: user.id,
        path: '/api/activities',
        details: {
          reason: 'module_disabled',
          type: typeLower,
        },
      },
    })
    throw new AppError(ErrorCodes.API_FORBIDDEN, `Module ${type} is currently disabled by administrator.`, 403)
  }

  // User-level activity whitelist check removed. 
  // Per user requirements, everyone has access to all modules explicitly available via admin.
  // Global deactivation is handled by the moduleConfig.isActive check above.

  // Check characters engaged in active activities
  const characterIds = sanitizedParticipants.map((p) => p.characterId)
  
  const activeActivities = await prisma.activity.findMany({
    where: {
      userId: user.id,
      status: 'active'
    }
  })

  // Premium limits verification
  const hasPremium = hasPremiumAccess({ subscriptionEnd: user.subscriptionEnd, isTester: user.isTester })
  if (!hasPremium) {
    if (participants.length > 1) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'Free plan is limited to 1 character per activity. Upgrade to Premium to track fleets!', 403)
    }
    
    if (activeActivities.length > 0) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'Free plan is limited to 1 simultaneous activity. Upgrade to Premium to track multiple activities!', 403)
    }
  }

  // Check if any character matches currently active ones
  const activeCharIds = activeActivities.flatMap((a: any) => 
    (a.participants as any[]).map((p: any) => p.characterId)
  )

  const busyChars = characterIds.filter((id: number) => activeCharIds.includes(id))
  if (busyChars.length > 0) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, `Character(s) ${busyChars.join(', ')} are already in an active activity`, 400)
  }

  const activity = await prisma.activity.create({
    data: {
      userId: user.id,
      characterId: characterId || characterIds[0],
      type,
      typeId,
      region,
      space,
      status: 'active',
      startTime: new Date().toISOString(),
      data: extraData as any,
      participants: sanitizedParticipants as any
    },
    include: {
      item: true
    }
  })

  if (typeLower === 'mining' || typeLower === 'ratting') {
    void (async () => {
      try {
        if (typeLower === 'ratting') {
          await syncRattingWalletForActivity(activity)
        } else {
          await runMiningActivitySync({
            userId: user.id,
            activityId: activity.id,
            mode: 'initial',
          })
        }
      } catch (e) {
        logger.error('ACTIVITY', `Initial ${typeLower} sync failed`, e)
      }
    })()
  }

  return activity
})
