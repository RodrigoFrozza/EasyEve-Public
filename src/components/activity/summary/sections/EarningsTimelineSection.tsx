'use client'

import { useMemo, useState } from 'react'
import { ActivityEnhanced, isMiningActivity, isAbyssalActivity } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { TrendingUp, Clock, Zap, ArrowUpRight, ArrowDownRight, Activity as ActivityIcon } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'

interface EarningsTimelineSectionProps {
  activity: ActivityEnhanced
}

export function EarningsTimelineSection({ activity }: EarningsTimelineSectionProps) {
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
    const endTime = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
    const totalDuration = endTime - startTime
    
    let runningTotal = 0
    return sortedLogs.map((log, idx) => {
      const logTime = new Date(log.date).getTime()
      const elapsed = logTime - startTime
      const progressPct = (elapsed / Math.max(1, totalDuration)) * 100
      
      const value = isMiningActivity(activity) ? (log.value || 0) : (log.amount || 0)
      runningTotal += value

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

  const maxValue = Math.max(...chartData.map(d => d.cumulative), 1)
  const peakRate = Math.max(...chartData.map(d => d.iskPerHour), 0)

  if (logs.length === 0) return null

  return (
    <ExpandableSection
      title="Earnings Timeline"
      icon={<TrendingUp className="w-4 h-4" />}
      variant="success"
      summary={
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
            {logs.length} Entries
          </span>
          <span className="text-[10px] text-zinc-600">·</span>
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Peak {formatISK(peakRate)}/h
          </span>
        </div>
      }
    >
      <div className="space-y-6 py-2">
        {/* Interactive Chart */}
        <div className="relative h-48 bg-zinc-950/40 border border-white/5 rounded-2xl p-4 overflow-hidden group">
          {/* Grid */}
          <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-20">
            {[0, 1, 2, 3].map(i => <div key={i} className="border-t border-white/10 w-full" />)}
          </div>

          <div className="relative h-full ml-12">
             <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              <path
                d={`M 0,100 ${chartData.map((d) => `L ${d.progressPct},${100 - (d.cumulative / maxValue) * 100}`).join(' ')} L 100,100 Z`}
                fill="url(#timelineGradient)"
              />
              
              <path
                d={chartData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.progressPct},${100 - (d.cumulative / maxValue) * 100}`).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />

              {chartData.map((d, i) => (
                <circle
                  key={i}
                  cx={d.progressPct}
                  cy={100 - (d.cumulative / maxValue) * 100}
                  r="1.5"
                  fill="#10b981"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint(d)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}
            </svg>

            {/* Hover Tooltip */}
            <AnimatePresence>
              {hoveredPoint && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-0 right-0 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-10 pointer-events-none"
                >
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">
                    {hoveredPoint.formattedTime} · {hoveredPoint.charName}
                  </p>
                  <p className="text-sm font-black text-white font-mono">
                    {formatISK(hoveredPoint.cumulative)}
                  </p>
                  <p className="text-[10px] font-black text-emerald-500 font-mono">
                    {formatISK(hoveredPoint.iskPerHour)}/h rate
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Y-Axis */}
          <div className="absolute left-2 top-4 bottom-4 w-10 flex flex-col justify-between text-[8px] font-black text-zinc-600 font-mono">
            <span>{formatISK(maxValue)}</span>
            <span>0</span>
          </div>
        </div>

        {/* Log List */}
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 no-scrollbar">
          {chartData.slice().reverse().map((log, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between px-4 py-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Zap className="h-3 w-3" />
                </div>
                <div>
                  <p className="text-xs font-black text-zinc-200">
                    {log.formattedTime}
                  </p>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                    {log.charName || 'Unknown Pilot'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-zinc-200 font-mono">
                  +{formatISK(isMiningActivity(activity) ? log.value : log.amount)}
                </p>
                <p className="text-[9px] font-black text-zinc-500 font-mono">
                  Total: {formatISK(log.cumulative)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExpandableSection>
  )
}
