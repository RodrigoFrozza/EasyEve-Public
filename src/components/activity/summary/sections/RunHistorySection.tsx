'use client'

import { useMemo, useState } from 'react'
import { ActivityEnhanced, isAbyssalActivity } from '@/types/domain'
import { isAbyssalRunCompleted } from '@/lib/activities/abyssal-metrics'
import { ExpandableSection } from '../shared/ExpandableSection'
import { SortableItemGrid } from '../shared/SortableItemGrid'
import { Sparkles, Skull, Clock, Ship, Zap, ChevronDown } from 'lucide-react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from '@/i18n/hooks'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface RunHistorySectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

export function RunHistorySection({ activity, theme }: RunHistorySectionProps) {
  const { t } = useTranslations()
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  const runs = useMemo(() => {
    if (!isAbyssalActivity(activity)) return []
    return activity.data.runs || []
  }, [activity])

  const stats = useMemo(() => {
    const completed = runs.filter((run) => isAbyssalRunCompleted(run)).length
    const deaths = runs.filter(r => r.status === 'death').length
    return { completed, deaths }
  }, [runs])

  if (!isAbyssalActivity(activity) || runs.length === 0) return null

  return (
    <ExpandableSection
      title={t('common.session.runHistory')}
      icon={<Sparkles className="h-4 w-4" />}
      variant="accent"
      accentClassName={theme?.headerIcon}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <div className="mt-1 flex items-center gap-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500">
            {t('common.session.runsSuccess', { count: stats.completed })}
          </span>
          {stats.deaths > 0 && (
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">
              {t('common.session.runsDeaths', { count: stats.deaths })}
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
          const isExpanded = expandedRun === run.id

          return (
            <div 
              key={run.id}
              className={cn(
                "rounded-none border transition-none overflow-hidden",
                isDeath 
                  ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40" 
                  : "bg-zinc-950 border-zinc-900 hover:border-zinc-800"
              )}
            >
              {/* Run Header */}
              <button
                type="button"
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                className="w-full flex items-center justify-between p-4 text-left group transition-none"
              >
                <div className="flex items-center gap-4">
                   <div className={cn(
                    "w-10 h-10 rounded-none flex items-center justify-center border transition-none",
                    isDeath ? "bg-rose-500/20 border-rose-500/20 text-rose-500" : "bg-zinc-900 border-zinc-800 text-zinc-400"
                  )}>
                    {isDeath ? <Skull className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-zinc-200 uppercase tracking-widest font-mono">
                        {t('activity.abyssal.runLabel', { index: runs.length - idx })}
                      </h4>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest border font-mono",
                        isDeath ? "bg-rose-500/20 border-rose-500/20 text-rose-400" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      )}>
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[9px] font-black text-zinc-600 uppercase tracking-[0.12em] font-mono">
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {run.tier} {run.weather}</span>
                      <span className="flex items-center gap-1"><Ship className="w-3 h-3" /> {run.ship}</span>
                      {duration !== null && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration}M</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black text-zinc-200 font-mono tracking-tight">
                      {formatISK(run.lootValue || 0)}
                    </p>
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest font-mono">
                      {t('activity.abyssal.netProfit')}
                    </p>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-zinc-700 transition-none",
                    isExpanded && "rotate-180"
                  )} />
                </div>
              </button>

              {/* Run Details (Loot) */}
              {isExpanded && (
                <div className="border-t border-zinc-900 bg-black">
                  <div className="p-4 space-y-4">
                    {run.lootItems && run.lootItems.length > 0 ? (
                      <SortableItemGrid 
                        items={run.lootItems.map(i => ({ ...i, quantity: i.quantity || 0, value: i.value || 0 }))}
                        limit={6}
                      />
                    ) : (
                      <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest text-center py-6 font-mono">
                        {t('activity.abyssal.noLootItems')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ExpandableSection>
  )
}
