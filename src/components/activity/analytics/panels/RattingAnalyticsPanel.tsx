'use client'

import { useMemo, useState } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  buildCharacterBreakdown,
  buildRattingComposition,
  buildRattingTimelines,
  buildSessionTimeline,
  getCharacterKey,
  getRattingLogSignedValue,
  RATTING_ANALYTICS_COLORS,
  type SparklineDataset,
} from '@/lib/activity/activity-analytics'
import { formatCurrencyValue } from '@/lib/utils'
import { getRattingNpcFaction } from '@/lib/constants/activity-data'
import { useRattingLootIntel } from '@/lib/hooks/use-ratting-loot-intel'
import { useTranslations } from '@/i18n/hooks'
import { LootIntelSessionBlock } from '../LootIntelSessionBlock'
import { useActivityAnalytics } from '../useActivityAnalytics'
import { ActivityAnalyticsCharacterFilter } from '../ActivityAnalyticsCharacterFilter'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { ActivityAnalyticsBreakdownList } from '../ActivityAnalyticsBreakdownList'

export function RattingAnalyticsPanel({ activity }: { activity: Activity }) {
  const theme = getActivityTheme('ratting')
  const colors = RATTING_ANALYTICS_COLORS
  const { t } = useTranslations()
  const faction = getRattingNpcFaction(activity)
  const { data: globalIntel, loading: globalLoading } = useRattingLootIntel(
    { scope: 'global', faction: faction || undefined },
    Boolean(faction)
  )
  const { logs, metrics } = useActivityAnalytics(activity)
  const [selectedCharacter, setSelectedCharacter] = useState('all')

  const data = (activity.data || {}) as Record<string, unknown>

  const byCharacter = useMemo(
    () =>
      buildCharacterBreakdown(activity, logs, 'ratting', {
        getValue: getRattingLogSignedValue,
      }),
    [activity, logs]
  )

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((l) => getCharacterKey(l) === selectedCharacter)
  }, [logs, selectedCharacter])

  const timelinePoints = useMemo(
    () => buildSessionTimeline(activity, filteredLogs, 'ratting', getRattingLogSignedValue),
    [activity, filteredLogs]
  )

  const chartDatasets = useMemo((): SparklineDataset[] => {
    const tl = buildRattingTimelines(filteredLogs)
    if (tl.net.length < 2) return []

    const netLabel = t('activity.ratting.analytics.chartNet')
    const datasets: SparklineDataset[] = [
      { label: t('activity.ratting.analytics.chartBounty'), data: tl.bounty, color: colors.bounty },
      { label: t('activity.ratting.analytics.chartEss'), data: tl.ess, color: colors.ess },
      { label: t('activity.ratting.analytics.chartLoot'), data: tl.loot, color: colors.loot },
      {
        label: t('activity.ratting.analytics.chartEscalation'),
        data: tl.escalation,
        color: colors.escalation,
      },
      {
        label: netLabel,
        data: tl.net,
        color: colors.net,
        strokeWidth: 2.75,
      },
    ].filter((d) => d.data.length >= 2)

    return datasets
  }, [filteredLogs, colors, t])

  const composition = useMemo(() => buildRattingComposition(filteredLogs), [filteredLogs])

  const netLabel = t('activity.ratting.analytics.chartNet')

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
          <ActivityAnalyticsChart
            theme={theme}
            points={timelinePoints}
            datasets={chartDatasets}
            emphasizeLabel={netLabel}
          />
        </div>
        <ActivityAnalyticsComposition
          theme={theme}
          slices={composition}
          grossTotal={selectedCharacter === 'all' ? metrics.totalRevenue : undefined}
          netTotal={selectedCharacter === 'all' ? metrics.netProfit : undefined}
        />
      </div>
      <ActivityAnalyticsBreakdownList theme={theme} titleKey="unitBreakdown" rows={pilotRows} />

      <LootIntelSessionBlock
        theme={theme}
        intelHref="/dashboard/analytics/ratting"
        viewFullIntelKey="activity.ratting.intel.viewFullIntel"
        sessionVsCommunityKey="activity.ratting.intel.sessionVsCommunity"
        dimensionLabel={faction ? t('activity.ratting.npcFaction') : ''}
        communityAvgKey="activity.ratting.intel.communityAvgPerHour"
        topDropsKey="activity.ratting.intel.topDropsGlobal"
        data={globalIntel}
        loading={globalLoading}
        showIskPerHour
        sessionMetrics={[
          {
            label: t('activity.analytics.kpi.bounty'),
            value: formatCurrencyValue(
              (Number(data.automatedBounties) || 0) + (Number(data.additionalBounties) || 0)
            ),
          },
          {
            label: t('activity.analytics.kpi.loot'),
            value: formatCurrencyValue(
              (Number(data.estimatedLootValue) || 0) + (Number(data.estimatedSalvageValue) || 0)
            ),
          },
          {
            label: t('activity.analytics.kpi.escalations'),
            value: formatCurrencyValue(Number(data.estimatedEscalationValue) || 0),
          },
          {
            label: t('activity.analytics.kpi.expenses'),
            value:
              Number(data.estimatedExpenseValue) > 0
                ? `-${formatCurrencyValue(Number(data.estimatedExpenseValue))}`
                : '—',
          },
        ]}
      />
    </div>
  )
}
