'use client'

import Link from 'next/link'
import {
  normalizeLootIntelDisplay,
  type LootIntelDisplayPayload,
} from '@/lib/analytics/normalize-loot-intel-display'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import {
  analyticsMetricTile,
  analyticsPanelSurface,
} from '@/lib/activity/activity-analytics-surface'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'

type Props = {
  theme: ActivityThemeClasses
  intelHref: string
  viewFullIntelKey: string
  sessionVsCommunityKey: string
  dimensionLabel: string
  communityAvgKey: string
  topDropsKey: string
  insufficientSampleKey?: string
  data: LootIntelDisplayPayload
  loading: boolean
  sessionMetrics?: Array<{ label: string; value: string }>
  showIskPerHour?: boolean
}

export function LootIntelSessionBlock({
  theme,
  intelHref,
  viewFullIntelKey,
  sessionVsCommunityKey,
  dimensionLabel,
  communityAvgKey,
  topDropsKey,
  data,
  loading,
  sessionMetrics = [],
  showIskPerHour = false,
}: Props) {
  const { t } = useTranslations()
  const intel = normalizeLootIntelDisplay(data)
  const topDim = intel?.dimensionRanking?.[0]
  const topItems = intel?.items?.slice(0, 3) ?? []

  return (
    <>
      <div className={analyticsPanelSurface(theme)}>
        <p className={cn('mb-3 font-mono text-[10px] font-bold uppercase tracking-wide', theme.text)}>
          {t(sessionVsCommunityKey)}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sessionMetrics.map((m) => (
            <div
              key={m.label}
              className={analyticsMetricTile(theme)}
            >
              <p className={cn('text-[9px] uppercase', theme.textMuted)}>{m.label}</p>
              <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>{m.value}</p>
            </div>
          ))}
          {dimensionLabel && (
            <div className={analyticsMetricTile(theme)}>
              <p className={cn('text-[9px] uppercase', theme.textMuted)}>{dimensionLabel}</p>
              <p className={cn('truncate text-sm font-bold', theme.text)}>
                {topDim?.label ?? '—'}
              </p>
            </div>
          )}
          <div className={analyticsMetricTile(theme)}>
            <p className={cn('text-[9px] uppercase', theme.textMuted)}>{t(communityAvgKey)}</p>
            {loading ? (
              <Loader2 className={cn('mt-1 h-4 w-4 animate-spin', theme.textMuted)} />
            ) : (
              <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>
                {topDim
                  ? showIskPerHour && topDim.avgIskPerHour != null
                    ? `${formatCurrencyValue(topDim.avgIskPerHour)}/h`
                    : formatCurrencyValue(topDim.avgValuePerEvent)
                  : '—'}
              </p>
            )}
          </div>
        </div>

        {topItems.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className={cn('text-[9px] font-bold uppercase', theme.textMuted)}>{t(topDropsKey)}</p>
            {topItems.map((item) => (
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

        {intel && !intel.meta.sampleSufficient && !loading && (
          <p className={cn('mt-3 text-[10px]', theme.textMuted)}>
            {t('activity.intel.insufficientSample', {
              min: intel.meta.minSampleEvents,
              current: intel.meta.totalEvents,
            })}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm" className={cn('border-opacity-30', theme.chip)}>
          <Link href={intelHref}>
            {t(viewFullIntelKey)}
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </>
  )
}
