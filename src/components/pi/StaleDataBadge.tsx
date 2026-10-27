'use client'

import { cn } from '@/lib/utils'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  colony: PiColonyAnalysis
  className?: string
}

export function StaleDataBadge({ colony, className }: Props) {
  const { t } = useTranslations()

  if (!colony.isStale) return null

  const lastUpdateLabel = colony.lastUpdate
    ? new Date(colony.lastUpdate).toLocaleString()
    : t('pi.planet.staleUnknownDate')

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'cursor-help rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300',
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {t('pi.planet.stale')}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 whitespace-pre-line text-xs">
          <p>{t('pi.planet.staleTooltip')}</p>
          <p className="text-zinc-400">
            {t('pi.planet.lastUpdate')}: {lastUpdateLabel}
          </p>
          <p className="text-zinc-400">{t('pi.planet.staleSteps')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
