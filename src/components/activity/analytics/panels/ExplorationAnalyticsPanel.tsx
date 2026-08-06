'use client'

import { useMemo, useState } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { ACTIVITY_COLORS } from '@/lib/constants/activity-colors'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { useTranslations } from '@/i18n/hooks'
import {
  buildCharacterBreakdown,
  buildExplorationComposition,
  buildExplorationTimelines,
  buildSessionTimeline,
  getCharacterKey,
  type SparklineDataset,
} from '@/lib/activity/activity-analytics'
import { formatCurrencyValue } from '@/lib/utils'
import { useExplorationLootIntel } from '@/lib/hooks/use-exploration-loot-intel'
import { LootIntelSessionBlock } from '../LootIntelSessionBlock'
import { useActivityAnalytics } from '../useActivityAnalytics'
import { ActivityAnalyticsCharacterFilter } from '../ActivityAnalyticsCharacterFilter'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { ActivityAnalyticsBreakdownList } from '../ActivityAnalyticsBreakdownList'

export function ExplorationAnalyticsPanel({ activity }: { activity: Activity }) {
  const { t } = useTranslations()
  const activityType: 'exploration' | 'salvaging' =
    activity.type === 'salvaging' ? 'salvaging' : 'exploration'
  const theme = getActivityTheme(activityType)
  const colors = ACTIVITY_COLORS[activityType]
  const { data: globalIntel, loading: globalLoading } = useExplorationLootIntel(
    { scope: 'global' },
    activity.type === 'exploration'
  )
  const { logs } = useActivityAnalytics(activity)
  const [selectedCharacter, setSelectedCharacter] = useState('all')

  const byCharacter = useMemo(
    () => buildCharacterBreakdown(activity, logs, 'exploration'),
    [activity, logs]
  )

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((l) => getCharacterKey(l) === selectedCharacter)
  }, [logs, selectedCharacter])

  const timelinePoints = useMemo(
    () => buildSessionTimeline(activity, filteredLogs, 'exploration'),
    [activity, filteredLogs]
  )

  const chartDatasets = useMemo((): SparklineDataset[] => {
    const tl = buildExplorationTimelines(filteredLogs)
    if (tl.total.length < 2) return []
    return [
      { label: t('activity.exploration.analytics.chartTotal'), data: tl.total, color: colors.sparkline },
      { label: t('activity.exploration.analytics.chartRelic'), data: tl.relic, color: '#fb923c' },
      { label: t('activity.exploration.analytics.chartData'), data: tl.data, color: '#fbbf24' },
    ].filter((d) => d.data.length >= 2)
  }, [filteredLogs, colors.sparkline, t])

  const composition = useMemo(
    () => buildExplorationComposition(filteredLogs),
    [filteredLogs]
  )

  const pilotRows = byCharacter.map((c) => ({
    id: c.id,
    primary: c.name,
    value: formatCurrencyValue(c.total),
    subValue: `${formatCurrencyValue(c.iskPerHour)}/h`,
  }))

  return (
    <div className="space-y-4">
      <ActivityAnalyticsCharacterFilter
        theme={theme}
        characters={byCharacter}
        selectedId={selectedCharacter}
        onSelect={setSelectedCharacter}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityAnalyticsChart theme={theme} points={timelinePoints} datasets={chartDatasets} />
        </div>
        <ActivityAnalyticsComposition theme={theme} slices={composition} />
      </div>
      <ActivityAnalyticsBreakdownList theme={theme} titleKey="personnelMetrics" rows={pilotRows} />

      {activity.type === 'exploration' && (
        <LootIntelSessionBlock
          theme={theme}
          intelHref="/dashboard/analytics/exploration"
          viewFullIntelKey="activity.exploration.intel.viewFullIntel"
          sessionVsCommunityKey="activity.exploration.intel.sessionVsCommunity"
          dimensionLabel=""
          communityAvgKey="activity.exploration.intel.communityAvgPerEvent"
          topDropsKey="activity.exploration.intel.topDropsGlobal"
          data={globalIntel}
          loading={globalLoading}
        />
      )}
    </div>
  )
}
