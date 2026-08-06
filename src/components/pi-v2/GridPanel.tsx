'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { gridHeadroomFor, type GridUsage } from '@/lib/pi-v2/grid'

/**
 * CPU e Powergrid.
 *
 * **Cor de identidade vs. cor de severidade.** O quadradinho ao lado do rótulo
 * usa as cores do jogo — Powergrid azul, CPU vermelho — para você saber qual
 * barra é qual. O PREENCHIMENTO usa verde/âmbar/vermelho só para dizer quão
 * cheio está. Misturar os dois faria a barra de CPU parecer sempre crítica.
 */

const WARN_UTILIZATION = 0.85
const CRIT_UTILIZATION = 0.95

const RESOURCE_SWATCH: Record<'power' | 'cpu', string> = {
  power: 'bg-sky-500',
  cpu: 'bg-red-500',
}

function GridBar({
  label,
  resource,
  used,
  total,
  utilization,
}: {
  label: string
  resource: 'power' | 'cpu'
  used: number
  total: number
  utilization: number
}) {
  const pct = Math.min(100, Math.round(utilization * 100))
  const over = used > total
  const severity: 'ok' | 'warn' | 'crit' =
    over || utilization >= CRIT_UTILIZATION
      ? 'crit'
      : utilization >= WARN_UTILIZATION
        ? 'warn'
        : 'ok'
  const fill =
    severity === 'crit' ? 'bg-red-500' : severity === 'warn' ? 'bg-amber-400' : 'bg-emerald-500'
  const valueColor =
    severity === 'crit' ? 'text-red-300' : severity === 'warn' ? 'text-amber-300' : 'text-zinc-400'

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span
            className={cn('h-2 w-2 shrink-0 rounded-sm', RESOURCE_SWATCH[resource])}
            aria-hidden
          />
          {label}
        </span>
        <span className={cn('tabular-nums', valueColor)}>
          {Math.round(used).toLocaleString()} / {total.toLocaleString()}{' '}
          <span className="text-zinc-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function GridPanel({ grid }: { grid: GridUsage }) {
  const { t } = useTranslations()

  // Custo por instalação tirado dos próprios processadores desta colônia — nada
  // assumido, então a folga reflete as estruturas que ela de fato tem.
  const adv = grid.breakdown.find((b) => b.role === 'advanced_processor')
  const headroom =
    adv && adv.count > 0
      ? gridHeadroomFor(grid, { power: adv.power / adv.count, cpu: adv.cpu / adv.count })
      : null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
        {t('piV2.grid.title')}
      </p>
      <div className="space-y-2">
        <GridBar
          label={t('piV2.grid.power')}
          resource="power"
          used={grid.power.used}
          total={grid.power.total}
          utilization={grid.power.utilization}
        />
        <GridBar
          label={t('piV2.grid.cpu')}
          resource="cpu"
          used={grid.cpu.used}
          total={grid.cpu.total}
          utilization={grid.cpu.utilization}
        />
      </div>

      {grid.overCapacity ? (
        <p className="mt-2 text-[11px] font-semibold text-red-300">{t('piV2.grid.overCapacity')}</p>
      ) : headroom != null && headroom > 0 ? (
        <p className="mt-2 text-[11px] text-emerald-300/90">
          {t('piV2.grid.headroom', { count: headroom })}
        </p>
      ) : null}

      <p className="mt-2 text-[10px] text-zinc-500">{t('piV2.grid.excludesLinks')}</p>
    </div>
  )
}
