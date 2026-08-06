import type { PrismaClient } from '@prisma/client'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'

type ActivityLike = { type?: string; data?: unknown; startTime?: Date | string }

export const RATTING_COMPLETION_MIN_AGE_MS = 15 * 60 * 1000

export function isRattingTooYoungToDiscard(
  activity: ActivityLike,
  nowMs = Date.now()
): boolean {
  if (activity.type !== 'ratting' || !activity.startTime) return false
  const ageMs = nowMs - new Date(activity.startTime).getTime()
  return ageMs < RATTING_COMPLETION_MIN_AGE_MS
}

export function getActivityGrossIncome(activity: ActivityLike): number {
  return getActivityFinancialMetrics({
    type: activity.type,
    data: activity.data as Record<string, unknown> | null | undefined,
  }).gross
}

export function isZeroGrossActivity(activity: ActivityLike): boolean {
  if (activity.type === 'abyssal') {
    const data = (activity.data || {}) as Record<string, unknown>
    const runs = (data.runs as Array<{ status?: string }>) || []
    const hasProgress = runs.some((run) => run.status !== 'active')
    if (hasProgress) return false
  }

  return getActivityGrossIncome(activity) <= 0
}

export async function discardZeroValueActivity(
  db: Pick<PrismaClient, 'activity'>,
  activityId: string
): Promise<boolean> {
  const activity = await db.activity.findUnique({ where: { id: activityId } })
  if (!activity) return false

  await db.activity.update({
    where: { id: activityId },
    data: {
      status: 'completed',
      endTime: activity.endTime || new Date(),
      isDeleted: true,
      data: {
        ...((activity.data as Record<string, unknown>) || {}),
        discardReason: 'zero_gross_auto',
        discardedAt: new Date().toISOString(),
      },
    },
  })
  return true
}
