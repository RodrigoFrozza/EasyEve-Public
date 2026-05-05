'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface ActivityTabsProps {
  tabs: Tab[]
  defaultTab?: string
  variant?: 'default' | 'pills'
  color?: 'blue' | 'rose' | 'emerald' | 'purple'
  children: React.ReactNode
  className?: string
}

export function ActivityTabs({
  tabs,
  defaultTab,
  variant = 'default',
  color = 'blue',
  children,
  className
}: ActivityTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const colorClasses = useMemo(() => {
    const colors = {
      blue: {
        active: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25',
        default: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
      },
      rose: {
        active: 'bg-rose-500 text-white shadow-lg shadow-rose-500/25',
        default: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
      },
      emerald: {
        active: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
        default: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
      },
      purple: {
        active: 'bg-purple-500 text-white shadow-lg shadow-purple-500/25',
        default: 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
      },
    }
    return colors[color]
  }, [color])

  const childArray = Array.isArray(children) ? children : [children]
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab)
  const activeChild = childArray[activeIndex] || childArray[0]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tab Buttons */}
      <div className={cn(
        "flex gap-1 p-1 rounded-xl bg-zinc-950/60 border border-white/5 backdrop-blur-md",
        variant === 'pills' && "bg-transparent border-0"
      )}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 relative flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-[11px] font-black uppercase tracking-[0.12em] transition-all duration-300 font-outfit",
              activeTab === tab.id 
                ? colorClasses.active 
                : colorClasses.default,
              variant === 'default' && "bg-white/5"
            )}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 bg-white/10 rounded-lg -z-10"
                initial={false}
                transition={{ type: "spring", duration: 0.3 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeChild}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}