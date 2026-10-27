import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { defineTool } from '../types'
import { pageArgs, pageInput, sinceInput, toPage } from './common'

export const listActivities = defineTool({
  name: 'list_activities',
  title: 'List activities',
  description:
    'Activity sessions (MINING, RATTING, ABYSSAL, EXPLORATION, …), newest first. Filter by type, status (active/completed), userId, characterId, since (createdAt) or includeDeleted. The `data` JSON (loot, bounties) is omitted unless includeData.',
  input: z.object({
    type: z.string().optional().describe('e.g. ratting, mining, abyssal, exploration (case-insensitive)'),
    status: z.enum(['active', 'completed']).optional(),
    userId: z.string().optional(),
    characterId: z.number().int().optional(),
    since: sinceInput,
    includeDeleted: z.boolean().default(false),
    includeData: z.boolean().default(false),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ type, status, userId, characterId, since, includeDeleted, includeData, limit, cursor }) => {
    const rows = await prisma.activity.findMany({
      where: {
        // Stored lowercase in practice ('ratting'); match regardless of case.
        ...(type ? { type: { equals: type, mode: 'insensitive' as const } } : {}),
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(characterId !== undefined ? { characterId } : {}),
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      select: {
        id: true,
        userId: true,
        characterId: true,
        type: true,
        status: true,
        startTime: true,
        endTime: true,
        region: true,
        space: true,
        typeId: true,
        participants: true,
        isPaused: true,
        pausedAt: true,
        accumulatedPausedTime: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        data: includeData,
      },
      ...pageArgs(limit, cursor),
    })
    return toPage(rows, limit)
  },
})

export const listPiAlerts = defineTool({
  name: 'list_pi_alerts',
  title: 'List PI alerts',
  description:
    'Planetary Industry alerts (starving_soon, stalled, overflow_soon, full, extractor_expired), most recently triggered first. Open alerts only unless includeResolved.',
  input: z.object({
    userId: z.string().optional(),
    planetId: z.number().int().optional(),
    alertType: z.enum(['starving_soon', 'stalled', 'overflow_soon', 'full', 'extractor_expired']).optional(),
    includeResolved: z.boolean().default(false),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ userId, planetId, alertType, includeResolved, limit, cursor }) => {
    const rows = await prisma.piPlanetAlert.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(planetId !== undefined ? { planetId } : {}),
        ...(alertType ? { alertType } : {}),
        ...(includeResolved ? {} : { resolvedAt: null }),
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ lastTriggeredAt: 'desc' }, { id: 'desc' }],
    })
    return toPage(rows, limit)
  },
})
