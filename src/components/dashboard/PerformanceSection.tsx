'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PeriodSelector } from './PeriodSelector'
import { PerformanceMetrics } from './PerformanceMetrics'

const PerformanceChart = dynamic(
  () => import('./PerformanceChart').then((mod) => mod.PerformanceChart),
  {
    ssr: false,
    loading: () => <div className="h-[300px] bg-zinc-800/30 rounded-xl animate-pulse" />,
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

interface PerformanceData {
  period: number
  generatedAt: string
  summary: {
    totalValue: number
    totalSessions: number
    topActivity: string
  }
  byActivity: Record<string, ActivityTrend>
  alerts: Array<{
    type: 'up' | 'down'
    activity: string
    message: string
  }>
}

export function PerformanceSection() {
  const [period, setPeriod] = useState(7)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedActivities, setSelectedActivities] = useState<string[]>([])

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

    setSelectedActivities(prev => 
      prev.includes(activity) 
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    )
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-12 bg-zinc-800/50 rounded-lg mb-4 w-48" />
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="h-20 bg-zinc-800/30 rounded-xl" />
          <div className="h-20 bg-zinc-800/30 rounded-xl" />
          <div className="h-20 bg-zinc-800/30 rounded-xl" />
          <div className="h-20 bg-zinc-800/30 rounded-xl" />
        </div>
        <div className="h-[300px] bg-zinc-800/30 rounded-xl" />
      </div>
    )
  }

  if (!data || !data.byActivity) {
    return (
      <div className="text-center py-8 text-zinc-500">
        Nenhum dado encontrado
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          Desempenho
        </h2>
        <PeriodSelector
          period={period}
          onPeriodChange={handlePeriodChange}
        />
      </div>

      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                alert.type === 'up'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              <span>{alert.type === 'up' ? '↑' : '↓'}</span>
              <span className="capitalize">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      <PerformanceMetrics
        data={data.byActivity}
        selectedActivities={selectedActivities}
        onActivityToggle={handleActivityToggle}
      />

      <PerformanceChart
        data={data.byActivity}
        selectedActivities={selectedActivities}
        period={period}
      />
    </div>
  )
}