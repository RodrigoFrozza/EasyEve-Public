'use client'

import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  className?: string
  showLabel?: boolean
}

const TREND_CONFIG = {
  up: {
    icon: '▲',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  down: {
    icon: '▼',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
  },
  stable: {
    icon: '─',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/20',
  },
}

export function TrendIndicator({
  trend,
  changePercent,
  className,
  showLabel = false,
}: TrendIndicatorProps) {
  const config = TREND_CONFIG[trend]
  const formattedPercent = changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border',
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      <span className="text-[10px]">{config.icon}</span>
      <span>{formattedPercent}</span>
      {showLabel && trend !== 'stable' && (
        <span className="ml-0.5">{trend === 'up' ? 'Alta' : 'Baixa'}</span>
      )}
    </div>
  )
}