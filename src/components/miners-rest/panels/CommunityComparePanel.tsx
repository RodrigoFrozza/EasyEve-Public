'use client'

import Link from 'next/link'
import { useMiningLootIntel } from '@/lib/hooks/use-mining-loot-intel'
import type { MiningPersonalOverviewResponse } from '@/lib/analytics/mining-personal-overview'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestEmpty, MinersRestSection, minersRestTheme } from '../MinersRestSection'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2 } from 'lucide-react'

import type { LootIntelDimensionRow } from '@/lib/analytics/loot-intel-shared'

type Props = {
  overview: MiningPersonalOverviewResponse | null
  category?: string
  space?: string
  days?: number
}

function blendedDimensionIskPerHour(rows: LootIntelDimensionRow[]): number | null {
  let totalValue = 0
  let totalDurationMs = 0

  for (const row of rows) {
    if (row.avgIskPerHour == null || row.avgIskPerHour <= 0) continue
    totalValue += row.totalValue
    totalDurationMs += (row.totalValue / row.avgIskPerHour) * 3_600_000
  }

  if (totalDurationMs <= 0) return null
  return totalValue / (totalDurationMs / 3_600_000)
}

export function CommunityComparePanel({ overview, category, space, days }: Props) {
  const { t } = useTranslations()

  const { data: meIntel, loading: meLoading } = useMiningLootIntel({
    scope: 'me',
    category,
    space,
    days,
  })

  const { data: globalIntel, loading: globalLoading } = useMiningLootIntel({
    scope: 'global',
    category,
    space,
  })

  const loading = meLoading || globalLoading
  const personalIskPerHour = overview?.meta.avgIskPerHour ?? null

  const globalComparable = category
    ? globalIntel?.dimensionRanking.find((row) => row.key === category) ??
      globalIntel?.dimensionRanking[0]
    : null

  const globalIskPerHour = category
    ? globalComparable?.avgIskPerHour ?? null
    : blendedDimensionIskPerHour(globalIntel?.dimensionRanking ?? [])

  const meTopItem = meIntel?.items[0]
  const globalTopItem = globalIntel?.items[0]
  const personalTopRegion = overview?.byRegion[0]
  const globalTopRegion = globalIntel?.regionRanking?.[0]

  function regionIskPerHour(
    isk: number,
    durationMs?: number,
    avgIskPerHour?: number | null
  ): string {
    if (avgIskPerHour != null) return formatCurrencyValue(avgIskPerHour)
    if (!durationMs || durationMs <= 0) return '—'
    return formatCurrencyValue(isk / (durationMs / 3_600_000))
  }

  if (loading && !meIntel && !globalIntel) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', minersRestTheme.text)} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={cn('text-sm', minersRestTheme.textMuted)}>
          {t('minersRest.community.subtitle')}
        </p>
        <Button asChild variant="outline" size="sm" className={cn('border-opacity-30', minersRestTheme.chip)}>
          <Link href="/dashboard/analytics/mining">
            {t('minersRest.community.fullIntel')}
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MinersRestSection title={t('minersRest.community.you')}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.kpi.iskPerHour')}</span>
              <span className={cn('font-mono font-semibold', minersRestTheme.text)}>
                {personalIskPerHour != null ? formatCurrencyValue(personalIskPerHour) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.kpi.totalIsk')}</span>
              <span className="font-mono text-zinc-300">
                {overview ? formatCurrencyValue(overview.meta.totalIsk) : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.community.topOre')}</span>
              <span className={cn('font-medium uppercase', minersRestTheme.textMuted)}>
                {meTopItem?.itemName ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.community.topRegion')}</span>
              <span className={cn('font-medium', minersRestTheme.textMuted)}>
                {personalTopRegion?.name ?? '—'}
              </span>
            </div>
            {personalTopRegion ? (
              <div className="flex justify-between">
                <span className="text-zinc-500">{t('minersRest.community.regionIskPerHour')}</span>
                <span className="font-mono text-zinc-300">
                  {regionIskPerHour(
                    personalTopRegion.isk,
                    personalTopRegion.durationMs
                  )}
                </span>
              </div>
            ) : null}
            {meIntel && !meIntel.meta.sampleSufficient && (
              <p className="text-xs text-amber-400/80">
                {t('activity.intel.insufficientSample', {
                  min: meIntel.meta.minSampleEvents,
                  current: meIntel.meta.totalEvents,
                })}
              </p>
            )}
          </div>
        </MinersRestSection>

        <MinersRestSection title={t('minersRest.community.global')}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.kpi.iskPerHour')}</span>
              <span className={cn('font-mono font-semibold', minersRestTheme.text)}>
                {globalIskPerHour != null
                  ? formatCurrencyValue(globalIskPerHour)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('activity.intel.avgPerEvent')}</span>
              <span className="font-mono text-zinc-300">
                {globalComparable
                  ? formatCurrencyValue(globalComparable.avgValuePerEvent)
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.community.topOre')}</span>
              <span className={cn('font-medium uppercase', minersRestTheme.textMuted)}>
                {globalTopItem?.itemName ?? '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t('minersRest.community.topRegion')}</span>
              <span className={cn('font-medium', minersRestTheme.textMuted)}>
                {globalTopRegion?.regionName ?? '—'}
              </span>
            </div>
            {globalTopRegion ? (
              <div className="flex justify-between">
                <span className="text-zinc-500">{t('minersRest.community.regionIskPerHour')}</span>
                <span className="font-mono text-zinc-300">
                  {regionIskPerHour(
                    globalTopRegion.totalValue,
                    undefined,
                    globalTopRegion.avgIskPerHour
                  )}
                </span>
              </div>
            ) : null}
            {globalIntel && !globalIntel.meta.sampleSufficient && (
              <p className="text-xs text-amber-400/80">
                {t('activity.intel.insufficientSample', {
                  min: globalIntel.meta.minSampleEvents,
                  current: globalIntel.meta.totalEvents,
                })}
              </p>
            )}
          </div>
        </MinersRestSection>
      </div>

      {globalIntel && globalIntel.items.length > 0 ? (
        <MinersRestSection title={t('activity.mining.intel.lootTableTitle')}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                <th className="pb-2">{t('activity.intel.item')}</th>
                <th className="pb-2">{t('activity.intel.dropRate')}</th>
                <th className="pb-2">{t('activity.intel.avgValue')}</th>
              </tr>
            </thead>
            <tbody>
              {globalIntel.items.slice(0, 12).map((item) => (
                <tr key={item.typeId} className="border-b border-white/5">
                  <td className={cn('py-2 font-medium uppercase', minersRestTheme.textMuted)}>
                    {item.itemName}
                  </td>
                  <td className={cn('py-2 font-mono tabular-nums', minersRestTheme.text)}>
                    {item.dropRatePct.toFixed(2)}%
                  </td>
                  <td className="py-2 font-mono tabular-nums text-zinc-300">
                    {formatCurrencyValue(item.avgValuePerAppearance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MinersRestSection>
      ) : (
        <MinersRestEmpty message={t('activity.intel.noItemsYet')} />
      )}

      {globalIntel?.regionRanking && globalIntel.regionRanking.length > 0 ? (
        <MinersRestSection title={t('minersRest.community.topRegions')}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                <th className="pb-2">{t('minersRest.geo.byRegion')}</th>
                <th className="pb-2 text-right">{t('minersRest.kpi.iskPerHour')}</th>
                <th className="pb-2 text-right">{t('activity.intel.avgPerEvent')}</th>
              </tr>
            </thead>
            <tbody>
              {globalIntel.regionRanking.slice(0, 10).map((row) => (
                <tr key={row.regionId} className="border-b border-white/5">
                  <td className={cn('py-2 font-medium', minersRestTheme.text)}>
                    {row.regionName}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-300">
                    {row.avgIskPerHour != null
                      ? formatCurrencyValue(row.avgIskPerHour)
                      : '—'}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                    {formatCurrencyValue(row.avgValuePerEvent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </MinersRestSection>
      ) : null}
    </div>
  )
}
