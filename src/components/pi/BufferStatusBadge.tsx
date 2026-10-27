'use client'

import { cn } from '@/lib/utils'
import { formatBufferCountdown } from '@/lib/pi/format'
import type { PiBufferStatus, PiColonyAnalysis } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import { PiItemIcon } from './PiItemIcon'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
}

const STATUS_STYLES: Record<PiBufferStatus['status'], string> = {
  running: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  starving_soon: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  // `degraded` fica entre `starving_soon` (âmbar) e `stalled` (vermelho): rosa.
  // Não pode repetir o âmbar (viraria o mesmo pixel de starving_soon) nem o
  // laranja (já é overflow_soon). Se a leitura falhar, falha para o lado mais
  // alarmante — confundir com `stalled` superestima o problema, confundir com
  // `starving_soon` o subestimaria.
  degraded: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  stalled: 'border-red-500/30 bg-red-500/10 text-red-200',
  overflow_soon: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  full: 'border-red-500/30 bg-red-500/10 text-red-200',
}

export function BufferStatusBadge({ colony, rateMode }: Props) {
  const { t } = useTranslations()
  const status =
    rateMode === 'potential' ? colony.bufferStatus : colony.bufferStatusCurrent

  return (
    <div className={cn('rounded-lg border p-3 text-xs', STATUS_STYLES[status.status])}>
      <p className="font-semibold uppercase tracking-wider">{t(`pi.buffer.status.${status.status}`)}</p>
      <div className="mt-2 space-y-1 text-[11px] opacity-90">
        {status.timeToStopHrs != null ? (
          <p>
            {t('pi.buffer.timeToStop')}: {formatBufferCountdown(status.timeToStopHrs) ?? '—'}
            {status.limitingTypeId ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <PiItemIcon typeId={status.limitingTypeId} size={16} />
              </span>
            ) : null}
          </p>
        ) : null}
        {status.timeToFullHrs != null ? (
          <p>
            {t('pi.buffer.timeToFull')}: {formatBufferCountdown(status.timeToFullHrs) ?? '—'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
