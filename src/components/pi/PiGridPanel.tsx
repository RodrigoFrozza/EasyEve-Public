'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import type { PiGridUsage } from '@/lib/pi/pi-grid'
import { gridHeadroomFor } from '@/lib/pi/pi-grid'

// Severity thresholds for the bar FILL (how full a resource is). Amber/red are
// reserved for this — never for identifying which resource it is.
const GRID_WARN_UTILIZATION = 0.85
const GRID_CRIT_UTILIZATION = 0.95

// Resource IDENTITY uses the in-game colors (Powergrid blue, CPU red) on a small
// swatch, so you can tell the two bars apart at a glance without the fill color
// carrying that meaning.
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
  over,
}: {
  label: string
  resource: 'power' | 'cpu'
  used: number
  total: number
  utilization: number
  over: boolean
}) {
  const pct = Math.min(100, Math.round(utilization * 100))
  const severity: 'ok' | 'warn' | 'crit' =
    over || utilization >= GRID_CRIT_UTILIZATION
      ? 'crit'
      : utilization >= GRID_WARN_UTILIZATION
        ? 'warn'
        : 'ok'
  const fillColor =
    severity === 'crit' ? 'bg-red-500' : severity === 'warn' ? 'bg-amber-400' : 'bg-emerald-500'
  const valueColor =
    severity === 'crit' ? 'text-red-300' : severity === 'warn' ? 'text-amber-300' : 'text-zinc-400'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <span className={cn('h-2 w-2 shrink-0 rounded-sm', RESOURCE_SWATCH[resource])} aria-hidden />
          {label}
        </span>
        <span className={cn('tabular-nums', valueColor)}>
          {Math.round(used).toLocaleString()} / {total.toLocaleString()}{' '}
          <span className="text-zinc-500">({Math.round(utilization * 100)}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className={cn('h-full rounded-full', fillColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function PiGridPanel({ grid }: { grid: PiGridUsage }) {
  const { t } = useTranslations()

  // Real per-facility cost taken from the colony's own advanced processors (no
  // assumption) so the headroom estimate reflects this planet's structures.
  const adv = grid.breakdown.find((b) => b.role === 'advanced_processor')
  const headroom =
    adv && adv.count > 0
      ? gridHeadroomFor(grid, { power: adv.power / adv.count, cpu: adv.cpu / adv.count })
      : null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
        {t('pi.grid.title')}
      </p>
      <div className="space-y-2">
        <GridBar
          label={t('pi.grid.power')}
          resource="power"
          used={grid.power.used}
          total={grid.power.total}
          utilization={grid.power.utilization}
          over={grid.power.used > grid.power.total}
        />
        <GridBar
          label={t('pi.grid.cpu')}
          resource="cpu"
          used={grid.cpu.used}
          total={grid.cpu.total}
          utilization={grid.cpu.utilization}
          over={grid.cpu.used > grid.cpu.total}
        />
      </div>

      {grid.overCapacity ? (
        <p className="mt-2 text-[11px] font-semibold text-red-300">{t('pi.grid.overCapacity')}</p>
      ) : headroom != null && headroom > 0 ? (
        <p className="mt-2 text-[11px] text-emerald-300/90">
          {t('pi.grid.headroom', { count: headroom })}
        </p>
      ) : null}

      <p className="mt-2 text-[10px] text-zinc-500">{t('pi.grid.excludesLinks')}</p>
    </div>
  )
}
