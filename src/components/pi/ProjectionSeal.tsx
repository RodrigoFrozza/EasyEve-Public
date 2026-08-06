'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatBufferCountdown } from '@/lib/pi/format'
import { elapsedHoursSince, stalenessBand } from '@/lib/pi/project-forward'
import type { PiColonyAnalysis } from '@/lib/pi/types'

/**
 * Selo de honestidade da idade do snapshot (Fase A do motor de projeção). O dado
 * projetado nunca pode se passar por medido: a banda deriva de quanto tempo faz
 * desde o último snapshot da ESI. Só aparece quando o motor está ligado para o
 * usuário — com a flag OFF, `colony.projectionEnabled` é falsy e nada renderiza.
 */

const BAND_STYLES = {
  live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  estimated: 'border-zinc-600/50 bg-zinc-700/20 text-zinc-300',
  diverging: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  suspended: 'border-red-500/40 bg-red-500/10 text-red-200',
} as const

type Props = {
  colony: PiColonyAnalysis
  className?: string
}

export function ProjectionSeal({ colony, className }: Props) {
  const { t } = useTranslations()

  if (!colony.projectionEnabled) return null

  const elapsedHours = elapsedHoursSince(colony.lastUpdate, Date.now())
  const band = stalenessBand(elapsedHours)
  const age = formatBufferCountdown(elapsedHours) ?? '0m'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        'border',
        BAND_STYLES[band],
        className
      )}
      title={
        band === 'suspended'
          ? t('pi.projection.measuredTooltip')
          : t('pi.projection.projectedTooltip')
      }
    >
      {t(`pi.projection.${band}`, { age })}
    </span>
  )
}
