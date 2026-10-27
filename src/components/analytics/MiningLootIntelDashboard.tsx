'use client'

import { useState } from 'react'
import { MINING_TYPES, SPACE_TYPES } from '@/lib/constants/activity-data'
import { useMiningLootIntel } from '@/lib/hooks/use-mining-loot-intel'
import { LootIntelDashboard, type LootIntelFilterDef } from './LootIntelDashboard'

const ALL = '__all__'

export function MiningLootIntelDashboard() {
  const [category, setCategory] = useState(ALL)
  const [space, setSpace] = useState(ALL)

  const { data, loading, error, refetch } = useMiningLootIntel({
    scope: 'global',
    category: category === ALL ? undefined : category,
    space: space === ALL ? undefined : space,
  })

  const filterDefs: LootIntelFilterDef[] = [
    {
      id: 'category',
      labelKey: 'activity.mining.miningType',
      allLabelKey: 'activity.mining.intel.allCategories',
      options: MINING_TYPES,
      value: category,
      onChange: setCategory,
    },
    {
      id: 'space',
      labelKey: 'activity.intel.spaceFilter',
      allLabelKey: 'activity.intel.allSpaces',
      options: SPACE_TYPES,
      value: space,
      onChange: setSpace,
    },
  ]

  return (
    <LootIntelDashboard
      activityType="mining"
      trackerHref="/dashboard/activity?type=mining"
      titleKey="activity.mining.intel.pageTitle"
      subtitleKey="activity.mining.intel.pageSubtitle"
      dimensionTitleKey="activity.mining.intel.categoryRankingTitle"
      lootTableTitleKey="activity.mining.intel.lootTableTitle"
      dimensionLabelKey="activity.mining.miningType"
      eventsLabelKey="activity.intel.events"
      avgPerEventKey="activity.intel.avgPerEvent"
      data={data}
      loading={loading}
      error={error}
      refetch={refetch}
      filters={filterDefs}
    />
  )
}
