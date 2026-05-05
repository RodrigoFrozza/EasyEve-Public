'use client'

import { useMemo, useState } from 'react'
import { ActivityEnhanced, isAbyssalActivity } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { SortableItemGrid } from '../shared/SortableItemGrid'
import { Sparkles, Skull, Clock, Ship, Zap, ChevronDown } from 'lucide-react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface RunHistorySectionProps {
  activity: ActivityEnhanced
}

export function RunHistorySection({ activity }: RunHistorySectionProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const runs = useMemo(() => {
    if (!isAbyssalActivity(activity)) return []
    return activity.data.runs || []
  }, [activity])

  const stats = useMemo(() => {
    const completed = runs.filter(r => r.status === 'completed').length
    const deaths = runs.filter(r => r.status === 'death').length
    return { completed, deaths }
  }, [runs])

  if (!isAbyssalActivity(activity) || runs.length === 0) return null

  return (
    <ExpandableSection
      title="Run History"
      icon={<Sparkles className="w-4 h-4" />}
      variant="accent"
      summary={
        <div className="flex items-center gap-4 mt-1">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">
            {stats.completed} Success
          </span>
          {stats.deaths > 0 && (
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">
              {stats.deaths} Deaths 💀
            </span>
          )}
        </div>
      }
    >
      <div className="space-y-3 py-2">
        {runs.slice().reverse().map((run, idx) => {
          const isDeath = run.status === 'death'
          const duration = run.endTime 
            ? Math.floor((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / (1000 * 60))
            : null

          return (
            <div 
              key={run.id}
              className={cn(
                "rounded-2xl border transition-all overflow-hidden",
                isDeath 
                  ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40" 
                  : "bg-white/5 border-white/5 hover:border-white/10"
              )}
            >
              {/* Run Header */}
              <button
                onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                className="w-full flex items-center justify-between p-4 text-left group"
              >
                <div className="flex items-center gap-4">
                   <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center border",
                    isDeath ? "bg-rose-500/20 border-rose-500/20 text-rose-500" : "bg-emerald-500/20 border-emerald-500/20 text-emerald-500"
                  )}>
                    {isDeath ? <Skull className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-zinc-200 uppercase tracking-widest">
                        Run #{runs.length - idx}
                      </h4>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                        isDeath ? "bg-rose-500/20 border-rose-500/20 text-rose-400" : "bg-emerald-500/20 border-emerald-500/20 text-emerald-400"
                      )}>
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-black text-zinc-500 uppercase tracking-[0.12em]">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {run.tier} {run.weather}</span>
                      <span className="flex items-center gap-1"><Ship className="w-3 h-3" /> {run.ship}</span>
                      {duration !== null && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration}m</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-200 font-mono">
                      {formatISK(run.lootValue || 0)}
                    </p>
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      Net Profit
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-zinc-600 transition-transform group-hover:text-zinc-400",
                    expandedRun === run.id && "rotate-180"
                  )} />
                </div>
              </button>

              {/* Run Details (Loot) */}
              <AnimatePresence>
                {expandedRun === run.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 bg-black/20"
                  >
                    <div className="p-4 space-y-4">
                      {run.lootItems && run.lootItems.length > 0 ? (
                        <SortableItemGrid 
                          items={run.lootItems.map(i => ({ ...i, quantity: i.quantity || 0, value: i.value || 0 }))}
                          limit={6}
                        />
                      ) : (
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center py-4">
                          No item details recorded for this run
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </ExpandableSection>
  )
}
