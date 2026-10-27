'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SlotBadgeProps {
  slotType: 'high' | 'med' | 'low' | 'rig' | 'subsystem'
  size?: 'sm' | 'md'
  className?: string
}

const SLOT_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'HI', color: 'bg-red-500/25 text-red-200 border-red-500/50' },
  med: { label: 'MED', color: 'bg-blue-500/25 text-blue-200 border-blue-500/50' },
  low: { label: 'LOW', color: 'bg-amber-500/25 text-amber-100 border-amber-500/55' },
  rig: { label: 'RIG', color: 'bg-teal-500/25 text-teal-100 border-teal-500/55' },
  subsystem: { label: 'SYS', color: 'bg-purple-500/25 text-purple-200 border-purple-500/55' },
  drone: { label: 'DRN', color: 'bg-emerald-500/25 text-emerald-200 border-emerald-500/55' },
}

export const SlotBadge: React.FC<SlotBadgeProps> = ({
  slotType,
  size = 'sm',
  className
}) => {
  const config = SLOT_CONFIG[slotType]
  
  if (!config) return null
  
  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-md border font-semibold tabular-nums tracking-tight",
      size === 'sm' ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs",
      config.color,
      className
    )}>
      {config.label}
    </span>
  )
}
