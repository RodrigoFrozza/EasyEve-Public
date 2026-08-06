'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn, formatCurrencyValue } from '@/lib/utils'
import { formatPiRate } from '@/lib/pi/format'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PiItemIcon } from './PiItemIcon'
import type { PriceOrigin } from '@/lib/pi/demand-model'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
  /** Start collapsed — this is dense Level-3 detail. Defaults to open. */
  defaultOpen?: boolean
}

const ORIGIN_STYLES: Record<Exclude<PriceOrigin, 'none'>, string> = {
  structure: 'bg-violet-500/15 text-violet-300',
  region: 'bg-emerald-500/15 text-emerald-300',
  jita: 'bg-blue-500/15 text-blue-300',
  reference: 'bg-amber-500/15 text-amber-300',
}

export function BalanceTable({ colony, rateMode, defaultOpen = true }: Props) {
  const { t } = useTranslations()
  const [showIsk, setShowIsk] = useState(true)
  const [open, setOpen] = useState(defaultOpen)
  const balances =
    rateMode === 'potential' ? colony.balances.potential : colony.balances.current

  const hasIskData = balances.some(
    (row) => (row.exportIskPerHour ?? 0) > 0 || (row.importIskPerHour ?? 0) > 0
  )

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-violet-300"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          {t('pi.balance.title')}
        </button>
        {open && hasIskData ? (
          <div className="flex items-center gap-2">
            <Switch
              id={`balance-isk-${colony.planetId}`}
              checked={showIsk}
              onCheckedChange={setShowIsk}
            />
            <Label htmlFor={`balance-isk-${colony.planetId}`} className="text-[10px] text-zinc-400">
              {t('pi.balance.showIsk')}
            </Label>
          </div>
        ) : null}
      </div>
      {open ? (
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-950/80 text-[10px] uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-3 py-2">{t('pi.balance.item')}</th>
              <th className="px-3 py-2">{t('pi.balance.demand')}</th>
              <th className="px-3 py-2">{t('pi.balance.extraction')}</th>
              <th className="px-3 py-2">{t('pi.balance.production')}</th>
              <th className="px-3 py-2">{t('pi.balance.import')}</th>
              <th className="px-3 py-2">{t('pi.balance.surplus')}</th>
              <th className="px-3 py-2">{t('pi.balance.wasted')}</th>
              <th className="px-3 py-2">{t('pi.balance.export')}</th>
              {showIsk && hasIskData ? (
                <th className="px-3 py-2">{t('pi.balance.iskPerHour')}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {balances.length === 0 ? (
              <tr>
                <td colSpan={showIsk && hasIskData ? 9 : 8} className="px-3 py-4 text-zinc-600">
                  —
                </td>
              </tr>
            ) : (
              balances.map((row) => {
                const isBottleneck =
                  row.importNeededPerHour > 0 &&
                  row.localSupplyPerHour < row.demandPerHour
                const exportIsk = row.exportIskPerHour ?? 0
                const importIsk = row.importIskPerHour ?? 0
                const rowIsk = exportIsk - importIsk
                const isInternalOnly = exportIsk <= 0 && importIsk <= 0

                return (
                  <tr
                    key={row.typeId}
                    className={cn(
                      'border-t border-zinc-800/80',
                      isBottleneck && 'bg-red-500/5',
                      row.wastedPerHour > 0 && 'bg-amber-500/5'
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PiItemIcon typeId={row.typeId} name={row.name} size={24} />
                        <span className="text-zinc-200">
                          {row.name}
                          {row.tier != null ? ` (P${row.tier})` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-300">
                      {formatPiRate(row.demandPerHour)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-300">
                      {formatPiRate(row.extractionPerHour)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-300">
                      {formatPiRate(row.productionPerHour)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 tabular-nums',
                        row.importNeededPerHour > 0 && 'text-blue-300'
                      )}
                    >
                      {formatPiRate(row.importNeededPerHour)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 tabular-nums',
                        row.surplusPerHour > 0 && 'text-amber-300'
                      )}
                    >
                      {formatPiRate(row.surplusPerHour)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 tabular-nums',
                        row.wastedPerHour > 0 && 'font-medium text-red-300'
                      )}
                    >
                      {formatPiRate(row.wastedPerHour)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 tabular-nums',
                        row.exportedPerHour > 0 && 'text-emerald-300'
                      )}
                    >
                      {formatPiRate(row.exportedPerHour)}
                    </td>
                    {showIsk && hasIskData ? (
                      <td
                        className={cn(
                          'px-3 py-2 tabular-nums',
                          isInternalOnly
                            ? 'text-zinc-600'
                            : rowIsk >= 0
                              ? 'text-emerald-300/90'
                              : 'text-red-400'
                        )}
                      >
                        <div className="flex items-center justify-start gap-1.5">
                          <span>{isInternalOnly ? '—' : formatCurrencyValue(rowIsk)}</span>
                          {!isInternalOnly && row.priceOrigin && row.priceOrigin !== 'none' ? (
                            <span
                              className={cn(
                                'rounded px-1 py-0.5 text-[9px] font-medium uppercase',
                                ORIGIN_STYLES[row.priceOrigin]
                              )}
                              title={t('pi.balance.priceOriginHint')}
                            >
                              {t(`pi.balance.origin.${row.priceOrigin}`)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      ) : null}
    </section>
  )
}
