'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Loader2, PauseCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/industry/format-relative-time'

interface IndustryJobRow {
  jobId: number
  characterId: number
  characterName: string
  activityId: number
  activityName: string
  productTypeId: number | null
  productName: string | null
  blueprintTypeId: number
  blueprintName: string
  runs: number
  startDate: string
  endDate: string
  status: string
  ready: boolean
  facilityId: string
}

interface JobsResponse {
  jobs: IndustryJobRow[]
  failed: number[]
  fetchedAt: number
  stale?: boolean
}

export function IndustryJobs() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<JobsResponse | null>(null)
  // Frame re-render every 30s so relative times ("in 3h 12m") stay live without a refetch.
  const [, setTick] = useState(0)

  const load = useCallback(async (forceRefresh: boolean) => {
    setLoading(true)
    try {
      const res = await fetch('/api/industry/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? t('industry.genericError'))
        return
      }
      setData(body as JobsResponse)
    } catch {
      toast.error(t('industry.genericError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load(false)
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const readyCount = useMemo(() => data?.jobs.filter((j) => j.ready).length ?? 0, [data])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-zinc-500">{t('industry.jobs.subtitle')}</p>
        <Button onClick={() => void load(true)} disabled={loading} size="sm" variant="outline" className="gap-1.5 border-zinc-800">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t('industry.jobs.refresh')}
        </Button>
      </div>

      {data?.failed && data.failed.length > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('industry.jobs.someFailed', { count: data.failed.length })}</span>
        </div>
      ) : null}

      {data?.stale ? (
        <div className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>{t('industry.jobs.stale')}</span>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('industry.jobs.loading')}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <span>{t('industry.jobs.summary', { count: data.jobs.length, ready: readyCount })}</span>
          </div>

          {data.jobs.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{t('industry.jobs.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="py-1.5 text-left font-semibold">{t('industry.jobs.character')}</th>
                    <th className="py-1.5 text-left font-semibold">{t('industry.jobs.activity')}</th>
                    <th className="py-1.5 text-left font-semibold">{t('industry.jobs.product')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.jobs.runs')}</th>
                    <th className="py-1.5 text-right font-semibold">{t('industry.jobs.ends')}</th>
                    <th className="py-1.5 text-left font-semibold">{t('industry.jobs.facility')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.jobs.map((job) => {
                    const remainingMs = new Date(job.endDate).getTime() - Date.now()
                    const displayName = job.productName ?? job.blueprintName
                    return (
                      <tr key={job.jobId} className="border-b border-zinc-900">
                        <td className="py-1.5 pr-2 text-zinc-300">{job.characterName}</td>
                        <td className="py-1.5 pr-2 text-zinc-400">{job.activityName}</td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`https://images.evetech.net/types/${job.productTypeId ?? job.blueprintTypeId}/icon?size=32`}
                              alt=""
                              width={24}
                              height={24}
                              loading="lazy"
                              className="shrink-0 rounded"
                            />
                            <span className="truncate text-zinc-200">{displayName}</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-zinc-400">{job.runs}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {job.ready ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              {t('industry.jobs.ready')}
                            </span>
                          ) : job.status === 'paused' ? (
                            // A paused job's timer is frozen — a relative countdown would be meaningless.
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              <PauseCircle className="h-3 w-3" />
                              {t('industry.jobs.paused')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-300">
                              <Clock className="h-3 w-3 text-zinc-500" />
                              {formatRelativeTime(remainingMs)}
                            </span>
                          )}
                          <div className="text-[10px] text-zinc-600">{new Date(job.endDate).toLocaleString()}</div>
                        </td>
                        <td className="py-1.5 text-zinc-500">{job.facilityId}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

