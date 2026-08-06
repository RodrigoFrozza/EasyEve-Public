'use client'

import { useExplorationLootIntel } from '@/lib/hooks/use-exploration-loot-intel'
import { LootIntelDashboard } from './LootIntelDashboard'

export function ExplorationLootIntelDashboard() {
  const { data, loading, error, refetch } = useExplorationLootIntel({ scope: 'global' })

  return (
    <LootIntelDashboard
      activityType="exploration"
      trackerHref="/dashboard/activity?type=exploration"
      titleKey="activity.exploration.intel.pageTitle"
      subtitleKey="activity.exploration.intel.pageSubtitle"
      dimensionTitleKey="activity.exploration.intel.globalTitle"
      lootTableTitleKey="activity.exploration.intel.lootTableTitle"
      dimensionLabelKey="activity.exploration.intel.globalBucket"
      eventsLabelKey="activity.intel.events"
      avgPerEventKey="activity.intel.avgPerEvent"
      data={data}
      loading={loading}
      error={error}
      refetch={refetch}
    />
  )
}
