'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { Activity } from '@/lib/stores/activity-store'
import { ACTIVITY_COLORS } from '@/lib/constants/activity-colors'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import {
  analyticsMetricTile,
  analyticsPanelSurface,
} from '@/lib/activity/activity-analytics-surface'
import { getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { buildSessionTimeline, type CompositionSlice } from '@/lib/activity/activity-analytics'
import { isSalvagingIncomeLog } from '@/lib/activities/salvaging-data-recalc'
import { getSalvagingBatchCount } from '@/lib/activities/session-kpis'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useActivityAnalytics } from '../useActivityAnalytics'
import { useSalvagingIntel } from '@/lib/hooks/use-salvaging-intel'
import { ActivityAnalyticsChart } from '../ActivityAnalyticsChart'
import { ActivityAnalyticsComposition } from '../ActivityAnalyticsComposition'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'

function buildSalvagingItemComposition(logs: Array<Record<string, unknown>>): CompositionSlice[] {
  const salvageLogs = logs.filter((l) => isSalvagingIncomeLog(l))
  const totals = new Map<string, number>()
  let grand = 0

  for (const log of salvageLogs) {
    const items = (log.items as Array<{ name?: string; total?: number; price?: number; quantity?: number }>) || []
    for (const item of items) {
      const name = item.name || 'Unknown'
      const val = Number(item.total) || (Number(item.price) || 0) * (Number(item.quantity) || 1)
      totals.set(name, (totals.get(name) || 0) + val)
      grand += val
    }
  }

  if (grand <= 0) return []

  const colors = ['#a3e635', '#84cc16', '#65a30d', '#4d7c0f', '#bef264']
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      pct: (value / grand) * 100,
      color: colors[i % colors.length],
    }))
}

export function SalvagingAnalyticsPanel({ activity }: { activity: Activity }) {
  const theme = getActivityTheme('salvaging')
  const colors = ACTIVITY_COLORS.salvaging
  const { t } = useTranslations()
  const { logs } = useActivityAnalytics(activity)
  const faction = getSalvagingNpcFaction(activity)

  const { data: globalIntel, loading: globalLoading } = useSalvagingIntel(
    { scope: 'global', faction: faction || undefined },
    Boolean(faction)
  )

  const timelinePoints = useMemo(
    () => buildSessionTimeline(activity, logs, 'exploration'),
    [activity, logs]
  )

  const composition = useMemo(
    () => buildSalvagingItemComposition(logs as Array<Record<string, unknown>>),
    [logs]
  )

  const sessionBatches = getSalvagingBatchCount(logs)
  const sessionLoot = Number((activity.data as { totalLootValue?: number })?.totalLootValue) || 0
  const globalFaction = globalIntel?.factionRanking?.[0]
  const topGlobalItems = globalIntel?.items?.slice(0, 3) ?? []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivityAnalyticsChart
            theme={theme}
            points={timelinePoints}
            datasets={
              timelinePoints.length >= 2
                ? [{ label: 'Loot', data: timelinePoints.map((p) => p.value), color: colors.sparkline }]
                : []
            }
          />
        </div>
        <ActivityAnalyticsComposition
          theme={theme}
          titleKey="lootComposition"
          slices={composition}
        />
      </div>

      <div className={analyticsPanelSurface(theme)}>
        <p className={cn('mb-3 font-mono text-[10px] font-bold uppercase tracking-wide', theme.text)}>
          {t('activity.salvaging.intel.sessionVsCommunity')}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={analyticsMetricTile(theme)}>
            <p className={cn('text-[9px] uppercase', theme.textMuted)}>
              {t('activity.salvaging.batchesCompleted')}
            </p>
            <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>{sessionBatches}</p>
          </div>
          <div className={analyticsMetricTile(theme)}>
            <p className={cn('text-[9px] uppercase', theme.textMuted)}>{t('activity.salvaging.lootValue')}</p>
            <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>
              {formatCurrencyValue(sessionLoot)}
            </p>
          </div>
          {faction && (
            <>
              <div className={analyticsMetricTile(theme)}>
                <p className={cn('text-[9px] uppercase', theme.textMuted)}>{t('activity.salvaging.npcFaction')}</p>
                <p className={cn('truncate text-sm font-bold', theme.text)}>{faction}</p>
              </div>
              <div className={analyticsMetricTile(theme)}>
                <p className={cn('text-[9px] uppercase', theme.textMuted)}>
                  {t('activity.salvaging.intel.communityAvgPerBatch')}
                </p>
                {globalLoading ? (
                  <Loader2 className={cn('mt-1 h-4 w-4 animate-spin', theme.textMuted)} />
                ) : (
                  <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>
                    {globalFaction
                      ? formatCurrencyValue(globalFaction.avgIskPerBatch)
                      : '—'}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {topGlobalItems.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className={cn('text-[9px] font-bold uppercase', theme.textMuted)}>
              {t('activity.salvaging.intel.topDropsGlobal', { faction: faction || '' })}
            </p>
            {topGlobalItems.map((item) => (
              <div
                key={item.typeId}
                className="flex items-center justify-between gap-2 font-mono text-[10px]"
              >
                <span className={cn('truncate uppercase', theme.textMuted)}>{item.itemName}</span>
                <span className={cn('shrink-0 tabular-nums', theme.text)}>
                  {item.dropRatePct.toFixed(1)}% · {formatCurrencyValue(item.avgValuePerAppearance)}
                </span>
              </div>
            ))}
          </div>
        )}

        {!globalIntel?.meta.sampleSufficient && !globalLoading && (
          <p className={cn('mt-3 text-[10px]', theme.textMuted)}>
            {t('activity.salvaging.intel.insufficientSample', {
              min: globalIntel?.meta.minSampleBatches ?? 20,
              current: globalIntel?.meta.totalBatches ?? 0,
            })}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-lime-500/30 text-lime-300 hover:bg-lime-500/10"
        >
          <Link href="/dashboard/analytics/salvaging">
            {t('activity.salvaging.intel.viewFullIntel')}
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
