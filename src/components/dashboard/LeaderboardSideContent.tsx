'use client'

import {
  useLeaderboardStore,
  LeaderboardEntry,
  LeaderboardType,
} from '@/lib/stores/leaderboard-store'
import { cn } from '@/lib/utils'
import { LeaderboardWrapper } from './LeaderboardWrapper'
import { LeaderboardTabs } from './leaderboard/LeaderboardTabs'

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

export function LeaderboardSideContent({
  rattingData,
  miningData,
  explorationData,
  currentUserId,
  userRank,
}: LeaderboardSideContentProps) {
  const isCollapsed = useLeaderboardStore((s) => s.isCollapsed)
  const activeType = useLeaderboardStore((s) => s.activeType)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)

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
      className="relative h-full overflow-hidden font-accent"
    >
      {!isCollapsed && <LeaderboardTabs />}

      <div className={cn('p-3', isCollapsed && 'p-0')}>
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
  )
}
