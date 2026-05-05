'use client'

import { useMemo } from 'react'
import { formatISK, formatCurrencyValue, cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface BreakdownSegment {
  id: string
  label: string
  value: number
  color: string
}

interface FinancialBreakdownBarProps {
  segments: BreakdownSegment[]
  total: number
  className?: string
  showLabels?: boolean
}

export function FinancialBreakdownBar({
  segments,
  total,
  className,
  showLabels = true
}: FinancialBreakdownBarProps) {
  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => b.value - a.value)
  }, [segments])

  const safeTotal = total || sortedSegments.reduce((sum, s) => sum + s.value, 0) || 1

  return (
    <div className={cn("space-y-4", className)}>
      {/* Bar */}
      <div className="h-3 w-full flex rounded-full overflow-hidden bg-white/5 border border-white/5 backdrop-blur-sm">
        {sortedSegments.map((segment, idx) => {
          const percentage = (segment.value / safeTotal) * 100
          if (percentage < 0.5) return null // Hide tiny segments

          return (
            <motion.div
              key={segment.id}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.8, delay: idx * 0.1, ease: "circOut" }}
              className={cn("h-full relative group", segment.color)}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {segment.label}
                </p>
                <p className="text-xs font-black text-white font-mono">
                  {formatISK(segment.value)} ({percentage.toFixed(1)}%)
                </p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Legend Labels */}
      {showLabels && (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {sortedSegments.map((segment) => {
            const percentage = (segment.value / safeTotal) * 100
            if (percentage < 1 && segment.value === 0) return null

            return (
              <div key={segment.id} className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", segment.color)} />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    {segment.label}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-black text-zinc-200 font-mono">
                      {formatCurrencyValue(segment.value)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
