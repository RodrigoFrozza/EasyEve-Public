'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ExternalLink, Flame, Hammer, Loader2, RefreshCw, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'

interface DeficitRow {
  productTypeId: number
  productName: string
  stationId: string
  stationName: string
  sellVolume: number
  buyVolume: number
  scarce: boolean
  itemPrice: number
  productionCost: number
  unitProfit: number
  margin: number
  buildVsBuy: 'make' | 'buy' | 'neutral'
  buildTimeSeconds: number | null
  iskPerHour: number | null
  demandVolume: number
  demandDays: number
  opportunityScore: number | null
  reliable: boolean
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

interface DeficitResponse {
  rows: DeficitRow[]
  stationsScanned: number
  stationsUnreachable?: number
  buyLabel: string
  me: number
}

export function WhatToProduce({
  configVersion = 0,
  onOpenInCalculator,
}: {
  configVersion?: number
  onOpenInCalculator?: (typeId: number, name: string) => void
}) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DeficitResponse | null>(null)
  const [needsConfig, setNeedsConfig] = useState(false)

  const scan = useCallback(async () => {
    setLoading(true)
    setNeedsConfig(false)
    try {
      const res = await fetch('/api/industry/deficits', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        // No monitored stations yet → onboarding hint instead of an error toast.
        if (res.status === 400) {
          setNeedsConfig(true)
          setResult(null)
          return
        }
        toast.error(data.error ?? t('industry.genericError'))
        setResult(null)
        return
      }
      setResult(data as DeficitResponse)
    } catch {
      toast.error(t('industry.genericError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Scan on mount and whenever the saved config changes (stations/hubs/ME).
  useEffect(() => {
    void scan()
  }, [scan, configVersion])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500">{t('industry.deficit.subtitle')}</p>
        <Button onClick={() => void scan()} disabled={loading} size="sm" variant="outline" className="gap-1.5 border-zinc-800">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t('industry.deficit.rescan')}
        </Button>
      </div>

      {needsConfig ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-300">{t('industry.deficit.needStations')}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('industry.deficit.needStationsHint')}</p>
        </div>
      ) : null}

      {loading && !result ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('industry.deficit.scanning')}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>
              {t('industry.deficit.scannedCount', { count: result.stationsScanned })}
              {result.stationsUnreachable ? ` · ${t('industry.deficit.unreachable', { count: result.stationsUnreachable })}` : ''}
            </span>
            <span>
              {t('industry.produce.buyAt')}: <span className="text-violet-200">{result.buyLabel}</span> · {t('industry.me')} {result.me}
            </span>
          </div>

          {result.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('industry.deficit.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-1.5 text-left font-semibold">{t('industry.produce.product')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.deficit.demandSupply')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.deficit.itemPrice')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.deficit.buildCost')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.margin')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.iskPerHour')}</th>
                    <th className="py-1.5 text-center font-semibold">{t('industry.deficit.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={`${r.stationId}-${r.productTypeId}`} className={cn('border-b border-zinc-900', !r.reliable && 'opacity-50')}>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://images.evetech.net/types/${r.productTypeId}/icon?size=32`}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                            className="shrink-0 rounded"
                          />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenInCalculator?.(r.productTypeId, r.productName)}
                              title={t('industry.deficit.openCalc')}
                              className="flex items-center gap-1.5 text-left text-zinc-200 hover:text-violet-200"
                            >
                              {r.scarce ? <Flame className="h-3 w-3 shrink-0 text-orange-400" aria-label={t('industry.produce.scarce')} /> : null}
                              {r.anyThin || r.anyNoPrice || r.anyStale ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" /> : null}
                              <span className="truncate">{r.productName}</span>
                            </button>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                              <span className="truncate">{r.stationName}</span>
                              <Link
                                href={`/market?type=${r.productTypeId}&structure=${r.stationId}&sname=${encodeURIComponent(r.stationName)}`}
                                target="_blank"
                                title={t('industry.deficit.openMarket')}
                                className="inline-flex shrink-0 items-center gap-0.5 text-zinc-500 hover:text-violet-300"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {t('industry.deficit.market')}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 text-right text-[11px] tabular-nums">
                        <span className="flex items-center justify-end gap-1">
                          <span className="text-emerald-300">{formatNumber(r.buyVolume)}</span>
                          <span className="text-zinc-600">/</span>
                          <span className={r.sellVolume === 0 ? 'text-orange-400' : 'text-zinc-400'}>{formatNumber(r.sellVolume)}</span>
                          {r.demandDays >= 2 ? (
                            <span
                              className="rounded-sm border border-sky-500/30 bg-sky-500/10 px-1 text-[9px] text-sky-300"
                              title={t('industry.deficit.demandDaysHint', { days: r.demandDays })}
                            >
                              {t('industry.deficit.demandDays', { days: r.demandDays })}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-300">{formatISK(r.itemPrice)}</td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-400">
                        {r.anyNoPrice ? t('industry.noOrders') : formatISK(r.productionCost)}
                      </td>
                      <td className={cn('py-1.5 text-right font-semibold tabular-nums', r.margin >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                        {r.reliable ? `${(r.margin * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className={cn('py-1.5 text-right tabular-nums', r.iskPerHour == null ? 'text-zinc-600' : r.iskPerHour >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                        {r.iskPerHour != null ? `${formatISK(r.iskPerHour)}/h` : '—'}
                      </td>
                      <td className="py-1.5 text-center">
                        {r.buildVsBuy === 'make' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300" title={t('industry.deficit.makeHint')}>
                            <Hammer className="h-3 w-3" />
                            {t('industry.deficit.make')}
                          </span>
                        ) : r.buildVsBuy === 'buy' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500" title={t('industry.deficit.buyHint')}>
                            <ShoppingBag className="h-3 w-3" />
                            {t('industry.deficit.buy')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-zinc-600">{t('industry.deficit.hint')}</p>
        </div>
      ) : null}
    </div>
  )
}
