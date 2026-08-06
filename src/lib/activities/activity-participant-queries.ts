import { prisma } from '@/lib/prisma'
import type { Activity } from '@prisma/client'

export async function hasActiveActivityForCharacter(
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

export async function hasActiveEscalationsForCharacter(
  userId: string,
  characterId: number
): Promise<Activity | null> {
  return hasActiveActivityForCharacter(userId, characterId, 'escalations')
}

/**
 * Most recent completed ratting/escalations session's endTime for a character, if any.
 * Used to stop auto-detection from re-absorbing journal entries already attributed
 * to a session that just finished (which would double-count the same ISK in both).
 */
export async function getLastCompletedRattingEndTimeForCharacter(
  userId: string,
  characterId: number
): Promise<Date | null> {
  const activity = await prisma.activity.findFirst({
    where: {
      userId,
      type: { in: ['ratting', 'escalations'] },
      status: 'completed',
      isDeleted: false,
      endTime: { not: null },
      participants: {
        path: [],
        array_contains: [{ characterId }],
      },
    },
    orderBy: { endTime: 'desc' },
    select: { endTime: true },
  })
  return activity?.endTime ?? null
}
