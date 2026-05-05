'use client'

import { cn } from '@/lib/utils'

interface PeriodSelectorProps {
  period: number
  onPeriodChange: (period: number) => void
  className?: string
}

const PERIODS = [7, 14, 30] as const

export function PeriodSelector({ period, onPeriodChange, className }: PeriodSelectorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-zinc-900/50 border border-zinc-800',
        className
      )}
    >
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onPeriodChange(p)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200',
            period === p
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          )}
        >
          {p}D
        </button>
      ))}
    </div>
  )
}