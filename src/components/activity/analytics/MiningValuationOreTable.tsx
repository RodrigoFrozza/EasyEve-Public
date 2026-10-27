'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { SessionValuationOreRow } from '@/lib/mining-session-valuation'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  theme: ActivityThemeClasses
  rows: SessionValuationOreRow[]
  excludedBaselineByTypeId?: Record<number, number>
  volumeByTypeId?: Record<number, number>
  isAutoTracked?: boolean
}

export function MiningValuationOreTable({
  theme,
  rows,
  excludedBaselineByTypeId = {},
  volumeByTypeId = {},
  isAutoTracked = false,
}: Props) {
  const { t } = useTranslations()
  const hasBaselineColumn = Object.values(excludedBaselineByTypeId).some((v) => v > 0)
  const hasVolumeColumn = Object.keys(volumeByTypeId).length > 0

  return (
    <div className={cn('overflow-hidden rounded-xl border backdrop-blur-md', theme.panel)}>
      <div className={cn('border-b px-4 py-2.5', theme.panelDivider)}>
        <div className="flex items-center justify-between gap-2">
          <p className={cn('font-mono text-[10px] font-bold uppercase tracking-wide', theme.text)}>
            {t('activity.analytics.oreBreakdown')}
          </p>
          {isAutoTracked ? (
            <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-wide text-cyan-400">
              {t('activity.analytics.mining.autoTrackedBadge')}
            </span>
          ) : null}
        </div>
        {hasBaselineColumn ? (
          <p className="mt-1 font-mono text-[8px] text-zinc-500">
            {t('activity.analytics.mining.baselineHint')}
          </p>
        ) : null}
      </div>
      <ScrollArea className="h-[220px]">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center font-mono text-[10px] text-zinc-600">
            {t('activity.analytics.emptyList')}
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] text-left">
                <th className="px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-500">
                  Ore
                </th>
                <th className="px-2 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-500">
                  {t('activity.analytics.mining.colQtyLedger')}
                </th>
                {hasVolumeColumn ? (
                  <th className="px-2 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-500">
                    {t('activity.analytics.mining.colVolume')}
                  </th>
                ) : null}
                {hasBaselineColumn ? (
                  <th className="px-2 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-amber-500/80">
                    {t('activity.analytics.mining.colExcluded')}
                  </th>
                ) : null}
                <th className="px-2 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-emerald-500/80">
                  {t('activity.analytics.mining.colRaw')}
                </th>
                <th className="px-2 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-cyan-500/80">
                  {t('activity.analytics.mining.colRefined')}
                </th>
                <th className="px-4 py-2 text-right font-mono text-[8px] font-bold uppercase tracking-wide text-zinc-500">
                  {t('activity.analytics.mining.colDelta')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((row) => {
                const typeId = Number(row.typeId)
                const excluded = excludedBaselineByTypeId[typeId] || 0
                const volume = volumeByTypeId[typeId] || 0

                return (
                  <tr key={row.typeId} className="transition-colors hover:bg-white/[0.03]">
                    <td className="max-w-[120px] truncate px-4 py-2 font-mono text-[10px] font-bold uppercase text-zinc-200">
                      {row.name}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[9px] tabular-nums text-zinc-500">
                      {formatCompactNumber(row.quantity)}
                    </td>
                    {hasVolumeColumn ? (
                      <td className="px-2 py-2 text-right font-mono text-[9px] tabular-nums text-zinc-500">
                        {volume > 0 ? `${formatCompactNumber(volume)} m³` : '—'}
                      </td>
                    ) : null}
                    {hasBaselineColumn ? (
                      <td className="px-2 py-2 text-right font-mono text-[9px] tabular-nums text-amber-400/80">
                        {excluded > 0 ? formatCompactNumber(excluded) : '—'}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 text-right font-mono text-[10px] font-bold tabular-nums text-emerald-400/90">
                      {formatCurrencyValue(row.rawIsk)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[10px] font-bold tabular-nums text-cyan-400/90">
                      {formatCurrencyValue(row.refinedIsk)}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono text-[9px] font-bold tabular-nums',
                        row.deltaPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {row.rawIsk > 0 ? `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </div>
  )
}
