'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { MiningPriceSide } from '@/lib/mining-session-valuation'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

type Props = {
  theme: ActivityThemeClasses
  priceSide: MiningPriceSide
  onPriceSideChange: (side: MiningPriceSide) => void
  efficiencyPct: number
  onEfficiencyChange: (value: number) => void
}

const PRICE_SIDES: MiningPriceSide[] = ['buy', 'sell', 'split']

const sideColor: Record<MiningPriceSide, string> = {
  buy: 'text-emerald-400',
  sell: 'text-amber-400',
  split: 'text-cyan-400',
}

export function MiningValuationControls({
  theme,
  priceSide,
  onPriceSideChange,
  efficiencyPct,
  onEfficiencyChange,
}: Props) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
          {t('activity.analytics.mining.priceMode')}
        </span>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5">
          {PRICE_SIDES.map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => onPriceSideChange(side)}
              className={cn(
                'rounded-md px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wide transition-colors',
                priceSide === side
                  ? cn('bg-white/10 shadow-sm', sideColor[side])
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t(`activity.analytics.mining.priceMode${side.charAt(0).toUpperCase()}${side.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.analytics.mining.reprocessingEfficiency')}
            </span>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-zinc-600 hover:text-zinc-400">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {t('activity.analytics.mining.efficiencyHint')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className={cn('font-mono text-[10px] font-bold tabular-nums', theme.text)}>
            {efficiencyPct}%
          </span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={efficiencyPct}
          onChange={(e) => onEfficiencyChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
          aria-label={t('activity.analytics.mining.reprocessingEfficiency')}
        />
      </div>
    </div>
  )
}
