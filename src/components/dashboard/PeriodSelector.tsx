'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

interface PeriodSelectorProps {
  period: number
  onPeriodChange: (period: number) => void
  className?: string
}

const PERIODS = [7, 14, 30] as const

export function PeriodSelector({ period, onPeriodChange, className }: PeriodSelectorProps) {
  const { t } = useTranslations()

  return (
    <div
      className={cn(
        'relative inline-flex items-center rounded-sm border border-eve-border bg-eve-dark p-0.5',
        className
      )}
      role="group"
      aria-label={t('dashboard.performance.periodLabel')}
    >
      {PERIODS.map((p) => {
        const isActive = period === p
        return (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodChange(p)}
            className={cn(
              'relative rounded-sm border px-3.5 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-eve-border bg-eve-panel text-eve-text'
                : 'border-transparent text-eve-muted hover:bg-eve-panel/50 hover:text-eve-text'
            )}
          >
            {t('dashboard.performance.days', { count: p })}
          </button>
        )
      })}
    </div>
  )
}
