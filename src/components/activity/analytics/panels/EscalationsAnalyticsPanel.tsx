'use client'

import { useMemo, useState } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  buildCharacterBreakdown,
  buildEscalationsComposition,
  buildEscalationsTimelines,
  buildSessionTimeline,
  ESCALATIONS_ANALYTICS_COLORS,
  getCharacterKey,
  getEscalationsLogSignedValue,
  type SparklineDataset,
} from '@/lib/activity/activity-analytics'
import { formatCurrencyValue } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useActivityAnalytics } from '../useActivityAnalytics'
import { ActivityAnalyticsCharacterFilter } from '../ActivityAnalyticsCharacterFilter'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { ActivityAnalyticsBreakdownList } from '../ActivityAnalyticsBreakdownList'

export function EscalationsAnalyticsPanel({ activity }: { activity: Activity }) {
  const theme = getActivityTheme('escalations')
  const colors = ESCALATIONS_ANALYTICS_COLORS
  const { t } = useTranslations()
  const { logs, metrics } = useActivityAnalytics(activity)
  const [selectedCharacter, setSelectedCharacter] = useState('all')

  const byCharacter = useMemo(
    () =>
      buildCharacterBreakdown(activity, logs, 'escalations', {
        getValue: getEscalationsLogSignedValue,
      }),
    [activity, logs]
  )

  const filteredLogs = useMemo(() => {
    if (selectedCharacter === 'all') return logs
    return logs.filter((l) => getCharacterKey(l) === selectedCharacter)
  }, [logs, selectedCharacter])

  const timelinePoints = useMemo(
    () =>
      buildSessionTimeline(activity, filteredLogs, 'escalations', getEscalationsLogSignedValue),
    [activity, filteredLogs]
  )

  const chartDatasets = useMemo((): SparklineDataset[] => {
    const tl = buildEscalationsTimelines(filteredLogs)
    if (tl.net.length < 2) return []

    const netLabel = t('activity.escalations.analytics.chartNet')
    return [
      { label: t('activity.escalations.analytics.chartBounty'), data: tl.bounty, color: colors.bounty },
      { label: t('activity.escalations.analytics.chartEss'), data: tl.ess, color: colors.ess },
      { label: t('activity.escalations.analytics.chartLoot'), data: tl.loot, color: colors.loot },
      { label: netLabel, data: tl.net, color: colors.net, strokeWidth: 2.75 },
    ].filter((d) => d.data.length >= 2)
  }, [colors, filteredLogs, t])

  const composition = useMemo(
    () => buildEscalationsComposition(filteredLogs),
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
          <ActivityAnalyticsChart
            theme={theme}
            points={timelinePoints}
            datasets={chartDatasets}
            emphasizeLabel={t('activity.escalations.analytics.chartNet')}
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
    </div>
  )
}
