'use client'

import type { MiningPersonalOverviewResponse } from '@/lib/analytics/mining-personal-overview'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { MinersRestEmpty, MinersRestSection, minersRestTheme } from '../MinersRestSection'
import { Loader2 } from 'lucide-react'

type Props = {
  data: MiningPersonalOverviewResponse | null
  loading: boolean
}

function BarRow({
  label,
  isk,
  maxIsk,
  sub,
}: {
  label: string
  isk: number
  maxIsk: number
  sub?: string
}) {
  const width = maxIsk > 0 ? Math.min(100, (isk / maxIsk) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={cn('font-medium', minersRestTheme.text)}>{label}</span>
        <div className="text-right">
          <span className="font-mono tabular-nums text-zinc-400">
            {formatCurrencyValue(isk)}
          </span>
          {sub ? (
            <p className="text-[10px] font-mono tabular-nums text-zinc-500">{sub}</p>
          ) : null}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className={cn('h-full rounded-full', minersRestTheme.accentBar)}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function iskPerHour(isk: number, durationMs?: number): string {
  if (!durationMs || durationMs <= 0) return '—'
  const hours = durationMs / 3_600_000
  return formatCurrencyValue(isk / hours)
}

export function GeoBreakdownPanel({ data, loading }: Props) {
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

  const maxSpaceIsk = Math.max(...data.bySpace.map((r) => r.isk), 1)
  const maxRegionIsk = Math.max(...data.byRegion.map((r) => r.isk), 1)
  const maxConstellationIsk = Math.max(...data.byConstellation.map((r) => r.isk), 1)

  return (
    <div className="space-y-8">
      <MinersRestSection title={t('minersRest.geo.bySpace')}>
        {data.bySpace.length === 0 ? (
          <MinersRestEmpty message={t('minersRest.empty.noGeo')} />
        ) : (
          <div className="space-y-4">
            {data.bySpace.map((row) => (
              <BarRow
                key={row.key}
                label={row.label}
                isk={row.isk}
                maxIsk={maxSpaceIsk}
                sub={`${t('minersRest.kpi.iskPerHour')}: ${iskPerHour(row.isk, row.durationMs)}`}
              />
            ))}
          </div>
        )}
      </MinersRestSection>

      <MinersRestSection title={t('minersRest.geo.byRegion')}>
        {data.byRegion.length === 0 ? (
          <MinersRestEmpty message={t('minersRest.empty.noRegions')} />
        ) : (
          <div className="space-y-4">
            {data.byRegion.slice(0, 15).map((row) => (
              <BarRow
                key={row.regionId}
                label={row.name}
                isk={row.isk}
                maxIsk={maxRegionIsk}
                sub={`${t('minersRest.kpi.iskPerHour')}: ${iskPerHour(row.isk, row.durationMs)}`}
              />
            ))}
          </div>
        )}
      </MinersRestSection>

      {data.byConstellation.length > 0 ? (
        <MinersRestSection title={t('minersRest.geo.byConstellation')}>
          <div className="space-y-4">
            {data.byConstellation.slice(0, 12).map((row) => (
              <BarRow
                key={row.constellationId}
                label={row.name}
                isk={row.isk}
                maxIsk={maxConstellationIsk}
                sub={`${t('minersRest.kpi.iskPerHour')}: ${iskPerHour(row.isk, row.durationMs)}`}
              />
            ))}
          </div>
        </MinersRestSection>
      ) : null}

      <MinersRestSection title={t('minersRest.geo.bySolarSystem')}>
        {data.bySolarSystem.length === 0 ? (
          <MinersRestEmpty message={t('minersRest.empty.noSystems')} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase text-zinc-500">
                <th className="pb-2">{t('minersRest.geo.system')}</th>
                <th className="pb-2 text-right">{t('minersRest.kpi.sessions')}</th>
                <th className="pb-2 text-right">m³</th>
                <th className="pb-2 text-right">ISK</th>
                <th className="pb-2 text-right">{t('minersRest.kpi.iskPerHour')}</th>
              </tr>
            </thead>
            <tbody>
              {data.bySolarSystem.slice(0, 25).map((row) => (
                <tr key={row.solarSystemId} className="border-b border-white/5">
                  <td className={cn('py-2 font-medium', minersRestTheme.text)}>{row.name}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                    {row.sessions}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                    {formatCompactNumber(Math.round(row.m3))}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-300">
                    {formatCurrencyValue(row.isk)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-zinc-400">
                    {iskPerHour(row.isk, row.durationMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </MinersRestSection>
    </div>
  )
}
