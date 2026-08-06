import { logger } from '@/lib/server-logger'
import { ingestSalvagingActivity } from '@/lib/analytics/salvaging-intel-ingest'
import { ingestRattingLootActivity } from '@/lib/analytics/ratting-loot-intel-ingest'
import { ingestMiningLootActivity } from '@/lib/analytics/mining-loot-intel-ingest'
import { ingestExplorationLootActivity } from '@/lib/analytics/exploration-loot-intel-ingest'
import { ingestAbyssalLootActivity } from '@/lib/analytics/abyssal-loot-intel-ingest'

export type ActivityForLootIntel = {
  id: string
  userId: string
  type: string
  status: string
  region?: string | null
  space?: string | null
  startTime: Date
  endTime?: Date | null
  data: unknown
  isPaused?: boolean
  accumulatedPausedTime?: number | null
  pausedAt?: Date | null
}

export type LootIntelIngestOptions = {
  reconcile?: boolean
}

export function scheduleLootIntelIngest(
  activity: ActivityForLootIntel,
  options?: LootIntelIngestOptions
) {
  if (activity.status !== 'completed') return

  const run = async () => {
    switch (activity.type) {
      case 'salvaging':
        return ingestSalvagingActivity(activity, { reconcile: options?.reconcile })
      case 'ratting':
        return ingestRattingLootActivity(activity, { reconcile: options?.reconcile })
      case 'mining':
        return ingestMiningLootActivity(activity, { reconcile: options?.reconcile })
      case 'exploration':
        return ingestExplorationLootActivity(activity, { reconcile: options?.reconcile })
      case 'abyssal':
        return ingestAbyssalLootActivity(activity, { reconcile: options?.reconcile })
      default:
        return null
    }
  }

  void run().catch((err) => {
    logger.error('loot-intel', `Failed to ingest completed ${activity.type} activity`, err, {
      activityId: activity.id,
    })
  })
}
