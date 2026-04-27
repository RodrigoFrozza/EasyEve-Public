'use client'

import { useState, useEffect, useCallback } from 'react'
import { LeaderboardList } from './LeaderboardList'
import { RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react'
import { useLeaderboardStore } from '@/lib/stores/leaderboard-store'
import { FormattedDate } from '@/components/shared/FormattedDate'


interface LeaderboardData {
  userId: string
  total: number
  label1?: number // bounty or quantity
  label2?: number // ess or volume
  characterName: string
  characterId: number
}

interface LeaderboardWrapperProps {
  initialData: LeaderboardData[]
  currentUserId?: string
  period: string
  type?: string
  userRank?: number
  refreshInterval?: number // em milliseconds
}

export function LeaderboardWrapper({
  initialData,
  currentUserId,
  period,
  type = 'ratting',
  userRank,
  refreshInterval = 5 * 60 * 1000 // default 5 min
}: LeaderboardWrapperProps) {
  const [data, setData] = useState<LeaderboardData[]>(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [error, setError] = useState<string | null>(null)

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

  const isCollapsed = useLeaderboardStore((s) => s.isCollapsed)


  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return
    
    const interval = setInterval(() => {
      handleRefresh()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [period, type, refreshInterval, handleRefresh])

  return (
    <div className="relative">
      {!isCollapsed && (
        <div className="absolute top-1 right-1 z-20 flex gap-1">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-md bg-eve-dark/80 border border-eve-border hover:bg-eve-dark transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3 w-3 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          {error && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30"
              title={error}
              role="status"
            >
              !
            </span>
          )}
        </div>
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
        <div className="mt-2 text-[8px] text-gray-600 text-center uppercase font-black tracking-widest opacity-50">
          Last updated: <FormattedDate date={lastUpdated} mode="time" />
        </div>
      )}

    </div>
  )
}
