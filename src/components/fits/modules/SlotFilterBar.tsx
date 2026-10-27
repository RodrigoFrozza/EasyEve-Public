'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

export type SlotFilter = 'high' | 'med' | 'low' | 'rig' | null

interface SlotFilterBarProps {
  value: SlotFilter
  onChange: (filter: SlotFilter) => void
  className?: string
}

const SLOT_BUTTONS: { id: SlotFilter; label: string; color: string; activeColor: string; borderColor: string }[] = [
  {
    id: 'high',
    label: 'HI',
    color: 'text-red-400/50',
    activeColor: 'bg-red-500/25 text-red-200 border-red-500/50',
    borderColor: 'border-red-500/35 hover:border-red-500/55'
  },
  {
    id: 'med',
    label: 'MED',
    color: 'text-blue-400/50',
    activeColor: 'bg-blue-500/25 text-blue-200 border-blue-500/50',
    borderColor: 'border-blue-500/35 hover:border-blue-500/55'
  },
  {
    id: 'low',
    label: 'LOW',
    color: 'text-yellow-400/50',
    activeColor: 'bg-amber-500/25 text-amber-100 border-amber-500/55',
    borderColor: 'border-amber-500/35 hover:border-amber-500/55'
  },
  {
    id: 'rig',
    label: 'RIG',
    color: 'text-teal-400/50',
    activeColor: 'bg-teal-500/25 text-teal-100 border-teal-500/55',
    borderColor: 'border-teal-500/35 hover:border-teal-500/55'
  }
]

export const SlotFilterBar: React.FC<SlotFilterBarProps> = ({
  value,
  onChange,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {SLOT_BUTTONS.map((slot) => {
        const isActive = value === slot.id
        
        return (
          <button
            key={slot.id}
            onClick={() => onChange(isActive ? null : slot.id)}
            className={cn(
              "relative h-7 cursor-pointer rounded-md border px-2.5 text-xs font-semibold tracking-tight transition-colors duration-200",
              isActive 
                ? slot.activeColor 
                : cn(slot.borderColor, "bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"),
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeSlot"
                className="absolute inset-0 rounded-md bg-current opacity-10"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-10">{slot.label}</span>
          </button>
        )
      })}
    </div>
  )
}
