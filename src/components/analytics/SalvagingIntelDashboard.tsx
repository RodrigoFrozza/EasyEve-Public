'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { NPC_FACTIONS, SPACE_TYPES } from '@/lib/constants/activity-data'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { useSalvagingIntel } from '@/lib/hooks/use-salvaging-intel'
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
import { Loader2, ArrowLeft, Recycle } from 'lucide-react'

const theme = getActivityTheme('salvaging')
const ALL = '__all__'

export function SalvagingIntelDashboard() {
  const { t } = useTranslations()
  const [faction, setFaction] = useState<string>(ALL)
  const [space, setSpace] = useState<string>(ALL)

  const queryFaction = faction === ALL ? undefined : faction
  const querySpace = space === ALL ? undefined : space

  const { data, loading, error, refetch } = useSalvagingIntel({
    scope: 'global',
    faction: queryFaction,
    space: querySpace,
  })

  const maxAvgBatch = useMemo(() => {
    if (!data?.factionRanking.length) return 1
    return Math.max(...data.factionRanking.map((f) => f.avgIskPerBatch), 1)
  }, [data])

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="text-zinc-400">
            <Link href="/dashboard/activity?type=salvaging">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl border',
              theme.headerIconBox
            )}
          >
            <Recycle className={cn('h-6 w-6', theme.headerIcon)} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-eve-text">
              {t('activity.salvaging.intel.pageTitle')}
            </h1>
            <p className="text-sm text-zinc-500">{t('activity.salvaging.intel.pageSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={faction} onValueChange={setFaction}>
          <SelectTrigger className="w-[200px] border-zinc-800 bg-zinc-900">
            <SelectValue placeholder={t('activity.salvaging.npcFaction')} />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value={ALL}>{t('activity.salvaging.intel.allFactions')}</SelectItem>
            {NPC_FACTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={space} onValueChange={setSpace}>
          <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900">
            <SelectValue placeholder={t('activity.salvaging.intel.spaceFilter')} />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value={ALL}>{t('activity.salvaging.intel.allSpaces')}</SelectItem>
            {SPACE_TYPES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('activity.salvaging.intel.refresh')}
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
              {t('activity.salvaging.intel.insufficientSample', {
                min: data.meta.minSampleBatches,
                current: data.meta.totalBatches,
              })}
            </div>
          )}

          <section className="space-y-4">
            <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', theme.text)}>
              {t('activity.salvaging.intel.factionRankingTitle')}
            </h2>
            <div className={cn('overflow-hidden rounded-xl border', theme.panel)}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                    <th className="px-4 py-3">{t('activity.salvaging.npcFaction')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.batches')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.avgPerBatch')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.lootValue')}</th>
                    <th className="px-4 py-3 w-1/3" />
                  </tr>
                </thead>
                <tbody>
                  {data.factionRanking.map((row) => (
                    <tr key={`${row.npcFaction}-${row.spaceType}`} className="border-b border-white/5">
                      <td className={cn('px-4 py-3 font-medium', theme.text)}>{row.npcFaction}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-300">
                        {row.totalBatches}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-lime-300">
                        {formatCurrencyValue(row.avgIskPerBatch)}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                        {formatCurrencyValue(row.totalValue)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-2 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full bg-lime-500/80"
                            style={{
                              width: `${Math.min(100, (row.avgIskPerBatch / maxAvgBatch) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.factionRanking.length === 0 && (
                <p className="p-6 text-center text-sm text-zinc-500">
                  {t('activity.salvaging.intel.noDataYet')}
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className={cn('font-mono text-xs font-bold uppercase tracking-widest', theme.text)}>
              {t('activity.salvaging.intel.lootTableTitle')}
            </h2>
            <div className={cn('overflow-hidden rounded-xl border', theme.panel)}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                    <th className="px-4 py-3">{t('activity.salvaging.intel.item')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.dropRate')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.appearances')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.avgQty')}</th>
                    <th className="px-4 py-3">{t('activity.salvaging.intel.avgValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.typeId} className="border-b border-white/5">
                      <td className={cn('px-4 py-3 font-medium uppercase', theme.textMuted)}>
                        {item.itemName}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-lime-300">
                        {item.dropRatePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                        {item.batchesWithItem}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-zinc-400">
                        {item.batchesWithItem > 0
                          ? (item.totalQuantity / item.batchesWithItem).toFixed(1)
                          : '—'}
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
                  {t('activity.salvaging.intel.noItemsYet')}
                </p>
              )}
            </div>
          </section>

          <p className="text-[10px] text-zinc-600">
            {t('activity.salvaging.intel.footnote')}
          </p>
        </>
      )}
    </div>
  )
}
