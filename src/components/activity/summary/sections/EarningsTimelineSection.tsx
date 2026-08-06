'use client'

import { useMemo, useState } from 'react'
import { ActivityEnhanced } from '@/types/domain'
import type { ActivityType } from '@/lib/constants/activity-colors'
import {
  getLogValue,
  getRattingLogSignedValue,
  getEscalationsLogSignedValue,
  type AnalyticsLogEntry,
} from '@/lib/activity/activity-analytics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { ExpandableSection, SESSION_SECTION_LABEL } from '../shared/ExpandableSection'
import { TrendingUp, Clock, Zap, ArrowUpRight, ArrowDownRight, Activity as ActivityIcon } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface EarningsTimelineSectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

/** Same per-type signed value used by the live analytics dialog — expenses/dropped
 *  escalations/"other" logs must not be added as if they were income here too,
 *  otherwise this timeline's totals diverge from the live gross/net shown elsewhere. */
function getSignedLogValue(log: AnalyticsLogEntry, activityType: ActivityType): number {
  if (activityType === 'ratting') return getRattingLogSignedValue(log)
  if (activityType === 'escalations') return getEscalationsLogSignedValue(log)
  return getLogValue(log, activityType)
}

export function EarningsTimelineSection({
  activity,
  theme,
}: EarningsTimelineSectionProps) {
  const { t } = useTranslations()
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null)

  const logs = useMemo(() => {
    const data = activity.data as any
    return (data.logs || []) as any[]
  }, [activity.data])

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
    
    let runningTotal = 0
    return sortedLogs.map((log, idx) => {
      const logTime = new Date(log.date).getTime()
      const elapsed = logTime - startTime
      const progressPct = (elapsed / Math.max(1, totalDuration)) * 100
      
      runningTotal += getSignedLogValue(log as AnalyticsLogEntry, activity.type as ActivityType)

      const hoursSinceStart = Math.max(0.01, elapsed / (1000 * 60 * 60))
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

  const maxValue = Math.max(...chartData.map(d => d.cumulative), 1)
  const peakRate = Math.max(...chartData.map(d => d.iskPerHour), 0)

  if (logs.length === 0) return null

  const accent = theme?.revenuePositive ?? 'text-eve-accent'

  return (
    <ExpandableSection
      title={t('common.session.earningsTimeline')}
      icon={<TrendingUp className="h-4 w-4" />}
      variant="accent"
      accentClassName={theme?.headerIcon}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <div className="flex items-center gap-4 mt-1">
          <span
            className={cn(
              'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
              SESSION_SECTION_LABEL
            )}
          >
            {t('common.session.timelineEntries', { count: logs.length })}
          </span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span
            className={cn(
              'flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-[0.2em]',
              accent
            )}
          >
            <ArrowUpRight className="h-3 w-3" /> {formatISK(peakRate)}/h
          </span>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* Interactive Chart */}
        <div className="relative h-48 bg-black border border-eve-border/30 rounded-none p-4 overflow-hidden group">
          {/* Grid */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
            {[0, 1, 2, 3].map(i => <div key={i} className="border-t border-white/10 w-full" />)}
          </div>

          <div className="relative h-full ml-12">
             <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              <path
                d={`M 0,100 ${chartData.map((d) => `L ${d.progressPct},${100 - (d.cumulative / maxValue) * 100}`).join(' ')} L 100,100 Z`}
                fill="url(#timelineGradient)"
              />
              
              <path
                d={chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.progressPct},${100 - (d.cumulative / maxValue) * 100}`).join(' ')}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />

              {chartData.map((d, i) => (
                <circle
                  key={i}
                  cx={d.progressPct}
                  cy={100 - (d.cumulative / maxValue) * 100}
                  r="1.5"
                  fill="#06b6d4"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(d)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>

            {/* Hover Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute top-0 right-0 p-3 bg-black border border-eve-border/50 rounded-none shadow-none z-10 pointer-events-none transition-none"
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-1 font-mono">
                  {hoveredPoint.formattedTime} · {hoveredPoint.charName}
                </p>
                <p className="text-sm font-black text-white font-mono tracking-widest">
                  {formatISK(hoveredPoint.cumulative)}
                </p>
                <p className="text-[10px] font-black text-eve-accent font-mono uppercase tracking-wider">
                  {t('common.session.timelineRate', { value: formatISK(hoveredPoint.iskPerHour) })}
                </p>
              </div>
            )}
          </div>

          {/* Y-Axis */}
          <div className="absolute left-2 top-4 bottom-4 w-10 flex flex-col justify-between text-[8px] font-black text-zinc-600 font-mono">
            <span>{formatISK(maxValue)}</span>
            <span>0</span>
          </div>
        </div>

        {/* Log List */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 no-scrollbar">
          {chartData.slice().reverse().map((log) => (
            <div 
              key={String(log.refId || log.runId || log.date)}
              className="flex items-center justify-between px-4 py-3 bg-black border border-eve-border/20 rounded-none hover:bg-zinc-900 transition-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-none bg-eve-accent/10 text-eve-accent">
                  <Zap className="h-3 w-3" />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-300 font-mono uppercase tracking-widest">
                    {log.formattedTime}
                  </p>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] font-mono">
                    {log.charName || t('common.session.unknownPilot')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-zinc-300 font-mono tracking-widest">
                  {getSignedLogValue(log as AnalyticsLogEntry, activity.type as ActivityType) >= 0 ? '+' : ''}
                  {formatISK(getSignedLogValue(log as AnalyticsLogEntry, activity.type as ActivityType))}
                </p>
                <p className="text-[9px] font-black text-zinc-600 font-mono uppercase tracking-wider">
                  {t('common.session.timelineTotal', { value: formatISK(log.cumulative) })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExpandableSection>
  )
}
