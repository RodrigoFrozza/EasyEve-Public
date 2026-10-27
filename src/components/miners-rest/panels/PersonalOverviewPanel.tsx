'use client'

import { format, parseISO } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MiningPersonalOverviewResponse } from '@/lib/analytics/mining-personal-overview'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestEmpty, MinersRestSection, minersRestTheme } from '../MinersRestSection'
import { Loader2 } from 'lucide-react'

type Props = {
  data: MiningPersonalOverviewResponse | null
  loading: boolean
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        minersRestTheme.metricShell,
        'border-cyan-400/20 bg-cyan-400/5'
      )}
    >
      <p className={cn('text-[10px] font-bold uppercase tracking-wider', minersRestTheme.textMuted)}>
        {label}
      </p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums', minersRestTheme.text)}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  )
}

export function PersonalOverviewPanel({ data, loading }: Props) {
  const { t } = useTranslations()

  if (loading && !data) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className={cn('h-8 w-8 animate-spin', minersRestTheme.text)} />
      </div>
    )
  }

  if (!data) {
    return <MinersRestEmpty message={t('minersRest.empty.noData')} />
  }

  const { meta, timeline, byOre, byCharacter } = data

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label={t('minersRest.kpi.totalIsk')}
          value={formatCurrencyValue(meta.totalIsk)}
        />
        <KpiCard
          label={t('minersRest.kpi.iskPerHour')}
          value={
            meta.avgIskPerHour != null ? formatCurrencyValue(meta.avgIskPerHour) : '—'
          }
        />
        <KpiCard
          label={t('minersRest.kpi.m3PerHour')}
          value={
            meta.avgM3PerHour != null
              ? `${formatCompactNumber(Math.round(meta.avgM3PerHour))} m³`
              : '—'
          }
        />
        <KpiCard
          label={t('minersRest.kpi.totalM3')}
          value={`${formatCompactNumber(Math.round(meta.totalM3))} m³`}
        />
        <KpiCard
          label={t('minersRest.kpi.sessions')}
          value={String(meta.sessionCount)}
        />
      </div>

      <MinersRestSection title={t('minersRest.personal.timeline')}>
        {timeline.length === 0 ? (
          <MinersRestEmpty message={t('minersRest.empty.noTimeline')} />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="iskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(value) => {
                    try {
                      return format(parseISO(String(value)), 'dd/MM')
                    } catch {
                      return String(value)
                    }
                  }}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  tickFormatter={(v) => formatCompactNumber(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0c141c',
                    border: '1px solid rgba(34,211,238,0.2)',
                    borderRadius: 8,
                  }}
                  formatter={(value) => [
                    formatCurrencyValue(Number(value ?? 0)),
                    'ISK',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="isk"
                  stroke="#22d3ee"
                  fill="url(#iskGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </MinersRestSection>

      <div className="grid gap-8 lg:grid-cols-2">
        <MinersRestSection title={t('minersRest.personal.topOres')}>
          {byOre.length === 0 ? (
            <MinersRestEmpty message={t('minersRest.empty.noOres')} />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                  <th className="pb-2">{t('activity.intel.item')}</th>
                  <th className="pb-2 text-right">m³</th>
                  <th className="pb-2 text-right">ISK</th>
                </tr>
              </thead>
              <tbody>
                {byOre.slice(0, 10).map((row) => (
                  <tr key={row.typeId} className="border-b border-white/5">
                    <td className={cn('py-2 font-medium uppercase', minersRestTheme.textMuted)}>
                      {row.name}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                      {formatCompactNumber(Math.round(row.m3))}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-zinc-300">
                      {formatCurrencyValue(row.isk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MinersRestSection>

        <MinersRestSection title={t('minersRest.personal.byCharacter')}>
          {byCharacter.length === 0 ? (
            <MinersRestEmpty message={t('minersRest.empty.noCharacters')} />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                  <th className="pb-2">{t('minersRest.personal.character')}</th>
                  <th className="pb-2 text-right">{t('minersRest.kpi.sessions')}</th>
                  <th className="pb-2 text-right">ISK</th>
                </tr>
              </thead>
              <tbody>
                {byCharacter.map((row) => (
                  <tr key={row.key} className="border-b border-white/5">
                    <td className={cn('py-2 font-medium', minersRestTheme.text)}>{row.label}</td>
                    <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                      {row.sessions}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-zinc-300">
                      {formatCurrencyValue(row.isk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </MinersRestSection>
      </div>
    </div>
  )
}
