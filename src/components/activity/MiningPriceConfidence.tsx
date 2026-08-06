'use client'

import { cn } from '@/lib/utils'
import type { MiningPriceBasis, MiningPriceUiConfidence } from '@/lib/mining-price-resolution'
import { miningPriceBasisTooltip } from '@/lib/mining-price-resolution'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface MiningPriceConfidenceProps {
  confidence: MiningPriceUiConfidence
  basis: MiningPriceBasis
  className?: string
}

export function MiningPriceConfidence({ confidence, basis, className }: MiningPriceConfidenceProps) {
  const color =
    confidence === 'high'
      ? 'bg-emerald-400'
      : confidence === 'fallback'
        ? 'bg-amber-400'
        : 'bg-red-500'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-white/10', color, className)} />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-[10px]">{miningPriceBasisTooltip(basis)}</TooltipContent>
    </Tooltip>
  )
}
