'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Check, AlertTriangle } from 'lucide-react'

interface CompatibilityBadgeProps {
  isCompatible: boolean
  restriction?: string
  size?: 'sm' | 'md'
  className?: string
}

export const CompatibilityBadge: React.FC<CompatibilityBadgeProps> = ({
  isCompatible,
  restriction,
  size = 'sm',
  className
}) => {
  if (isCompatible) {
    return (
      <span className={cn(
        "inline-flex items-center gap-0.5 text-green-400",
        size === 'sm' ? 'text-[8px]' : 'text-[10px]',
        className
      )}>
        <Check className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      </span>
    )
  }

  return (
    <span 
      className={cn(
        "inline-flex items-center gap-0.5 text-orange-400 cursor-help",
        size === 'sm' ? 'text-[8px]' : 'text-[10px]',
        className
      )}
      title={restriction || 'Restricted'}
    >
      <AlertTriangle className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
      {restriction && (
        <span className="hidden">{restriction}</span>
      )}
    </span>
  )
}
