'use client'

import { Fragment, useCallback, useState } from 'react'
import { AlertTriangle, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface OrderBookFill {
  requestedQty: number
  filledQty: number
  sufficient: boolean
  avgUnitPrice: number
  bestUnitPrice: number
}

interface HubScanItemHub {
  hubId: string
  hubName: string
  buy: OrderBookFill
  sell: OrderBookFill
}

interface HubScanItem {
  typeId: number
  name: string
  quantity: number
  hubs: HubScanItemHub[]
  cheapestBuyHubId: string | null
  anySufficient: boolean
}

interface HubScanResult {
  items: HubScanItem[]
  unresolvedNames: string[]
  hubsScanned: { hubId: string; hubName: string }[]
}

const NEEDS_CONFIG_ERROR = 'Configure at least one hub in Industry Settings before scanning'

function ItemIcon({ typeId }: { typeId: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://images.evetech.net/types/${typeId}/icon?size=32`}
      alt=""
      width={24}
      height={24}
      loading="lazy"
      className="shrink-0 rounded"
    />
  )
}

function FillCell({ fill, highlight }: { fill: OrderBookFill; highlight?: boolean }) {
  const { t } = useTranslations()
  if (fill.filledQty === 0) {
    return <span className="text-[11px] text-zinc-600">{t('industry.hubScan.noStock')}</span>
  }
  return (
    <div className={cn('flex flex-col items-end', highlight && 'text-emerald-300')}>
      <span className={cn('tabular-nums', highlight ? 'font-semibold text-emerald-300' : 'text-zinc-200')}>
        {formatISK(fill.avgUnitPrice)}
      </span>
      {!fill.sufficient ? (
        <span className="flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          {t('industry.hubScan.insufficient', { filled: formatNumber(fill.filledQty), needed: formatNumber(fill.requestedQty) })}
        </span>
      ) : null}
    </div>
  )
}

export function HubScan() {
  const { t } = useTranslations()
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HubScanResult | null>(null)
  const [needsConfig, setNeedsConfig] = useState(false)
  const [unresolvedDismissed, setUnresolvedDismissed] = useState(false)

  const scan = useCallback(async () => {
    if (!text.trim()) {
      toast.error(t('industry.hubScan.emptyError'))
      return
    }
    setLoading(true)
    setNeedsConfig(false)
    setUnresolvedDismissed(false)
    try {
      const res = await fetch('/api/industry/hub-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 400 && data?.error === NEEDS_CONFIG_ERROR) {
          setNeedsConfig(true)
          setResult(null)
          return
        }
        toast.error(data?.error ?? t('industry.genericError'))
        setResult(null)
        return
      }
      setResult(data as HubScanResult)
    } catch {
      toast.error(t('industry.genericError'))
    } finally {
      setLoading(false)
    }
  }, [text, t])

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">{t('industry.hubScan.subtitle')}</p>

      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('industry.hubScan.pastePlaceholder')}
          rows={6}
          className="border-zinc-800 bg-zinc-950 text-sm text-zinc-200 placeholder:text-zinc-600"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-zinc-600">{t('industry.hubScan.pasteHint')}</span>
          <Button onClick={() => void scan()} disabled={loading} size="sm" className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {t('industry.hubScan.scan')}
          </Button>
        </div>
      </div>

      {needsConfig ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-300">{t('industry.hubScan.needHubs')}</p>
          <p className="mt-1 text-xs text-zinc-500">{t('industry.hubScan.needHubsHint')}</p>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          {result.unresolvedNames.length > 0 && !unresolvedDismissed ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                {t('industry.hubScan.unresolved', { count: result.unresolvedNames.length })}:{' '}
                {result.unresolvedNames.join(', ')}
              </span>
              <button
                type="button"
                onClick={() => setUnresolvedDismissed(true)}
                className="shrink-0 text-amber-400 hover:text-amber-200"
                aria-label={t('industry.hubScan.dismiss')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          {result.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('industry.hubScan.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th rowSpan={2} className="py-1.5 pr-2 text-left font-semibold align-bottom">
                      {t('industry.material')}
                    </th>
                    <th rowSpan={2} className="py-1.5 pr-2 text-right font-semibold align-bottom">
                      {t('industry.required')}
                    </th>
                    {result.hubsScanned.map((h) => (
                      <th key={h.hubId} colSpan={2} className="border-l border-zinc-900 px-2 py-1.5 text-center font-semibold">
                        {h.hubName}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    {result.hubsScanned.map((h) => (
                      <Fragment key={h.hubId}>
                        <th className="border-l border-zinc-900 px-2 py-1 text-right font-semibold">
                          {t('industry.hubScan.buy')}
                        </th>
                        <th className="px-2 py-1 text-right font-semibold">
                          {t('industry.hubScan.sell')}
                        </th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.typeId} className="border-b border-zinc-900">
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-2">
                          <ItemIcon typeId={item.typeId} />
                          <span className="truncate text-zinc-200">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-300">{formatNumber(item.quantity)}</td>
                      {result.hubsScanned.map((h) => {
                        const hubData = item.hubs.find((x) => x.hubId === h.hubId)
                        const isCheapest = item.cheapestBuyHubId === h.hubId
                        return (
                          <Fragment key={h.hubId}>
                            <td
                              className={cn('border-l border-zinc-900 px-2 py-1.5', isCheapest && 'bg-emerald-500/5')}
                            >
                              {hubData ? (
                                <div className="flex items-center justify-end gap-1">
                                  {isCheapest ? (
                                    <span
                                      title={
                                        item.anySufficient
                                          ? t('industry.hubScan.cheapestHint')
                                          : t('industry.hubScan.cheapestPartialHint')
                                      }
                                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] uppercase text-emerald-300"
                                    >
                                      {t('industry.hubScan.best')}
                                    </span>
                                  ) : null}
                                  <FillCell fill={hubData.buy} highlight={isCheapest} />
                                </div>
                              ) : (
                                <span className="block text-right text-[11px] text-zinc-600">{t('industry.hubScan.noStock')}</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5">
                              {hubData ? (
                                <div className="flex justify-end">
                                  <FillCell fill={hubData.sell} />
                                </div>
                              ) : (
                                <span className="block text-right text-[11px] text-zinc-600">{t('industry.hubScan.noStock')}</span>
                              )}
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
