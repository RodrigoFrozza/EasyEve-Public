'use client'

import {
  useLeaderboardStore,
  LeaderboardPeriod,
  LeaderboardType,
} from '@/lib/stores/leaderboard-store'
import { Swords, Gem, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

const PERIODS: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'alltime']

const TYPES: { value: LeaderboardType; icon: typeof Swords; labelKey: string }[] = [
  { value: 'ratting', icon: Swords, labelKey: 'dashboard.leaderboardTabRatting' },
  { value: 'mining', icon: Gem, labelKey: 'dashboard.leaderboardTabMining' },
  { value: 'exploration', icon: MapPin, labelKey: 'dashboard.leaderboardTabExploration' },
]

export function LeaderboardTabs() {
  const { t } = useTranslations()
  const activeType = useLeaderboardStore((s) => s.activeType)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)
  const setActiveType = useLeaderboardStore((s) => s.setActiveType)
  const setActivePeriod = useLeaderboardStore((s) => s.setActivePeriod)

  return (
    <div className="border-b border-eve-border/40 bg-eve-dark/80">
      <div
        role="tablist"
        aria-label={t('dashboard.leaderboardTypeTabs')}
        className="grid h-11 grid-cols-3"
      >
        {TYPES.map(({ value, icon: Icon, labelKey }) => {
          const selected = activeType === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveType(value)}
              className={cn(
                'flex items-center justify-center gap-1.5 border-r border-eve-border/20 text-xs font-semibold last:border-r-0',
                selected
                  ? 'bg-eve-panel text-eve-accent shadow-[inset_0_-2px_0_0_rgba(61,216,224,0.9)]'
                  : 'text-eve-muted hover:bg-eve-panel/50 hover:text-eve-text'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t(labelKey)}</span>
            </button>
          )
        })}
      </div>
      <div
        role="tablist"
        aria-label={t('dashboard.leaderboardPeriodTabs')}
        className="grid grid-cols-4 gap-1 border-t border-eve-border/20 p-1.5"
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
                'rounded-sm py-1.5 text-[11px] font-semibold transition-colors',
                selected
                  ? 'bg-eve-accent/15 text-eve-accent ring-1 ring-eve-accent/30'
                  : 'text-eve-muted hover:bg-eve-panel hover:text-eve-text'
              )}
            >
              {t(`dashboard.period.${p}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
