'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Hash, BarChart3, Percent } from 'lucide-react'

export type ViewMode = 'pure' | 'bar' | 'barPercent'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  value,
  onChange,
  className
}) => {
  const modes: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: 'pure', icon: <Hash className="w-3 h-3" />, label: 'Value' },
    { id: 'bar', icon: <BarChart3 className="w-3 h-3" />, label: 'Bar' },
    { id: 'barPercent', icon: <Percent className="w-3 h-3" />, label: '%' }
  ]

  return (
    <div className={cn("flex items-center gap-1 p-1 bg-black/40 rounded-lg border border-white/5", className)}>
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all",
            value === mode.id
              ? "bg-white/10 text-white border border-white/10"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
          )}
          title={mode.label}
        >
          {mode.icon}
          <span className="hidden sm:inline">{mode.label}</span>
        </button>
      ))}
    </div>
  )
}
