'use client'

import { useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExpandableSectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  summary?: ReactNode
  badge?: ReactNode
  defaultExpanded?: boolean
  className?: string
  headerClassName?: string
  variant?: 'default' | 'accent' | 'danger' | 'warning' | 'success'
}

export function ExpandableSection({
  title,
  icon,
  children,
  summary,
  badge,
  defaultExpanded = false,
  className,
  headerClassName,
  variant = 'default'
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const variants = {
    default: 'text-zinc-500',
    accent: 'text-blue-500',
    danger: 'text-rose-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500'
  }

  return (
    <div className={cn(
      "overflow-hidden rounded-3xl border border-white/5 bg-zinc-950/40 backdrop-blur-md transition-all duration-300",
      isExpanded ? "ring-1 ring-white/10" : "hover:border-white/10",
      className
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between px-6 py-5 text-left transition-colors hover:bg-white/5",
          headerClassName
        )}
      >
        <div className="flex items-center gap-4">
          {icon && (
            <div className={cn("p-2 rounded-xl bg-white/5", variants[variant])}>
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-200 font-outfit">
              {title}
            </h3>
            {summary && !isExpanded && (
              <div className="mt-1">
                {summary}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {badge && <div>{badge}</div>}
          <div className={cn(
            "p-2 rounded-full bg-white/5 transition-transform duration-300",
            isExpanded && "rotate-180 bg-white/10"
          )}>
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          </div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="px-6 pb-6 pt-2 border-t border-white/5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
