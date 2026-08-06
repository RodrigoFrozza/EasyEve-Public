'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatBufferCountdown } from '@/lib/pi/format'
import type { ProjectionConfidence } from '@/lib/pi-v2/projection'

/**
 * Selo de idade do dado.
 *
 * **É obrigatório em toda superfície que mostre número projetado.** Não é um
 * warning entre outros — é o rótulo de confiança de todos os demais números da
 * tela. Por isso mora junto do número, não num badge separado no canto.
 */

const BAND_STYLES = {
  live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  estimated: 'border-zinc-600/50 bg-zinc-700/20 text-zinc-300',
  diverging: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  suspended: 'border-red-500/40 bg-red-500/10 text-red-200',
} as const

export function StalenessSeal({
  confidence,
  className,
}: {
  confidence: ProjectionConfidence
  className?: string
}) {
  const { t } = useTranslations()
  const age = formatBufferCountdown(confidence.ageHours) ?? '0m'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        BAND_STYLES[confidence.band],
        className
      )}
      title={
        confidence.projectionApplied
          ? t('piV2.seal.projectedTooltip')
          : t('piV2.seal.measuredTooltip')
      }
    >
      {t(`piV2.seal.${confidence.band}`, { age })}
    </span>
  )
}

/**
 * Marca inline para um valor projetado ("≈ 400"). O medido aparece sem a marca.
 * Distinguir os dois visualmente é a regra que impede a projeção de se passar
 * por medição.
 */
export function ProjectedValue({
  value,
  projected,
  measured,
  className,
}: {
  value: string
  projected: boolean
  /** Valor medido, para o tooltip: de onde a estimativa partiu. */
  measured?: string
  className?: string
}) {
  const { t } = useTranslations()
  if (!projected) return <span className={cn('tabular-nums', className)}>{value}</span>
  return (
    <span
      className={cn('italic tabular-nums text-zinc-300', className)}
      title={measured != null ? t('piV2.seal.fromMeasured', { measured }) : undefined}
    >
      ≈{value}
    </span>
  )
}
