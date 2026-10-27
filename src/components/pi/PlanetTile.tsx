'use client'

import { AlertTriangle } from 'lucide-react'
import { cn, formatCurrencyValue } from '@/lib/utils'
import { pickBufferCountdown, pickUrgentPinCountdown } from '@/lib/pi/format'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { colonyNetIskPerHour } from '@/lib/pi/rate-mode'
import { getCommodityName } from '@/lib/pi/pi-static-data'
import { hasUnroutedProductionValuation } from '@/lib/pi/colony-valuation-warnings'
import { getColonyWarningState } from '@/lib/pi/colony-warnings'
import { useTranslations } from '@/i18n/hooks'
import { PiPlanetIcon } from './PiPlanetIcon'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
  showWarnings?: boolean
  onClick: () => void
}

// The single most actionable problem for a colony, or null when it's healthy.
// A healthy card shows nothing extra — only ones that need attention speak up.
function colonyProblem(
  colony: PiColonyAnalysis,
  rateMode: 'potential' | 'current',
  t: (key: string, params?: Record<string, string | number>) => string
): string | null {
  const buffer = rateMode === 'potential' ? colony.bufferStatus : colony.bufferStatusCurrent
  const pinStatuses = rateMode === 'potential' ? colony.pinBuffers.potential : colony.pinBuffers.current
  const countdown = pickUrgentPinCountdown(pinStatuses) ?? pickBufferCountdown(buffer)
  const { warningCount, hasExpired } = getColonyWarningState(colony)

  if (buffer.status === 'stalled' || buffer.status === 'starving_soon') {
    const commodity = buffer.limitingTypeId ? getCommodityName(buffer.limitingTypeId) : null
    if (countdown?.time && commodity) {
      return t('pi.planet.stopsInMissing', { time: countdown.time, commodity })
    }
    if (countdown?.time) return t('pi.planet.storageEmptyIn', { time: countdown.time })
    return t(`pi.buffer.status.${buffer.status}`)
  }
  if (buffer.status === 'full' || buffer.status === 'overflow_soon') {
    return countdown?.time
      ? t('pi.planet.storageFullIn', { time: countdown.time })
      : t(`pi.buffer.status.${buffer.status}`)
  }
  if (buffer.status === 'degraded') {
    // `degraded` is a reclassified `stalled`: timeToStopHrs is typically <= 0,
    // so a countdown here would misleadingly read "stops in 0m". Only the
    // limiting commodity (when known) makes the message more specific.
    const commodity = buffer.limitingTypeId ? getCommodityName(buffer.limitingTypeId) : null
    return commodity
      ? t('pi.planet.partialProductionMissing', { commodity })
      : t('pi.planet.partialProduction')
  }
  if (hasExpired) return t('pi.planet.expiredExtractor')
  if (hasUnroutedProductionValuation(colony, rateMode)) {
    return t('pi.warnings.unroutedProductionShort')
  }
  if (warningCount > 0) return t('pi.planet.warningsShort', { count: warningCount })
  if (colony.isStale) return t('pi.planet.staleShort')
  return null
}

export function PlanetTile({ colony, rateMode, showWarnings = true, onClick }: Props) {
  const { t } = useTranslations()

  const displayNet = colonyNetIskPerHour(colony, rateMode)
  const problem = showWarnings ? colonyProblem(colony, rateMode, t) : null
  const title = colony.planetName ?? colony.solarSystemName

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-left transition-colors hover:border-violet-400/30 hover:bg-zinc-800/60',
        problem && 'border-amber-500/25'
      )}
    >
      <div className="flex items-center gap-2">
        <PiPlanetIcon planetType={colony.planetType} label={colony.planetTypeLabel} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">
            {title}
            {colony.exitName ? (
              <span className="font-normal text-zinc-500"> · {colony.exitName}</span>
            ) : null}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            displayNet >= 0 ? 'text-emerald-300' : 'text-red-400'
          )}
        >
          {formatCurrencyValue(displayNet)}
          <span className="ml-0.5 text-[10px] font-normal text-zinc-500">/h</span>
        </span>
      </div>
      {problem ? (
        <p className="flex items-start gap-1 text-[11px] leading-tight text-amber-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0">{problem}</span>
        </p>
      ) : null}
    </button>
  )
}
