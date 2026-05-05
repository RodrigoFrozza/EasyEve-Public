'use client'

import {
  useLeaderboardStore,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardType,
} from '@/lib/stores/leaderboard-store'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Swords, Gem, MapPin, Trophy, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeaderboardWrapper } from './LeaderboardWrapper'
import { useTranslations } from '@/i18n/hooks'

interface LeaderboardPeriodData {
  daily: LeaderboardEntry[]
  weekly: LeaderboardEntry[]
  monthly: LeaderboardEntry[]
  alltime: LeaderboardEntry[]
}

interface LeaderboardSideContentProps {
  rattingData: LeaderboardPeriodData
  miningData: LeaderboardPeriodData
  explorationData: LeaderboardPeriodData
  currentUserId?: string
  userRank?: {
    ratting: number
    mining: number
    exploration: number
  }
}

const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'alltime']

export function LeaderboardSideContent({
  rattingData,
  miningData,
  explorationData,
  currentUserId,
  userRank,
}: LeaderboardSideContentProps) {
  const { t } = useTranslations()
  const isCollapsed = useLeaderboardStore((s) => s.isCollapsed)
  const activeType = useLeaderboardStore((s) => s.activeType)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)
  const setActiveType = useLeaderboardStore((s) => s.setActiveType)
  const setActivePeriod = useLeaderboardStore((s) => s.setActivePeriod)

  const boardData: Record<LeaderboardType, LeaderboardPeriodData> = {
    ratting: rattingData,
    mining: miningData,
    exploration: explorationData,
  }

  const initialData = boardData[activeType][activePeriod]
  const dailyRankForType =
    userRank &&
    (activeType === 'ratting'
      ? userRank.ratting
      : activeType === 'mining'
        ? userRank.mining
        : userRank.exploration)

  const serverUserRank =
    activePeriod === 'daily' && dailyRankForType && dailyRankForType > 0
      ? dailyRankForType
      : undefined

  return (
    <div
      className={cn(
        'bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[24px] overflow-hidden h-full shadow-2xl transition-all duration-300',
        isCollapsed ? 'border-transparent bg-transparent' : ''
      )}
    >
      <div
        className={cn(
          'p-0 border-b border-white/5 bg-white/[0.02]',
          isCollapsed ? 'hidden' : 'block'
        )}
      >
        <div
          role="tablist"
          aria-label={t('dashboard.leaderboardTypeTabs')}
          className="grid w-full grid-cols-3 h-11"
        >
          {(
            [
              { value: 'ratting' as const, icon: Swords, label: t('dashboard.leaderboardTabRatting') },
              { value: 'mining' as const, icon: Gem, label: t('dashboard.leaderboardTabMining') },
              {
                value: 'exploration' as const,
                icon: MapPin,
                label: t('dashboard.leaderboardTabExploration'),
              },
            ] as const
          ).map(({ value, icon: Icon, label }) => {
            const selected = activeType === value
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveType(value)}
                className={cn(
                  'font-black uppercase tracking-widest h-full flex items-center justify-center gap-2 transition-all border-r border-white/5 last:border-r-0 relative group/tab',
                  'text-[10px] font-outfit',
                  selected
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]'
                )}
              >
                {selected && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                )}
                <Icon
                  className={cn(
                    'transition-all shrink-0',
                    'h-3.5 w-3.5',
                    selected && 'drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]'
                  )}
                />
                {!isCollapsed && label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-0">
        {!isCollapsed && (
          <div
            role="tablist"
            aria-label={t('dashboard.leaderboardPeriodTabs')}
            className="grid w-full grid-cols-4 bg-black/20 h-9 border-b border-white/5 p-0.5 gap-0.5"
          >
            {PERIODS.map((p) => {
              const selected = activePeriod === p
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActivePeriod(p)}
                  className={cn(
                    'text-[9px] font-black uppercase tracking-widest rounded-lg h-full transition-all font-outfit',
                    selected
                      ? 'bg-white/10 text-white shadow-inner'
                      : 'text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02]'
                  )}
                >
                  {t(`dashboard.period.${p}`)}
                </button>
              )
            })}
          </div>
        )}

        <div className={cn('p-2', isCollapsed && 'p-0 flex flex-col items-center gap-4 mt-4')}>
           {isCollapsed && (
              <div className="flex flex-col items-center gap-2 mb-2">
                 <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Trophy className="h-5 w-5" />
                 </div>
                 <div className="w-px h-8 bg-gradient-to-b from-white/10 to-transparent" />
              </div>
           )}
          <LeaderboardWrapper
            key={`${activeType}-${activePeriod}`}
            initialData={initialData}
            currentUserId={currentUserId}
            period={activePeriod}
            type={activeType}
            userRank={serverUserRank}
            refreshInterval={60000}
          />
        </div>
      </div>
    </div>
  )
}
