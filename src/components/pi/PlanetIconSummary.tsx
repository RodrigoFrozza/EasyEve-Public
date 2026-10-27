'use client'

import { cn } from '@/lib/utils'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { getColonyWarningState } from '@/lib/pi/colony-warnings'
import { formatPiPlanetTooltip } from '@/lib/pi/planet-label'
import { useTranslations } from '@/i18n/hooks'
import { PiPlanetIcon } from './PiPlanetIcon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type Props = {
  colonies: PiColonyAnalysis[]
}

const SEVERITY_RING: Record<string, string> = {
  red: 'ring-2 ring-red-500/60',
  amber: 'ring-2 ring-amber-500/50',
}

const SEVERITY_DOT: Record<string, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
}

export function PlanetIconSummary({ colonies }: Props) {
  const { t } = useTranslations()

  if (colonies.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {colonies.map((colony) => {
          const { severity } = getColonyWarningState(colony)
          return (
            <Tooltip key={colony.planetId}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'relative inline-flex shrink-0 rounded-full',
                    severity !== 'none' ? SEVERITY_RING[severity] : undefined
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <PiPlanetIcon
                    planetType={colony.planetType}
                    label={colony.planetTypeLabel}
                    size={22}
                  />
                  {severity !== 'none' ? (
                    <span
                      className={cn(
                        'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-zinc-900',
                        SEVERITY_DOT[severity]
                      )}
                    />
                  ) : null}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs whitespace-pre-line">
                {formatPiPlanetTooltip(colony, t)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
