'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Hammer, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'

interface BestOutputRow {
  productTypeId: number
  productName: string
  bestMe: number
  bestTe: number
  materialCost: number
  sellPrice: number
  unitProfit: number
  margin: number
  buildTimeSeconds: number | null
  iskPerHour: number | null
  sellDemand: number
  opportunityScore: number | null
  reliable: boolean
  anyThin: boolean
  anyNoPrice: boolean
  anyStale: boolean
}

interface BestOutputsResponse {
  rows: BestOutputRow[]
  needsBlueprints?: boolean
  buyLabel?: string
  sellLabel?: string
}

export function BestOutputs({
  configVersion = 0,
  onOpenInCalculator,
}: {
  configVersion?: number
  onOpenInCalculator?: (typeId: number, name: string) => void
}) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BestOutputsResponse | null>(null)

  const scan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/industry/best-outputs', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? t('industry.genericError'))
        setResult(null)
        return
      }
      setResult(data as BestOutputsResponse)
    } catch {
      toast.error(t('industry.genericError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void scan()
  }, [scan, configVersion])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500">{t('industry.best.subtitle')}</p>
        <Button onClick={() => void scan()} disabled={loading} size="sm" variant="outline" className="gap-1.5 border-zinc-800">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t('industry.deficit.rescan')}
        </Button>
      </div>

      {result?.needsBlueprints ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-300">{t('industry.best.needBlueprints')}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('industry.best.needBlueprintsHint')}</p>
        </div>
      ) : null}

      {loading && !result ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('industry.best.scanning')}
        </div>
      ) : null}

      {result && !result.needsBlueprints ? (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>{t('industry.best.count', { count: result.rows.length })}</span>
            <span>
              {t('industry.produce.buyAt')}: <span className="text-violet-200">{result.buyLabel}</span> ·{' '}
              {t('industry.sellAt')} <span className="text-violet-200">{result.sellLabel}</span>
            </span>
          </div>

          {result.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('industry.best.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-1.5 text-left font-semibold">{t('industry.produce.product')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.best.sellPrice')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.deficit.buildCost')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.margin')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.iskPerHour')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.best.demand')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.productTypeId} className={cn('border-b border-zinc-900', !r.reliable && 'opacity-50')}>
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
                              {r.anyThin || r.anyNoPrice || r.anyStale ? (
                                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                              ) : null}
                              <span className="truncate">{r.productName}</span>
                            </button>
                            <div className="text-[10px] text-zinc-600">
                              {t('industry.best.ownedBp', { me: r.bestMe, te: r.bestTe })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-300">{formatISK(r.sellPrice)}</td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-400">
                        {r.anyNoPrice ? t('industry.noOrders') : formatISK(r.materialCost)}
                      </td>
                      <td className={cn('py-1.5 text-right font-semibold tabular-nums', r.margin >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                        {r.reliable ? `${(r.margin * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className={cn('py-1.5 text-right tabular-nums', r.iskPerHour == null ? 'text-zinc-600' : r.iskPerHour >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                        {r.iskPerHour != null ? `${formatISK(r.iskPerHour)}/h` : '—'}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-400">{formatNumber(r.sellDemand)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-zinc-600">{t('industry.best.hint')}</p>
        </div>
      ) : null}
    </div>
  )
}
