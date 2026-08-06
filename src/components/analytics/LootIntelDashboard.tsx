'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { ActivityType } from '@/lib/constants/activity-colors'
import { getActivityTheme, getActivityThemeIcon } from '@/lib/activity/activity-theme'
import type { LootIntelResponse } from '@/lib/analytics/loot-intel-shared'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft } from 'lucide-react'

const ALL = '__all__'

export type LootIntelFilterDef = {
  id: string
  labelKey: string
  allLabelKey: string
  options: string[]
  value: string
  onChange: (v: string) => void
}

type Props = {
  activityType: ActivityType
  trackerHref: string
  titleKey: string
  subtitleKey: string
  dimensionTitleKey: string
  lootTableTitleKey: string
  dimensionLabelKey: string
  eventsLabelKey: string
  avgPerEventKey: string
  avgIskHourKey?: string
  data: LootIntelResponse | null
  loading: boolean
  error: string | null
  refetch: () => void
  filters?: LootIntelFilterDef[]
  sortDimensionBy?: 'iskPerHour' | 'avgPerEvent'
  extraColumns?: ReactNode
}

export function LootIntelDashboard({
  activityType,
  trackerHref,
  titleKey,
  subtitleKey,
  dimensionTitleKey,
  lootTableTitleKey,
  dimensionLabelKey,
  eventsLabelKey,
  avgPerEventKey,
  avgIskHourKey,
  data,
  loading,
  error,
  refetch,
  filters = [],
  sortDimensionBy = 'avgPerEvent',
}: Props) {
  const { t } = useTranslations()
  const theme = getActivityTheme(activityType)
  const Icon = getActivityThemeIcon(activityType)

  const maxBar = useMemo(() => {
    if (!data?.dimensionRanking.length) return 1
    if (sortDimensionBy === 'iskPerHour') {
      return Math.max(...data.dimensionRanking.map((d) => d.avgIskPerHour ?? 0), 1)
    }
    return Math.max(...data.dimensionRanking.map((d) => d.avgValuePerEvent), 1)
  }, [data, sortDimensionBy])

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="text-zinc-400">
            <Link href={trackerHref}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl border',
              theme.headerIconBox
            )}
          >
            <Icon className={cn('h-6 w-6', theme.headerIcon)} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-eve-text">{t(titleKey)}</h1>
            <p className="text-sm text-zinc-500">{t(subtitleKey)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {filters.map((f) => (
          <Select key={f.id} value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className="w-[200px] border-zinc-800 bg-zinc-900">
              <SelectValue placeholder={t(f.labelKey)} />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-900">
              <SelectItem value={ALL}>{t(f.allLabelKey)}</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('activity.intel.refresh')}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className={cn('h-8 w-8 animate-spin', theme.text)} />
        </div>
      )}

      {data && (
        <>
          {!data.meta.sampleSufficient && (
            <div
              className={cn(
                'rounded-xl border border-dashed p-4 text-center text-sm',
                theme.logEmpty,
                theme.textMuted
              )}
            >
              {t('activity.intel.insufficientSample', {
                min: data.meta.minSampleEvents,
                current: data.meta.totalEvents,
              })}
            </div>
          )}

          <section className="space-y-4">
            <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', theme.text)}>
              {t(dimensionTitleKey)}
            </h2>
            <div className={cn('overflow-hidden rounded-xl border', theme.panel)}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                    <th className="px-4 py-3">{t(dimensionLabelKey)}</th>
                    <th className="px-4 py-3">{t(eventsLabelKey)}</th>
                    {avgIskHourKey && <th className="px-4 py-3">{t(avgIskHourKey)}</th>}
                    <th className="px-4 py-3">{t(avgPerEventKey)}</th>
                    <th className="px-4 py-3 w-1/3" />
                  </tr>
                </thead>
                <tbody>
                  {data.dimensionRanking.map((row) => {
                    const barValue =
                      sortDimensionBy === 'iskPerHour'
                        ? row.avgIskPerHour ?? 0
                        : row.avgValuePerEvent
                    return (
                      <tr key={row.key} className="border-b border-white/5">
                        <td className={cn('px-4 py-3 font-medium', theme.text)}>
                          {row.label}
                          {row.subLabel ? (
                            <span className="ml-2 text-[10px] text-zinc-500">{row.subLabel}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                          {row.totalEvents}
                        </td>
                        {avgIskHourKey && (
                          <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                            {row.avgIskPerHour != null
                              ? formatCurrencyValue(row.avgIskPerHour)
                              : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                          {formatCurrencyValue(row.avgValuePerEvent)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="h-2 overflow-hidden rounded-full bg-black/40">
                            <div
                              className={cn('h-full rounded-full', theme.accentBar)}
                              style={{
                                width: `${Math.min(100, (barValue / maxBar) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {data.dimensionRanking.length === 0 && (
                <p className="p-6 text-center text-sm text-zinc-500">
                  {t('activity.intel.noDataYet')}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', theme.text)}>
              {t(lootTableTitleKey)}
            </h2>
            <div className={cn('overflow-hidden rounded-xl border', theme.panel)}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                    <th className="px-4 py-3">{t('activity.intel.item')}</th>
                    <th className="px-4 py-3">{t('activity.intel.dropRate')}</th>
                    <th className="px-4 py-3">{t('activity.intel.appearances')}</th>
                    <th className="px-4 py-3">{t('activity.intel.avgValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.typeId} className="border-b border-white/5">
                      <td className={cn('px-4 py-3 font-medium uppercase', theme.textMuted)}>
                        {item.itemName}
                      </td>
                      <td className={cn('px-4 py-3 font-mono tabular-nums', theme.text)}>
                        {item.dropRatePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                        {item.eventsWithItem}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                        {formatCurrencyValue(item.avgValuePerAppearance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.items.length === 0 && (
                <p className="p-6 text-center text-sm text-zinc-500">
                  {t('activity.intel.noItemsYet')}
                </p>
              )}
            </div>
          </section>

          <p className="text-[10px] text-zinc-600">{t('activity.intel.footnote')}</p>
        </>
      )}
    </div>
  )
}
