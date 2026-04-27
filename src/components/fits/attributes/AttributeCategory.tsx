'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, LucideIcon } from 'lucide-react'

interface AttributeCategoryProps {
  id: string
  label: string
  icon: LucideIcon
  children: React.ReactNode
  defaultCollapsed?: boolean
  collapsed?: boolean
  onToggle?: (id: string, collapsed: boolean) => void
  className?: string
}

export const AttributeCategory: React.FC<AttributeCategoryProps> = ({
  id,
  label,
  icon: Icon,
  children,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggle,
  className
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed
  
  const handleToggle = () => {
    const newState = !isCollapsed
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(newState)
    }
    onToggle?.(id, newState)
  }

  return (
    <div className={cn("border-b border-white/5 last:border-b-0 group", className)}>
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-2.5 transition-colors",
          "hover:bg-white/5 active:bg-white/10",
          !isCollapsed && "bg-blue-500/[0.02]"
        )}
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 90 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-zinc-600 group-hover:text-zinc-400"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
        
        <div className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md transition-colors",
          isCollapsed ? "bg-white/5 text-zinc-500" : "bg-blue-500/10 text-blue-400"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-[0.08em] transition-colors',
            isCollapsed ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {label}
        </span>
        
        <div className="flex-1" />
      </button>
      
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-black/10"
          >
            <motion.div 
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-2 px-4 pb-3 pt-1.5"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  )
}
