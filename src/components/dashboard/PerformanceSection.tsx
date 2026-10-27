'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PeriodSelector } from './PeriodSelector'
import { PerformanceMetrics } from './PerformanceMetrics'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { getActivityConfig } from '@/lib/dashboard/performance-config'

const PerformanceChart = dynamic(
  () => import('./PerformanceChart').then((mod) => mod.PerformanceChart),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[260px] h-[min(350px,45vw)] animate-pulse rounded-sm border border-eve-border/30 bg-eve-dark" />
    ),
  }
)

interface DailyData {
  date: string
  value: number
  sessions: number
  durationMinutes: number
}

interface ActivityTrend {
  activity: string
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  currentValue: number
  previousValue: number
  dailyData: DailyData[]
}

interface PerformanceAlert {
  type: 'up' | 'down'
  activity: string
  changePercent: number
}

interface PerformanceData {
  period: number
  generatedAt: string
  summary: {
    totalValue: number
    totalSessions: number
    topActivity: string
  }
  byActivity: Record<string, ActivityTrend>
  alerts: PerformanceAlert[]
}

export function PerformanceSection() {
  const [period, setPeriod] = useState(7)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])
  const { t } = useTranslations()

  useEffect(() => {
    const abortController = new AbortController()
    let mounted = true

    async function fetchData() {
      try {
        setLoading(true)
        const res = await fetch(`/api/analytics/performance?days=${period}`, {
          signal: abortController.signal,
        })
        if (!res.ok) throw new Error('Fetch failed')
        const json = await res.json()

        if (mounted && !abortController.signal.aborted) {
          setData(json)
          setLoading(false)
        }
      } catch (err) {
        if (mounted && err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to fetch performance data:', err)
          if (mounted) setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      mounted = false
      abortController.abort()
    }
  }, [period])

  const handlePeriodChange = (newPeriod: number) => {
    setPeriod(newPeriod)
    setSelectedActivities([])
  }

  const handleActivityToggle = (activity: string | null) => {
    if (activity === null) {
      setSelectedActivities([])
      return
    }

    setSelectedActivities((prev) =>
      prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded-sm border border-eve-border/30 bg-eve-dark" />
        <div className="flex flex-wrap gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 min-w-[9.5rem] flex-1 animate-pulse rounded-sm border border-eve-border/30 bg-eve-dark"
            />
          ))}
        </div>
        <div className="min-h-[260px] h-[min(350px,45vw)] animate-pulse rounded-sm border border-eve-border/30 bg-eve-dark" />
      </div>
    )
  }

  if (!data || !data.byActivity) {
    return (
      <div className="rounded-sm border border-eve-border/30 bg-eve-dark py-12 text-center text-xs text-eve-muted">
        {t('dashboard.performance.unavailable')}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-eve-border/30 pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-eve-text">
            {t('dashboard.performance.title')}
          </h2>
          <p className="text-[11px] text-eve-muted">
            {t('dashboard.performance.subtitle', { days: period })}
          </p>
        </div>
        <PeriodSelector period={period} onPeriodChange={handlePeriodChange} />
      </div>

      {data.alerts && data.alerts.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {data.alerts.map((alert, idx) => {
            const activityLabel = getActivityConfig(alert.activity).label
            const message =
              alert.type === 'up'
                ? t('dashboard.performance.alertUp', {
                    activity: activityLabel,
                    percent: alert.changePercent,
                  })
                : t('dashboard.performance.alertDown', {
                    activity: activityLabel,
                    percent: alert.changePercent,
                  })

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2.5 rounded-sm border px-3 py-2 text-xs',
                  alert.type === 'up'
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-400'
                )}
              >
                <div
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    alert.type === 'up' ? 'bg-emerald-400' : 'bg-rose-400'
                  )}
                />
                <span>{message}</span>
              </div>
            )
          })}
        </div>
      )}

      <PerformanceMetrics
        data={data.byActivity}
        summary={data.summary}
        selectedActivities={selectedActivities}
        onActivityToggle={handleActivityToggle}
      />

      <div className="overflow-hidden rounded-sm border border-eve-border bg-eve-panel p-2 sm:p-3">
        <PerformanceChart
          data={data.byActivity}
          selectedActivities={selectedActivities}
          period={period}
          emptyLabel={t('dashboard.performance.chartEmpty')}
        />
      </div>
    </div>
  )
}
