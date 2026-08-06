'use client'

import { useMemo } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { ACTIVITY_COLORS } from '@/lib/constants/activity-colors'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  buildAbyssalRunTimeline,
  buildAbyssalTierComposition,
  type SparklineDataset,
} from '@/lib/activity/activity-analytics'
import { formatCurrencyValue } from '@/lib/utils'
import { useAbyssalLootIntel } from '@/lib/hooks/use-abyssal-loot-intel'
import { useTranslations } from '@/i18n/hooks'
import { LootIntelSessionBlock } from '../LootIntelSessionBlock'
import { useActivityAnalytics } from '../useActivityAnalytics'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { ActivityAnalyticsBreakdownList } from '../ActivityAnalyticsBreakdownList'

export function AbyssalAnalyticsPanel({ activity }: { activity: Activity }) {
  const theme = getActivityTheme('abyssal')
  const colors = ACTIVITY_COLORS.abyssal
  const { t } = useTranslations()
  const data = activity.data as {
    tier?: string
    weather?: string
    lastRunDefaults?: { tier?: string; weather?: string }
  }
  const { runs } = useActivityAnalytics(activity)

  const completedRuns = useMemo(
    () =>
      [...runs]
        .filter((r) => r.status === 'completed' || r.status === 'success')
        .sort(
          (a, b) =>
            new Date(b.endTime || b.startTime).getTime() -
            new Date(a.endTime || a.startTime).getTime()
        ),
    [runs]
  )

  const referenceRun = completedRuns[0]
  const tier = referenceRun?.tier || data?.tier || data?.lastRunDefaults?.tier
  const weather = referenceRun?.weather || data?.weather || data?.lastRunDefaults?.weather
  const { data: globalIntel, loading: globalLoading } = useAbyssalLootIntel(
    { scope: 'global', tier, weather },
    Boolean(tier && weather)
  )

  const timelinePoints = useMemo(
    () => buildAbyssalRunTimeline(activity, runs),
    [activity, runs]
  )

  const chartDatasets = useMemo((): SparklineDataset[] => {
    if (timelinePoints.length < 2) return []
    return [
      {
        label: 'Cumulative ISK',
        data: timelinePoints.map((p) => p.cumulative),
        color: colors.sparkline,
      },
    ]
  }, [timelinePoints, colors.sparkline])

  const composition = useMemo(() => buildAbyssalTierComposition(runs), [runs])

  const runRows = completedRuns.map((run) => {
    const start = new Date(run.startTime).getTime()
    const end = run.endTime ? new Date(run.endTime).getTime() : start
    const durationMin = Math.round((end - start) / 60000)
    return {
      id: run.id,
      primary: `${run.tier || '—'} · ${run.weather || '—'}`,
      secondary: run.ship ? `via ${run.ship}` : undefined,
      value: formatCurrencyValue(run.lootValue || 0),
      subValue: `${durationMin}m`,
    }
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityAnalyticsChart
            theme={theme}
            titleKey="runTimeline"
            points={timelinePoints}
            datasets={chartDatasets}
          />
        </div>
        <ActivityAnalyticsComposition theme={theme} titleKey="tierComposition" slices={composition} />
      </div>
      <ActivityAnalyticsBreakdownList theme={theme} titleKey="runHistory" rows={runRows} maxHeight="h-[240px]" />

      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/abyssal"
        viewFullIntelKey="activity.abyssal.intel.viewFullIntel"
        sessionVsCommunityKey="activity.abyssal.intel.sessionVsCommunity"
        dimensionLabel={tier ? `${t('activity.abyssal.tier')} ${tier}` : ''}
        communityAvgKey="activity.abyssal.intel.communityAvgPerRun"
        topDropsKey="activity.abyssal.intel.topDropsGlobal"
        data={globalIntel}
        loading={globalLoading}
        sessionMetrics={
          tier && weather
            ? [
                { label: t('activity.abyssal.tier'), value: tier },
                { label: t('activity.abyssal.weather'), value: weather },
              ]
            : []
        }
      />
    </div>
  )
}
