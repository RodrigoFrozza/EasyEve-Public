'use client'

import { cn, formatCurrencyValue } from '@/lib/utils'
import { financialSnapshotFromParts } from '@/lib/pi/portfolio-attribution'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  exportRevenue: number
  importCost: number
  exportTaxRate: number
  /**
   * Real base-value customs tax (ISK/h). When provided, the breakdown uses it
   * directly (gross = net revenue + tax) instead of reconstructing tax from the
   * rate — which is only valid for the legacy market-based model. Pass this
   * whenever the caller has the real per-colony/network/portfolio tax.
   */
  exportTax?: number
  compact?: boolean
  className?: string
}

export function PiFinancialBreakdown({
  exportRevenue,
  importCost,
  exportTaxRate,
  exportTax,
  compact = false,
  className,
}: Props) {
  const { t } = useTranslations()
  const snapshot =
    exportTax != null
      ? {
          exportRevenuePerHour: exportRevenue,
          importCostPerHour: importCost,
          exportTaxPerHour: exportTax,
          exportGrossPerHour: exportRevenue + exportTax,
          netIskPerHour: exportRevenue - importCost,
        }
      : financialSnapshotFromParts(exportRevenue, importCost, exportTaxRate)
  const net = snapshot.netIskPerHour

  const rowClass = compact ? 'text-[10px]' : 'text-xs'

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('flex items-center justify-between gap-4', rowClass)}>
        <span className="text-zinc-500">{t('pi.financial.exportGross')}</span>
        <span className="tabular-nums text-emerald-300/90">
          +{formatCurrencyValue(snapshot.exportGrossPerHour)}
        </span>
      </div>
      <div className={cn('flex items-center justify-between gap-4', rowClass)}>
        <span className="text-zinc-500">{t('pi.financial.exportTax')}</span>
        <span className="tabular-nums text-amber-300/90">
          −{formatCurrencyValue(snapshot.exportTaxPerHour)}
        </span>
      </div>
      <div className={cn('flex items-center justify-between gap-4', rowClass)}>
        <span className="text-zinc-500">{t('pi.financial.importCost')}</span>
        <span className="tabular-nums text-blue-300/90">
          −{formatCurrencyValue(snapshot.importCostPerHour)}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center justify-between gap-4 border-t border-zinc-800 pt-1 font-semibold',
          compact ? 'text-[10px]' : 'text-sm'
        )}
      >
        <span className="text-zinc-400">{t('pi.financial.netIskPerHour')}</span>
        <span
          className={cn(
            'tabular-nums',
            net >= 0 ? 'text-emerald-300' : 'text-red-400'
          )}
        >
          {formatCurrencyValue(net)}
          <span className="ml-0.5 font-normal text-zinc-500">/h</span>
        </span>
      </div>
    </div>
  )
}
