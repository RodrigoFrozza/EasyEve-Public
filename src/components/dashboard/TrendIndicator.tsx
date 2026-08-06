'use client'

import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  className?: string
  showLabel?: boolean
}

const TREND_CONFIG = {
  up: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    label: 'up',
  },
  down: {
    icon: TrendingDown,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    label: 'down',
  },
  stable: {
    icon: Minus,
    color: 'text-eve-muted',
    bgColor: 'bg-eve-dark',
    borderColor: 'border-eve-border/50',
    label: 'stable',
  },
}

export function TrendIndicator({
  trend,
  changePercent,
  className,
  showLabel = false,
}: TrendIndicatorProps) {
  const config = TREND_CONFIG[trend]
  const Icon = config.icon
  const formattedPercent = changePercent > 0 ? `+${changePercent}%` : `${changePercent}%`

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-medium border',
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{formattedPercent}</span>
      {showLabel && trend !== 'stable' && (
        <span className="ml-1 border-l border-current/30 pl-1.5 opacity-70">{config.label}</span>
      )}
    </div>
  )
}