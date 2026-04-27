'use client'

import { TrendIndicator } from './TrendIndicator'
import { cn } from '@/lib/utils'

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
  selectedActivity: string | null
  onActivitySelect: (activity: string | null) => void
  className?: string
}

const ACTIVITY_LABELS: Record<string, { label: string; color: string }> = {
  mining: { label: 'Mineração', color: '#fbbf24' },
  ratting: { label: 'Ratting', color: '#f87171' },
  abyssal: { label: 'Abyssal', color: '#a855f7' },
  exploration: { label: 'Exploração', color: '#22d3ee' },
  escalations: { label: 'Escalações', color: '#f97316' },
  crab: { label: 'CRAB', color: '#84cc16' },
  pvp: { label: 'PVP', color: '#ec4899' },
}

const ACTIVITY_ICONS: Record<string, string> = {
  mining: '⛏',
  ratting: '👾',
  abyssal: '🌑',
  exploration: '🔍',
  escalations: '⚔',
  crab: '🦀',
  pvp: '⚔',
}

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}

export function PerformanceMetrics({
  data,
  selectedActivity,
  onActivitySelect,
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

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}>
      <button
        onClick={() => onActivitySelect(null)}
        className={cn(
          'relative p-3 rounded-xl border text-left transition-all duration-200',
          selectedActivity === null
            ? 'bg-zinc-800/80 border-zinc-600'
            : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
        )}
      >
        <div className="text-xs text-zinc-500 mb-1">Todas</div>
        <div className="text-lg font-bold text-zinc-100">
          {formatValue(
            activities.reduce((sum, a) => sum + a.currentValue + a.previousValue, 0)
          )}
        </div>
        <div className="text-xs text-zinc-500">
          {activities.reduce((sum, a) => sum + a.dailyData.reduce((s, d) => s + d.sessions, 0), 0)} sessões
        </div>
      </button>

      {activities.map((item) => {
        const meta = ACTIVITY_LABELS[item.activity] || {
          label: item.activity,
          color: '#71717a',
        }

        return (
          <button
            key={item.activity}
            onClick={() =>
              onActivitySelect(
                selectedActivity === item.activity ? null : item.activity
              )
            }
            className={cn(
              'relative p-3 rounded-xl border text-left transition-all duration-200',
              selectedActivity === item.activity
                ? 'bg-zinc-800/80 border-zinc-600'
                : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{ACTIVITY_ICONS[item.activity] || '🎯'}</span>
              <span className="text-xs text-zinc-500">{meta.label}</span>
            </div>

            <div className="text-lg font-bold" style={{ color: meta.color }}>
              {formatValue(item.currentValue + item.previousValue)}
            </div>

            <div className="mt-1">
              <TrendIndicator
                trend={item.trend}
                changePercent={item.changePercent}
              />
            </div>

            <div className="text-xs text-zinc-600 mt-1">
              {item.dailyData.reduce((s, d) => s + d.sessions, 0)} sessões
            </div>
          </button>
        )
      })}
    </div>
  )
}