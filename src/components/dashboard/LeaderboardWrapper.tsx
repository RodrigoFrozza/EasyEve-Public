'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardList } from './LeaderboardList'
import { useLeaderboardStore } from '@/lib/stores/leaderboard-store'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'
import { LeaderboardItem } from './leaderboard/leaderboard-utils'

interface LeaderboardWrapperProps {
  initialData: LeaderboardItem[]
  currentUserId?: string
  period: string
  type?: string
  userRank?: number
  refreshInterval?: number
}

export function LeaderboardWrapper({
  initialData,
  currentUserId,
  period,
  type = 'ratting',
  userRank,
  refreshInterval = 5 * 60 * 1000,
}: LeaderboardWrapperProps) {
  const { t } = useTranslations()
  const [data, setData] = useState<LeaderboardItem[]>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [error, setError] = useState<string | null>(null)
  const isCollapsed = useLeaderboardStore((s) => s.isCollapsed)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard?period=${period}&type=${type}`)
      if (res.ok) {
        const newData = await res.json()
        setData(newData)
        setLastUpdated(new Date())
      } else {
        setError('Failed to load')
      }
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err)
      setError('Connection error')
    } finally {
      setIsRefreshing(false)
    }
  }, [period, type])

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return
    const interval = setInterval(() => {
      void handleRefresh()
    }, refreshInterval)
    return () => clearInterval(interval)
  }, [period, type, refreshInterval, handleRefresh])

  return (
    <div className="relative font-accent">
      {!isCollapsed && error && (
        <p className="mb-2 text-[11px] text-red-400" role="status">
          {t('dashboard.leaderboardRefreshError')}
        </p>
      )}

      <LeaderboardList
        data={data}
        currentUserId={currentUserId}
        period={period}
        type={type}
        userRank={userRank}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isCollapsed={isCollapsed}
      />

      {!isCollapsed && (
        <p className="mt-3 text-center text-[10px] text-eve-muted">
          {t('dashboard.leaderboardLastUpdate')}:{' '}
          <FormattedDate date={lastUpdated} mode="time" />
        </p>
      )}
    </div>
  )
}
