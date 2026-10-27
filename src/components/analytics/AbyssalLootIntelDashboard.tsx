'use client'

import { useState } from 'react'
import { useAbyssalLootIntel } from '@/lib/hooks/use-abyssal-loot-intel'
import { LootIntelDashboard, type LootIntelFilterDef } from './LootIntelDashboard'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'

const ALL = '__all__'

export function AbyssalLootIntelDashboard() {
  const [tier, setTier] = useState(ALL)
  const [weather, setWeather] = useState(ALL)

  const { data, loading, error, refetch } = useAbyssalLootIntel({
    scope: 'global',
    tier: tier === ALL ? undefined : tier,
    weather: weather === ALL ? undefined : weather,
  })

  const tiers = [
    ...new Set([
      ...ABYSSAL_TIERS.map((entry) => entry.label),
      ...((data?.filters.tiers as string[]) || []),
    ]),
  ]
  const weathers = [
    ...new Set([
      ...ABYSSAL_WEATHER.map((entry) => entry.label),
      ...((data?.filters.weathers as string[]) || []),
    ]),
  ]

  const filterDefs: LootIntelFilterDef[] = [
    {
      id: 'tier',
      labelKey: 'activity.abyssal.tier',
      allLabelKey: 'activity.abyssal.intel.allTiers',
      options: tiers,
      value: tier,
      onChange: setTier,
    },
    {
      id: 'weather',
      labelKey: 'activity.abyssal.weather',
      allLabelKey: 'activity.abyssal.intel.allWeathers',
      options: weathers,
      value: weather,
      onChange: setWeather,
    },
  ]

  return (
    <LootIntelDashboard
      activityType="abyssal"
      trackerHref="/dashboard/activity?type=abyssal"
      titleKey="activity.abyssal.intel.pageTitle"
      subtitleKey="activity.abyssal.intel.pageSubtitle"
      dimensionTitleKey="activity.abyssal.intel.runRankingTitle"
      lootTableTitleKey="activity.abyssal.intel.lootTableTitle"
      dimensionLabelKey="activity.abyssal.tier"
      eventsLabelKey="activity.intel.events"
      avgPerEventKey="activity.intel.avgPerRun"
      data={data}
      loading={loading}
      error={error}
      refetch={refetch}
      filters={filterDefs}
    />
  )
}
