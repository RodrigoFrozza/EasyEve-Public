'use client'

import { useMemo, useState } from 'react'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, isMiningActivity } from '@/types/domain'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import type { ActivityType } from '@/lib/constants/activity-colors'
import { getLogValue, type AnalyticsLogEntry } from '@/lib/activity/activity-analytics'
import { motion } from 'framer-motion'
import { Clock, TrendingUp, Zap, Eye, EyeOff } from 'lucide-react'

interface TimelineTabProps {
  activity: ActivityEnhanced
  color?: 'blue' | 'rose' | 'emerald' | 'purple'
}

interface LogEntry {
  date: string
  amount: number
  type?: string
  charName?: string
  charId?: number
  oreName?: string
  quantity?: number
  value?: number
  [key: string]: any
}

export function TimelineTab({ activity, color = 'blue' }: TimelineTabProps) {
  const { t } = useTranslations()
  const [showChart, setShowChart] = useState(true)

  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const sessionHours = useMemo(() => {
    const durationMs = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    })
    return Math.max(0.1, durationMs / 3_600_000)
  }, [
    activity.startTime,
    activity.endTime,
    activity.status,
    activity.updatedAt,
    activity.accumulatedPausedTime,
    activity.isPaused,
    activity.pausedAt,
  ])

  const logs = useMemo(() => {
    const raw = activity.data as { logs?: LogEntry[] } | undefined
    return (raw?.logs || []) as LogEntry[]
  }, [activity.data])

  const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    rose: '#f43f5e',
    emerald: '#10b981',
    purple: '#a855f7',
  }
  
  const chartColor = colorMap[color] || colorMap.blue

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [logs])

  const chartData = useMemo(() => {
    if (sortedLogs.length === 0) return []

    const startTime = new Date(activity.startTime).getTime()
    const durationMs = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    })
    const totalDuration = Math.max(1, durationMs)
    
    return sortedLogs.map((log, idx) => {
      const logTime = new Date(log.date).getTime()
      const elapsed = logTime - startTime
      const progressPct = (elapsed / totalDuration) * 100
      
      const activityType = activity.type as ActivityType
      const runningTotal = sortedLogs.slice(0, idx + 1).reduce(
        (sum, l) => sum + getLogValue(l as AnalyticsLogEntry, activityType),
        0,
      )

      // Calculate ISK/hour at this point
      const hoursSinceStart = Math.max(0.1, elapsed / (1000 * 60 * 60))
      const iskPerHour = runningTotal / hoursSinceStart

      return {
        ...log,
        progressPct,
        cumulative: runningTotal,
        iskPerHour,
        formattedTime: new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        formattedDate: new Date(log.date).toLocaleDateString(),
      }
    })
  }, [sortedLogs, activity])

  const sessionRateNumerator = isMiningActivity(activity) ? metrics.miningValue : metrics.net

  const maxValue = Math.max(...chartData.map(d => d.cumulative), 1)

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center opacity-40">
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
          {t('common.session.noLogs')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chart Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            {t('activity.summary.iskOverTime')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowChart(!showChart)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-none text-[9px] font-black uppercase tracking-wider transition-all",
            showChart 
              ? "bg-white/10 text-zinc-300" 
              : "bg-white/5 text-zinc-500 hover:text-zinc-300"
          )}
        >
          {showChart ? (
            <><EyeOff className="h-3 w-3" /> {t('activity.summary.hide')}</>
          ) : (
            <><Eye className="h-3 w-3" /> {t('activity.summary.show')}</>
          )}
        </button>
      </div>

      {/* Simple Line Chart */}
      {showChart && chartData.length > 1 && (
        <div className="relative h-40 bg-black border border-zinc-900 rounded-none p-4 overflow-hidden">
          {/* Y-Axis Labels */}
          <div className="absolute left-2 top-4 bottom-8 w-8 flex flex-col justify-between text-[8px] font-black text-zinc-600">
            <span>{formatISK(maxValue)}</span>
            <span>{formatISK(maxValue / 2)}</span>
            <span>0</span>
          </div>

          {/* Chart Area */}
          <div className="ml-10 h-full relative">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2].map(i => (
                <div key={i} className="border-t border-white/5" />
              ))}
            </div>

            {/* Line Graph */}
            <svg className="w-full h-full" preserveAspectRatio="none">
              {/* Area fill */}
              <defs>
                <linearGradient id="iskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Area under curve */}
              <path
                d={`M 0,100 ${chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 100
                  const y = 100 - (d.cumulative / maxValue) * 100
                  return `L ${x},${y}`
                }).join(' ')} L 100,100 Z`}
                fill="url(#iskGradient)"
              />
              
              {/* Line */}
              <path
                d={chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 100
                  const y = 100 - (d.cumulative / maxValue) * 100
                  return `${i === 0 ? 'M' : 'L'} ${x},${y}`
                }).join(' ')}
                fill="none"
                stroke={chartColor}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              
              {/* Points */}
              {chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 100
                const y = 100 - (d.cumulative / maxValue) * 100
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3"
                    fill={chartColor}
                    className="cursor-pointer hover:r-4 transition-all"
                  />
                )
              })}
            </svg>
          </div>

          {/* X-Axis Labels */}
          <div className="absolute bottom-2 left-10 right-2 flex justify-between text-[8px] font-black text-zinc-600">
            <span>{chartData[0]?.formattedTime}</span>
            <span>{chartData[chartData.length - 1]?.formattedTime}</span>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-black border border-zinc-900 rounded-none">
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('activity.summary.peakRate')}</p>
            <p className="text-lg font-black text-zinc-200">
              {formatISK(Math.max(...chartData.map(d => d.iskPerHour)))}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('activity.summary.averageRate')}</p>
            <p className="text-lg font-black text-zinc-200">
              {formatISK(sessionRateNumerator / sessionHours)}
            </p>
          </div>
        </div>
      )}

      {/* Logs List (Collapsible) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Clock className="h-4 w-4 text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            {t('common.session.timeline')} ({logs.length} {t('activity.summary.entries')})
          </span>
        </div>

        {chartData.slice(-10).reverse().map((log, idx) => (
          <div 
            key={idx}
            className="flex items-center justify-between px-4 py-3 bg-black border border-zinc-900 rounded-none hover:bg-zinc-900/60 transition-all"
          >
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-sm font-black text-zinc-200">
                  {log.formattedTime}
                </p>
                <p className="text-[9px] text-zinc-500">
                  {log.charName || t('common.unknown')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-zinc-200 font-mono">
                {formatISK(getLogValue(log as AnalyticsLogEntry, activity.type as ActivityType))}
              </p>
              <p className="text-[9px] text-zinc-500 font-mono">
                {formatISK(log.iskPerHour)}/h
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}