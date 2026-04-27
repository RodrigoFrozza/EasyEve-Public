'use client'

import { useLeaderboardStore } from '@/lib/stores/leaderboard-store'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'


interface DashboardGridProps {
  children: ReactNode
  sidebar: ReactNode
}

import { useTranslations } from '@/i18n/hooks'

export function DashboardGrid({ children, sidebar }: DashboardGridProps) {
  const isCollapsed = useLeaderboardStore((s) => s.isCollapsed)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)
  const toggleCollapsed = useLeaderboardStore((s) => s.toggleCollapsed)
  const { t } = useTranslations()

  return (
    <div className={cn(
      "grid grid-cols-1 gap-6 transition-all duration-300 ease-in-out relative",
      isCollapsed 
        ? "lg:grid-cols-[1fr_64px]" 
        : "lg:grid-cols-[1fr_320px]"
    )}>
      <div className="min-w-0 space-y-6">
        {children}
      </div>
      
      <div className={cn(
        "flex flex-col transition-all duration-300 relative",
        isCollapsed ? "w-16" : "w-full"
      )}>
        {/* Sidebar Header with Toggle */}
        <div className={cn(
          "flex items-center border-b border-white/5 bg-white/[0.03] transition-all overflow-hidden",
          isCollapsed ? "h-16 flex-col justify-center gap-1.5" : "h-12 justify-between px-3"
        )}>
            {!isCollapsed ? (
              <div className="flex flex-col">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500/50 leading-none mb-1 font-outfit">{t(`dashboard.period.${activePeriod}`)}</span>
                 <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500 font-outfit">{t('dashboard.leaderboards')}</span>
              </div>
            ) : (
               <span className="text-[10px] font-black uppercase text-cyan-400 tracking-tighter leading-none mb-0.5 max-w-[56px] truncate text-center font-outfit">{t(`dashboard.period.${activePeriod}`)}</span>
            )}

           <button
            onClick={() => toggleCollapsed()}
            className={cn(
              "flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-white shadow-lg hover:bg-white/[0.1] transition-all group",
              isCollapsed ? "h-8 w-8" : "h-7 w-7"
            )}
            title={isCollapsed ? t('dashboard.expandLeaderboard') : t('dashboard.collapseLeaderboard')}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t('dashboard.expandLeaderboard') : t('dashboard.collapseLeaderboard')}
          >
            {isCollapsed ? (
              <ChevronLeft className="h-4 w-4 text-cyan-400" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-cyan-400" />
            )}
          </button>
        </div>



        <div className="flex-1 overflow-visible">
          {sidebar}
        </div>
      </div>


    </div>
  )
}

