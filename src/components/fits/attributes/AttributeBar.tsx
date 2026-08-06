'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ViewMode } from './ViewModeToggle'

import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip'
import { ModifierBreakdown } from '../ModifierBreakdown'

interface AttributeBarProps {
  label: string
  value: number
  maxValue?: number
  unit?: string
  type?: 'number' | 'percentage' | 'time' | 'distance' | 'mass' | 'speed'
  viewMode: ViewMode
  color?: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'teal'
  showMax?: boolean
  className?: string
  history?: any
  historyKey?: string
}

const COLOR_MAP: Record<string, { bar: string; glow: string; text: string }> = {
  blue: { bar: 'bg-gradient-to-r from-blue-600 to-blue-400', glow: 'shadow-[0_0_10px_rgba(59,130,246,0.4)]', text: 'text-blue-400' },
  red: { bar: 'bg-gradient-to-r from-red-600 to-red-400', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.4)]', text: 'text-red-400' },
  yellow: { bar: 'bg-gradient-to-r from-yellow-600 to-yellow-400', glow: 'shadow-[0_0_10px_rgba(234,179,8,0.4)]', text: 'text-yellow-400' },
  green: { bar: 'bg-gradient-to-r from-green-600 to-green-400', glow: 'shadow-[0_0_10px_rgba(34,197,94,0.4)]', text: 'text-green-400' },
  purple: { bar: 'bg-gradient-to-r from-purple-600 to-purple-400', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.4)]', text: 'text-purple-400' },
  teal: { bar: 'bg-gradient-to-r from-teal-600 to-teal-400', glow: 'shadow-[0_0_10px_rgba(20,184,166,0.4)]', text: 'text-teal-400' }
}

function formatValue(value: number, type: string): string {
  if (type === 'percentage') {
    return `${(value * 100).toFixed(1)}%`
  }
  
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(2)}B`
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  
  if (type === 'time') {
    if (value >= 3600) {
      const hrs = Math.floor(value / 3600)
      const mins = Math.floor((value % 3600) / 60)
      return `${hrs}h ${mins}m`
    }
    if (value >= 60) {
      const mins = Math.floor(value / 60)
      const secs = Math.round(value % 60)
      return `${mins}m ${secs}s`
    }
    return `${value.toFixed(1)}s`
  }
  
  if (type === 'distance' || type === 'mass') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  
  if (type === 'speed') {
    return value.toFixed(1)
  }
  
  return value.toFixed(1)
}

export const AttributeBar: React.FC<AttributeBarProps> = ({
  label,
  value,
  maxValue,
  unit = '',
  type = 'number',
  viewMode,
  color = 'blue',
  showMax = false,
  className,
  history,
  historyKey
}) => {
  const colors = COLOR_MAP[color]
  
  const percentage = useMemo(() => {
    if (!maxValue || maxValue === 0) return 0
    return Math.min(100, (value / maxValue) * 100)
  }, [value, maxValue])
  
  const formattedValue = useMemo(() => formatValue(value, type), [value, type])
  const formattedMax = useMemo(() => maxValue ? formatValue(maxValue, type) : null, [maxValue, type])

  const content = (
    <div className={cn("group/bar flex cursor-help items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-white/[0.03]", className)}>
      <div className="w-28 shrink-0">
        <span className="text-xs font-medium text-muted-foreground transition-colors group-hover/bar:text-foreground">
          {label}
        </span>
      </div>
      
      <div className="flex flex-1 items-center gap-2.5">
        {viewMode !== 'pure' && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-white/5 bg-white/5 p-[1px]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                colors.bar,
                viewMode === 'barPercent' && colors.glow
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        
        <div className="flex min-w-[96px] items-center justify-end gap-1.5">
          <span className={cn('text-xs font-semibold tabular-nums tracking-tight', colors.text)}>
            {formattedValue}
          </span>

          {unit && (
            <span className="text-[10px] font-medium uppercase text-muted-foreground">{unit}</span>
          )}

          {viewMode === 'barPercent' && maxValue && (
            <span className="text-[10px] font-medium text-muted-foreground">/{formattedMax}</span>
          )}

          {viewMode === 'barPercent' && (
            <span className="ml-1 text-[10px] font-medium text-muted-foreground">{percentage.toFixed(0)}%</span>
          )}
        </div>
      </div>
    </div>
  )

  if (history && historyKey && history[historyKey]) {
    const data = history[historyKey]
    return (
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="p-0 border-none bg-transparent">
            <ModifierBreakdown 
              label={historyKey}
              base={data.base}
              final={data.final}
              modifiers={data.modifiers}
              unit={unit}
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
}

