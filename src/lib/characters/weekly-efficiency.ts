import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

async function computeWeeklyEfficiencyPercent(userId: string): Promise<number> {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + 1)
  weekStart.setHours(0, 0, 0, 0)

  const userActivities = await prisma.activity.findMany({
    where: {
      userId,
      startTime: { gte: weekStart },
    },
    select: {
      startTime: true,
      endTime: true,
      accumulatedPausedTime: true,
      status: true,
      isPaused: true,
    },
  })

  let productiveTime = 0
  for (const activity of userActivities) {
    if (activity.endTime && activity.startTime) {
      const duration =
        activity.endTime.getTime() -
        activity.startTime.getTime() -
        (activity.accumulatedPausedTime || 0)
      if (activity.status === 'completed' || activity.isPaused === false) {
        productiveTime += duration
      }
    }
  }

  const weekMs = now.getTime() - weekStart.getTime()
  return weekMs > 0 ? Math.round((productiveTime / weekMs) * 100) : 0
}

/**
 * Cached weekly efficiency (same semantics as the dashboard characters summary cards).
 * Short revalidate to balance freshness vs. DB load on SSR.
 * Wrapper is created once at module load; `userId` is a cached-function argument.
 */
export const getCachedWeeklyEfficiencyPercent = unstable_cache(
  async (userId: string) => computeWeeklyEfficiencyPercent(userId),
  ['weekly-efficiency-percent'],
  { revalidate: 60 }
)
