'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { MiningPriceSide } from '@/lib/mining-session-valuation'
import type { SessionValuationResult } from '@/lib/mining-session-valuation'
import { analyticsPanelSurface } from '@/lib/activity/activity-analytics-surface'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MiningValuationControls } from './MiningValuationControls'
import { TrendingUp, TrendingDown } from 'lucide-react'

type Props = {
  theme: ActivityThemeClasses
  valuation: SessionValuationResult
  priceSide: MiningPriceSide
  onPriceSideChange: (side: MiningPriceSide) => void
  efficiencyPct: number
  onEfficiencyChange: (value: number) => void
  loading?: boolean
}

const sideAccent: Record<MiningPriceSide, string> = {
  buy: 'border-emerald-500/30 bg-emerald-500/5',
  sell: 'border-amber-500/30 bg-amber-500/5',
  split: 'border-cyan-500/30 bg-cyan-500/5',
}

export function MiningValuationHero({
  theme,
  valuation,
  priceSide,
  onPriceSideChange,
  efficiencyPct,
  onEfficiencyChange,
  loading,
}: Props) {
  const { t } = useTranslations()
  const uplift = valuation.deltaPct
  const isPositive = uplift >= 0

  return (
    <div className={analyticsPanelSurface(theme)}>
      <MiningValuationControls
        theme={theme}
        priceSide={priceSide}
        onPriceSideChange={onPriceSideChange}
        efficiencyPct={efficiencyPct}
        onEfficiencyChange={onEfficiencyChange}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className={cn(
            'rounded-xl border p-4 transition-colors',
            sideAccent[priceSide]
          )}
        >
          <p className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.analytics.mining.rawValue')}
          </p>
          <p
            className={cn(
              'mt-1 font-mono text-xl font-bold tabular-nums transition-all duration-300',
              theme.text,
              loading && 'animate-pulse opacity-60'
            )}
          >
            {formatCurrencyValue(valuation.rawTotal)}
          </p>
          <p className={cn('mt-0.5 font-mono text-[10px] tabular-nums', theme.textMuted)}>
            {formatCurrencyValue(valuation.rawIskPerHour)}
            {t('activity.analytics.mining.perHourSuffix')}
          </p>
        </div>

        <div
          className={cn(
            'relative rounded-xl border p-4 transition-colors',
            'border-cyan-500/40 bg-cyan-500/8'
          )}
        >
          <p className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.analytics.mining.refinedValue')}
          </p>
          <p
            className={cn(
              'mt-1 font-mono text-xl font-bold tabular-nums transition-all duration-300',
              'text-cyan-300',
              loading && 'animate-pulse opacity-60'
            )}
          >
            {formatCurrencyValue(valuation.refinedTotal)}
          </p>
          <p className={cn('mt-0.5 font-mono text-[10px] tabular-nums text-cyan-400/70')}>
            {formatCurrencyValue(valuation.refinedIskPerHour)}
            {t('activity.analytics.mining.perHourSuffix')}
          </p>
          {valuation.rawTotal > 0 && (
            <div
              className={cn(
                'absolute right-3 top-3 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold',
                isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {isPositive ? '+' : ''}
              {uplift.toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {loading && (
        <p className={cn('mt-2 text-center font-mono text-[9px]', theme.textMuted)}>
          {t('activity.analytics.mining.valuationLoading')}
        </p>
      )}
    </div>
  )
}
