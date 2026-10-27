'use client'

import { useState } from 'react'
import { cn, formatCurrencyValue } from '@/lib/utils'
import type { PiColoniesResponse } from '@/lib/pi/types'
import { computePortfolioFinancialTotals } from '@/lib/pi/portfolio-attribution'
import { useTranslations } from '@/i18n/hooks'
import { PiFinancialBreakdown } from './PiFinancialBreakdown'

type Props = {
  data: PiColoniesResponse | null
  rateMode: 'potential' | 'current'
  exportTaxRate: number
  pricingMode: string
  sellSource: string
}

function pricingModeLabel(mode: string, t: (k: string) => string): string {
  switch (mode) {
    case 'mid_price':
      return t('pi.config.pricingMid')
    case 'pessimistic':
      return t('pi.config.pricingPessimistic')
    case 'realistic':
      return t('pi.config.pricingRealistic')
    default:
      return t('pi.config.pricingImportBuyExportSell')
  }
}

export function PiSummaryBar({ data, rateMode, exportTaxRate, pricingMode, sellSource }: Props) {
  const { t } = useTranslations()
  const [showBreakdown, setShowBreakdown] = useState(false)

  if (!data) return null

  // Pricing assumptions that drive the number above — kept next to it (not
  // floating at the top of the page) so the reader sees what the figure depends on.
  const assumptions = [
    pricingModeLabel(pricingMode, t),
    t('pi.contextChip.exportTax', { rate: Math.round(exportTaxRate * 100) }),
    t(`pi.sources.sell.${sellSource}`),
  ].join(' · ')

  const current = data.totals.currentNetIskPerHour
  const potential = data.totals.potentialNetIskPerHour
  // Only surface potential when it actually differs from current — factory-only
  // portfolios have them equal, so the extra number would just be noise.
  const potentialDiffers = Math.round(potential) !== Math.round(current)

  const financial = computePortfolioFinancialTotals(data.colonies, rateMode)

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {t('pi.summary.colonies')}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-eve-text">
            {data.totals.colonyCount}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border p-4',
            current >= 0
              ? 'border-emerald-400/20 bg-emerald-400/5'
              : 'border-red-400/20 bg-red-400/5'
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {t('pi.summary.currentNetIskPerHour')}
          </p>
          <p
            className={cn(
              'mt-1 text-xl font-bold tabular-nums',
              current >= 0 ? 'text-emerald-300' : 'text-red-400'
            )}
          >
            {formatCurrencyValue(current)}
            <span className="ml-1 text-sm font-normal text-zinc-500">/h</span>
          </p>
          <p className="mt-1 text-[10px] leading-tight text-zinc-500">{assumptions}</p>
          {potentialDiffers ? (
            <p className="mt-1 text-[11px] text-cyan-300/80">
              {t('pi.summary.potentialAside', { value: formatCurrencyValue(potential) })}
            </p>
          ) : null}
          <p className="mt-1 text-[10px] text-zinc-600">{t('pi.summary.portfolioHint')}</p>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="mt-2 text-[10px] text-violet-400 hover:text-violet-300"
          >
            {showBreakdown ? t('pi.financial.hideBreakdown') : t('pi.financial.showBreakdown')}
          </button>
        </div>
      </div>
      {showBreakdown ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            {t('pi.financial.portfolioBreakdown')}
          </p>
          <PiFinancialBreakdown
            exportRevenue={financial.exportRevenuePerHour}
            importCost={financial.importCostPerHour}
            exportTaxRate={exportTaxRate}
            exportTax={financial.exportTaxPerHour}
          />
          {(data.totals.autoproduceSavingsPerHour ?? 0) > 0 ? (
            <p className="mt-3 border-t border-zinc-800 pt-2 text-xs text-emerald-300">
              💡 {t('pi.summary.autoproduceSavings')}: ~
              {Math.round(data.totals.autoproduceSavingsPerHour ?? 0).toLocaleString()} ISK/h
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
