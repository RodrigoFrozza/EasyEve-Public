'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useTranslations } from '@/i18n/hooks'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface StructureHistoryPoint {
  date: string
  sellVolume: number
  buyVolume: number
  bestSell: number
  bestBuy: number
}

interface RegionHistoryPoint {
  date: string
  average: number
  volume: number
}

interface TypeHistoryEntry {
  source: 'structure' | 'region' | 'both' | 'none'
  structure?: { structureId: string; points: StructureHistoryPoint[] }
  region?: { regionId: number; points: RegionHistoryPoint[]; stale: boolean }
  note?: string
}

function useMarketHistory(
  typeId: number,
  enabled: boolean
): { data: TypeHistoryEntry | null; loading: boolean; error: boolean } {
  const [data, setData] = useState<TypeHistoryEntry | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setLoading(true)
    setError(false)
    fetch(`/api/pi/market-history?typeIds=${typeId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad response'))))
      .then((d) => {
        if (!cancelled) setData(d.history?.[typeId] ?? null)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [typeId, enabled])

  return { data, loading, error }
}

const tooltipStyle = { background: '#0a1119', border: '1px solid #1e3044', fontSize: 11 }
const tooltipLabelStyle = { color: '#9ca3af' }

/**
 * Per-item stock/volume history — opens on demand (dialog), not fetched until the
 * user asks for it, so rendering a shopping list with dozens of rows never fires
 * dozens of history requests. Structure and region series are always two separate
 * charts, never merged into one line (different units/scale — see the API route).
 */
export function MarketHistoryChart({ typeId, typeName }: { typeId: number; typeName: string }) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(false)
  const { data, loading, error } = useMarketHistory(typeId, open)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('pi.marketHistory.trigger')}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-violet-300"
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('pi.marketHistory.title', { item: typeName })}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('pi.marketHistory.loading')}</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-400">{t('pi.marketHistory.error')}</p>
        ) : !data || data.source === 'none' ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {data?.note ?? t('pi.marketHistory.noneNote')}
          </p>
        ) : (
          <div className="space-y-6">
            {data.structure && data.structure.points.length > 0 ? (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {t('pi.marketHistory.structureTitle')}
                </h4>
                <div className="h-[220px] w-full rounded-md bg-eve-dark p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.structure.points}
                      margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e3044" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#1e3044"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        stroke="#1e3044"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        allowDecimals={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Area
                        type="monotone"
                        dataKey="sellVolume"
                        name={t('pi.marketHistory.sellVolume')}
                        stroke="#34d399"
                        fill="#34d39922"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="buyVolume"
                        name={t('pi.marketHistory.buyVolume')}
                        stroke="#f472b6"
                        fill="#f472b622"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}

            {data.region && data.region.points.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {t('pi.marketHistory.regionTitle')}
                  </h4>
                  {data.region.stale ? (
                    <span className="text-[10px] text-amber-400">
                      {t('pi.marketHistory.staleRegion')}
                    </span>
                  ) : null}
                </div>
                <div className="h-[220px] w-full rounded-md bg-eve-dark p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={data.region.points}
                      margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e3044" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#1e3044"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis stroke="#1e3044" fontSize={10} tickLine={false} axisLine={false} width={56} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Line
                        type="monotone"
                        dataKey="average"
                        name={t('pi.marketHistory.average')}
                        stroke="#60a5fa"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
