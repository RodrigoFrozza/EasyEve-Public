import { useState, useEffect, useMemo } from 'react'
import { Activity, useActivityStore } from '@/lib/stores/activity-store'
import { useActivityStats } from './use-activity-stats'

export interface ActivityMetrics {
  elapsedMs: number
  elapsedFormatted: string
  iskPerHour: number
  totalRevenue: number
  netProfit: number
  isMining: boolean
  isRatting: boolean
  isExploration: boolean
  essCountdown?: string
  trend: 'up' | 'down' | 'stable'
  efficiency: number | string
}

export function useActivityMetrics(activity: Activity): { metrics: ActivityMetrics, isMounted: boolean } {
  const [now, setNow] = useState<number>(Date.now())
  const [isMounted, setIsMounted] = useState(false)
  const serverClockOffset = useActivityStore((state) => state.serverClockOffset)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update timer every second for active activities
  useEffect(() => {
    if (activity.status !== 'active' || activity.isPaused) {
      return
    }

    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [activity.status, activity.isPaused])

  // Calculate elapsed time in ms
  const elapsedMs = useMemo(() => {
    const start = new Date(activity.startTime).getTime()
    const end = activity.endTime ? new Date(activity.endTime).getTime() : (now + serverClockOffset)
    
    let duration = end - start

    if (activity.accumulatedPausedTime) {
      duration -= activity.accumulatedPausedTime
    }

    if (activity.isPaused && activity.pausedAt) {
      const pausedStart = new Date(activity.pausedAt).getTime()
      duration -= (now + serverClockOffset - pausedStart)
    }

    return Math.max(0, duration)
  }, [activity.startTime, activity.endTime, activity.accumulatedPausedTime, activity.isPaused, activity.pausedAt, now, serverClockOffset])

  // Format elapsed time (HH:MM:SS)
  const elapsedFormatted = useMemo(() => {
    const hours = Math.floor(elapsedMs / 3600000)
    const minutes = Math.floor((elapsedMs % 3600000) / 60000)
    const seconds = Math.floor((elapsedMs % 60000) / 1000)

    const h = hours.toString().padStart(2, '0')
    const m = minutes.toString().padStart(2, '0')
    const s = seconds.toString().padStart(2, '0')

    if (hours > 0) return `${h}:${m}:${s}`
    return `${m}:${s}`
  }, [elapsedMs])

  const stats = useActivityStats(activity as any)

  const iskPerHour = useMemo(() => {
    const hours = elapsedMs / 3600000
    if (hours < 0.001) return 0
    return stats.netProfit / hours
  }, [stats.netProfit, elapsedMs])

  // ESS Payout Timer for Ratting
  const essCountdown = useMemo(() => {
    if (activity.type !== 'ratting') return undefined

    const lastEssPaymentAt = (activity.data as any)?.lastEssPaymentAt
    if (!lastEssPaymentAt) return undefined

    const lastPaymentTime = new Date(lastEssPaymentAt).getTime()
    if (Number.isNaN(lastPaymentTime)) return undefined
    const nextPayoutTime = lastPaymentTime + (2 * 60 + 48) * 60 * 1000 
    const diff = nextPayoutTime - (now + serverClockOffset)

    if (diff <= 0) return 'Ready'

    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
  }, [activity.type, activity.data, now, serverClockOffset])

  const trend = (activity.data as any)?.iskTrend || 'stable'

  return {
    metrics: {
      elapsedMs,
      elapsedFormatted,
      iskPerHour,
      totalRevenue: stats.totalRevenue,
      netProfit: stats.netProfit,
      isMining: stats.isMining,
      isRatting: stats.isRatting,
      isExploration: activity.type === 'exploration',
      essCountdown,
      trend,
      efficiency: iskPerHour
    },
    isMounted
  }
}
