'use client'

import { TrendIndicator } from './TrendIndicator'
import { cn } from '@/lib/utils'
import { getActivityConfig } from '@/lib/dashboard/performance-config'
import { formatPerformanceValue } from '@/lib/dashboard/performance-format'
import { useTranslations } from '@/i18n/hooks'

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

interface PerformanceSummary {
  totalValue: number
  totalSessions: number
  topActivity: string
}

interface PerformanceMetricsProps {
  data: Record<string, ActivityTrend>
  summary: PerformanceSummary
  selectedActivities: string[]
  onActivityToggle: (activity: string | null) => void
  className?: string
}

const CARD_CLASS =
  'relative min-w-[9.5rem] max-w-full flex-1 basis-[calc(50%-0.25rem)] sm:basis-[calc(33.333%-0.35rem)] lg:basis-[calc(25%-0.38rem)] p-3 rounded-sm border text-left transition-colors group overflow-hidden'

export function PerformanceMetrics({
  data,
  summary,
  selectedActivities,
  onActivityToggle,
  className,
}: PerformanceMetricsProps) {
  const { t } = useTranslations()
  const activities = Object.values(data).filter((a) => a.dailyData.some((d) => d.value > 0))

  if (activities.length === 0) {
    return (
      <div
        className={cn(
          'rounded-sm border border-eve-border/30 bg-eve-dark py-12 text-center text-xs text-eve-muted',
          className
        )}
      >
        {t('dashboard.performance.noData')}
      </div>
    )
  }

  const isAllSelected = selectedActivities.length === 0

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <button
        type="button"
        onClick={() => onActivityToggle(null)}
        className={cn(
          CARD_CLASS,
          isAllSelected
            ? 'border-eve-border bg-eve-panel'
            : 'border-eve-border/30 bg-eve-dark hover:border-eve-border/60 hover:bg-eve-panel'
        )}
      >
        <div className="mb-2 text-[10px] font-medium leading-tight text-eve-muted">
          {t('dashboard.performance.allActivities')}
        </div>
        <div className="text-lg font-bold leading-none tabular-nums text-eve-text">
          {formatPerformanceValue(summary.totalValue)}
        </div>
        <div className="mt-2 text-[10px] text-eve-muted/60">
          {t('dashboard.performance.sessions', { count: summary.totalSessions })}
        </div>
      </button>

      {activities.map((item) => {
        const config = getActivityConfig(item.activity)
        const isSelected = selectedActivities.includes(item.activity)
        const periodTotal = item.currentValue + item.previousValue
        const sessions = item.dailyData.reduce((s, d) => s + d.sessions, 0)

        return (
          <button
            key={item.activity}
            type="button"
            onClick={() => onActivityToggle(item.activity)}
            title={config.label}
            className={cn(
              CARD_CLASS,
              isSelected
                ? 'border-eve-border bg-eve-panel'
                : 'border-eve-border/30 bg-eve-dark hover:border-eve-border/60 hover:bg-eve-panel'
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="text-[10px] font-medium leading-tight text-eve-muted">
                {config.label}
              </span>
              <div
                className="mt-0.5 h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: config.color, opacity: isSelected ? 0.8 : 0.35 }}
                aria-hidden
              />
            </div>

            <div
              className={cn(
                'text-lg font-bold leading-none tabular-nums',
                isSelected ? 'text-eve-text' : 'text-eve-muted group-hover:text-eve-text'
              )}
            >
              {formatPerformanceValue(periodTotal)}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <TrendIndicator trend={item.trend} changePercent={item.changePercent} />
              <span className="shrink-0 text-[10px] text-eve-muted/60">
                {t('dashboard.performance.sessions', { count: sessions })}
              </span>
            </div>

            {isSelected && (
              <div
                className="absolute left-0 top-0 h-full w-0.5"
                style={{ backgroundColor: config.color, opacity: 0.5 }}
                aria-hidden
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
