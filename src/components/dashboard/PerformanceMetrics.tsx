'use client'

import { TrendIndicator } from './TrendIndicator'
import { cn } from '@/lib/utils'
import { PERFORMANCE_ACTIVITIES, getActivityConfig } from '@/lib/dashboard/performance-config'

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

interface PerformanceMetricsProps {
  data: Record<string, ActivityTrend>
  selectedActivities: string[]
  onActivityToggle: (activity: string | null) => void
  className?: string
}

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

export function PerformanceMetrics({
  data,
  selectedActivities,
  onActivityToggle,
  className,
}: PerformanceMetricsProps) {
  const activities = Object.values(data).filter((a) => a.dailyData.some((d) => d.value > 0))

  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-8 text-zinc-500 text-sm', className)}>
        Nenhuma atividade encontrada no período
      </div>
    )
  }

  const isAllSelected = selectedActivities.length === 0

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3', className)}>
      <button
        onClick={() => onActivityToggle(null)}
        className={cn(
          'relative p-3 rounded-xl border text-left transition-all duration-300 group overflow-hidden',
          isAllSelected
            ? 'bg-zinc-800/80 border-zinc-500 shadow-[0_0_15px_rgba(255,255,255,0.05)]'
            : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/40'
        )}
      >
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1 font-semibold">Geral</div>
        <div className="text-base font-bold text-zinc-100 group-hover:scale-105 transition-transform duration-300">
          {formatValue(
            activities.reduce((sum, a) => sum + a.currentValue + a.previousValue, 0)
          )}
        </div>
        <div className="text-[10px] text-zinc-500 mt-1">
          {activities.reduce((sum, a) => sum + a.dailyData.reduce((s, d) => s + d.sessions, 0), 0)} sessões
        </div>
        {isAllSelected && (
          <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        )}
      </button>

      {activities.map((item) => {
        const config = getActivityConfig(item.activity)
        const isSelected = selectedActivities.includes(item.activity)

        return (
          <button
            key={item.activity}
            onClick={() => onActivityToggle(item.activity)}
            className={cn(
              'relative p-3 rounded-xl border text-left transition-all duration-300 group overflow-hidden',
              isSelected
                ? 'bg-zinc-800/80 border-opacity-100'
                : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/40'
            )}
            style={{ 
              borderColor: isSelected ? config.color : undefined,
              boxShadow: isSelected ? `0 0 15px ${config.color}20` : undefined
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{config.label}</span>
              <div 
                className="w-1.5 h-1.5 rounded-full" 
                style={{ backgroundColor: config.color }} 
              />
            </div>

            <div 
              className="text-base font-bold transition-transform duration-300 group-hover:scale-105" 
              style={{ color: isSelected ? config.color : '#f4f4f5' }}
            >
              {formatValue(item.currentValue + item.previousValue)}
            </div>

            <div className="flex items-center justify-between mt-1">
              <TrendIndicator
                trend={item.trend}
                changePercent={item.changePercent}
              />
              <span className="text-[10px] text-zinc-600">
                {item.dailyData.reduce((s, d) => s + d.sessions, 0)}s
              </span>
            </div>

            {isSelected && (
              <div 
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundColor: config.color }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}