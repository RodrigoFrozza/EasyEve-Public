'use client'

import { useState } from 'react'
import { NPC_FACTIONS, SPACE_TYPES } from '@/lib/constants/activity-data'
import { useRattingLootIntel } from '@/lib/hooks/use-ratting-loot-intel'
import { LootIntelDashboard, type LootIntelFilterDef } from './LootIntelDashboard'

const ALL = '__all__'

export function RattingLootIntelDashboard() {
  const [faction, setFaction] = useState(ALL)
  const [space, setSpace] = useState(ALL)

  const { data, loading, error, refetch } = useRattingLootIntel({
    scope: 'global',
    faction: faction === ALL ? undefined : faction,
    space: space === ALL ? undefined : space,
  })

  const filterDefs: LootIntelFilterDef[] = [
    {
      id: 'faction',
      labelKey: 'activity.ratting.npcFaction',
      allLabelKey: 'activity.ratting.intel.allFactions',
      options: [
        ...new Set([...NPC_FACTIONS, ...((data?.filters.factions as string[]) || [])]),
      ],
      value: faction,
      onChange: setFaction,
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
      activityType="ratting"
      trackerHref="/dashboard/activity?type=ratting"
      titleKey="activity.ratting.intel.pageTitle"
      subtitleKey="activity.ratting.intel.pageSubtitle"
      dimensionTitleKey="activity.ratting.intel.factionRankingTitle"
      lootTableTitleKey="activity.ratting.intel.lootTableTitle"
      dimensionLabelKey="activity.ratting.npcFaction"
      eventsLabelKey="activity.intel.events"
      avgPerEventKey="activity.intel.avgPerEvent"
      avgIskHourKey="activity.intel.avgIskPerHour"
      data={data}
      loading={loading}
      error={error}
      refetch={refetch}
      filters={filterDefs}
      sortDimensionBy="iskPerHour"
    />
  )
}
