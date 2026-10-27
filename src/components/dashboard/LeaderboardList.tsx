'use client'

import { useState, useEffect, useMemo } from 'react'
import { useTranslations } from '@/i18n/hooks'
import { Clock, RefreshCw, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCountdown, LeaderboardItem } from './leaderboard/leaderboard-utils'
import { LeaderboardPodium } from './leaderboard/LeaderboardPodium'
import { LeaderboardRankList } from './leaderboard/LeaderboardRankList'
import { LeaderboardCollapsed } from './leaderboard/LeaderboardCollapsed'
import * as Tooltip from '@radix-ui/react-tooltip'

interface LeaderboardListProps {
  data: LeaderboardItem[]
  currentUserId?: string
  period?: string
  type?: string
  userRank?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  isCollapsed?: boolean
}

export function LeaderboardList({
  data: rawData,
  currentUserId,
  period,
  type = 'ratting',
  userRank,
  onRefresh,
  isRefreshing,
  isCollapsed = false,
}: LeaderboardListProps) {
  const { t } = useTranslations()
  const [countdown, setCountdown] = useState('')

  const data = useMemo(() => (rawData || []).filter(Boolean), [rawData])

  useEffect(() => {
    if (!period || period === 'alltime') {
      setCountdown('')
      return
    }
    setCountdown(getCountdown(period))
    const interval = setInterval(() => setCountdown(getCountdown(period)), 1000)
    return () => clearInterval(interval)
  }, [period])

  if (isCollapsed) {
    return (
      <Tooltip.Provider delayDuration={0}>
        <LeaderboardCollapsed data={data} currentUserId={currentUserId} type={type} />
      </Tooltip.Provider>
    )
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-eve-border/40 bg-eve-dark/30 py-10 text-center">
        <TrendingUp className="mb-2 h-8 w-8 text-eve-muted/50" />
        <p className="text-xs font-semibold text-eve-muted">{t('dashboard.leaderboardEmptyTitle')}</p>
        <p className="mt-1 text-[11px] text-eve-muted/80">{t('global.waitingForPilotActivity')}</p>
      </div>
    )
  }

  return (
    <Tooltip.Provider delayDuration={0}>
    <div className="space-y-3 font-accent">
      {period && period !== 'alltime' && countdown && (
        <div className="flex items-center justify-between rounded-sm border border-eve-border/30 bg-eve-dark/50 px-3 py-2 text-[11px]">
          <span className="flex items-center gap-2 text-eve-muted">
            <Clock className="h-3.5 w-3.5" />
            {t('dashboard.leaderboardReset')}
          </span>
          <span className="font-mono font-semibold text-eve-text">{countdown}</span>
        </div>
      )}

      <LeaderboardPodium data={data} currentUserId={currentUserId} type={type} />

      <LeaderboardRankList
        data={data}
        currentUserId={currentUserId}
        type={type}
        userRank={userRank}
      />

      {onRefresh && (
        <div className="flex justify-end border-t border-eve-border/20 pt-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              'flex items-center gap-1.5 rounded-sm border border-eve-accent/25 bg-eve-accent/5 px-3 py-1.5 text-[11px] font-semibold text-eve-accent hover:bg-eve-accent/15 disabled:opacity-50',
              isRefreshing && 'animate-pulse'
            )}
          >
            <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
            {isRefreshing ? t('common.syncing') : t('common.refresh')}
          </button>
        </div>
      )}
    </div>
    </Tooltip.Provider>
  )
}
