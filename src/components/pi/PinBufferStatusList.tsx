'use client'

import { cn } from '@/lib/utils'
import { formatBufferCountdown, formatPiRate } from '@/lib/pi/format'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import { PiItemIcon } from './PiItemIcon'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
}

const STATUS_STYLES = {
  running: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  starving_soon: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  // Mesma paleta de BufferStatusBadge — ver comentário lá.
  degraded: 'border-rose-500/40 bg-rose-500/15 text-rose-200',
  stalled: 'border-red-500/30 bg-red-500/10 text-red-200',
  overflow_soon: 'border-orange-500/30 bg-orange-500/10 text-orange-200',
  full: 'border-red-500/30 bg-red-500/10 text-red-200',
} as const

export function PinBufferStatusList({ colony, rateMode }: Props) {
  const { t } = useTranslations()
  const pinStatuses =
    rateMode === 'potential' ? colony.pinBuffers.potential : colony.pinBuffers.current

  if (pinStatuses.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
        {t('pi.buffer.noPins')}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {t('pi.buffer.pinTitle')}
      </h4>
      {pinStatuses.map((pin) => {
        const hasActiveFlows = pin.flows.some((f) => f.inPerHour > 0 || f.outPerHour > 0)
        const capacityPct =
          pin.capacityM3 > 0 ? Math.min(100, (pin.usedM3 / pin.capacityM3) * 100) : 0
        const fullTime = hasActiveFlows ? formatBufferCountdown(pin.timeToFullHrs) : null
        const emptyTime = hasActiveFlows ? formatBufferCountdown(pin.timeToEmptyHrs) : null
        const restockTime = hasActiveFlows ? formatBufferCountdown(pin.restockDueHrs) : null

        return (
          <div
            key={pin.pinId}
            className={cn(
              'rounded-lg border p-3 text-xs',
              hasActiveFlows ? STATUS_STYLES[pin.status] : 'border-zinc-800 bg-zinc-900/40 text-zinc-400'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{pin.label}</p>
              {hasActiveFlows ? (
                <span className="shrink-0 uppercase tracking-wider opacity-80">
                  {t(`pi.buffer.status.${pin.status}`)}
                </span>
              ) : null}
            </div>

            {pin.capacityM3 > 0 ? (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] opacity-80">
                  <span>
                    {Math.round(pin.usedM3).toLocaleString()} / {Math.round(pin.capacityM3).toLocaleString()} m³
                  </span>
                  <span>{Math.round(capacityPct)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full rounded-full bg-current opacity-60"
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            {pin.flows.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-left opacity-70">
                      <th className="pb-1 pr-2 font-medium">{t('pi.buffer.commodity')}</th>
                      <th className="pb-1 pr-2 font-medium text-right">{t('pi.buffer.flowsIn')}</th>
                      <th className="pb-1 pr-2 font-medium text-right">{t('pi.buffer.flowsOut')}</th>
                      <th className="pb-1 font-medium text-right">{t('pi.buffer.stock')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pin.flows.map((flow) => (
                      <tr key={flow.typeId} className="border-t border-current/10">
                        <td className="py-1 pr-2">
                          <span className="inline-flex items-center gap-1">
                            <PiItemIcon typeId={flow.typeId} size={14} />
                            <span className="truncate">{flow.name}</span>
                          </span>
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-emerald-300/90">
                          +{formatPiRate(flow.inPerHour)}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums text-red-300/90">
                          -{formatPiRate(flow.outPerHour)}
                        </td>
                        <td
                          className={cn(
                            'py-1 text-right tabular-nums',
                            flow.projected && 'italic opacity-90'
                          )}
                          title={flow.projected ? t('pi.projection.projectedTooltip') : undefined}
                        >
                          {flow.projected ? '≈' : ''}
                          {formatPiRate(flow.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-[10px] opacity-70">{t('pi.buffer.noFlows')}</p>
            )}

            <div className="mt-2 space-y-0.5 text-[10px] opacity-90">
              {fullTime ? (
                <p>{t('pi.planet.storageFullIn', { time: fullTime })}</p>
              ) : null}
              {emptyTime ? (
                <p className="inline-flex items-center gap-1">
                  {t('pi.planet.storageEmptyIn', { time: emptyTime })}
                  {pin.limitingEmptyTypeId ? (
                    <PiItemIcon typeId={pin.limitingEmptyTypeId} size={14} />
                  ) : null}
                </p>
              ) : null}
              {restockTime ? (
                <p className="opacity-80">{t('pi.buffer.restockDueIn', { time: restockTime })}</p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
