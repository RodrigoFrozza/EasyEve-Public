'use client'

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { Activity, useActivityStore } from '@/lib/stores/activity-store'
import { useActivityStats } from './use-activity-stats'
import { useTranslations } from '@/i18n/hooks'

export interface ActivityMetrics {
  elapsedMs: number
  elapsedFormatted: string
  iskPerHour: number
  totalRevenue: number
  netProfit: number
  isMining: boolean
  isRatting: boolean
  isExploration: boolean
  isSalvaging: boolean
  essCountdown?: string
  trend: 'up' | 'down' | 'stable'
  efficiency: number | string
}

const nowListeners = new Set<() => void>()
let nowValue = Date.now()
let nowInterval: ReturnType<typeof setInterval> | null = null

function emitNow() {
  nowValue = Date.now()
  nowListeners.forEach((listener) => listener())
}

function subscribeNow(listener: () => void) {
  nowListeners.add(listener)
  if (!nowInterval) {
    nowInterval = setInterval(emitNow, 1000)
  }

  return () => {
    nowListeners.delete(listener)
    if (nowListeners.size === 0 && nowInterval) {
      clearInterval(nowInterval)
      nowInterval = null
    }
  }
}

function getNowSnapshot() {
  return nowValue
}

export function useActivityMetrics(activity: Activity): { metrics: ActivityMetrics, isMounted: boolean } {
  const { t } = useTranslations()
  const [isMounted, setIsMounted] = useState(false)
  const serverClockOffset = useActivityStore((state) => state.serverClockOffset)
  const sharedNow = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowSnapshot)
  const nowMs =
    activity.status === 'active' && !activity.isPaused
      ? sharedNow + serverClockOffset
      : nowValue + serverClockOffset

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const elapsedMs = useMemo(
    () =>
      getActivityDurationMs({
        startTime: activity.startTime,
        endTime: activity.endTime,
        status: activity.status,
        updatedAt: activity.updatedAt,
        accumulatedPausedTime: activity.accumulatedPausedTime,
        isPaused: activity.isPaused,
        pausedAt: activity.pausedAt,
        nowMs,
      }),
    [
      activity.startTime,
      activity.endTime,
      activity.status,
      activity.updatedAt,
      activity.accumulatedPausedTime,
      activity.isPaused,
      activity.pausedAt,
      nowMs,
    ]
  )

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
    const diff = nextPayoutTime - nowMs

    if (diff <= 0) return t('activity.ratting.essReady')

    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
  }, [activity.type, activity.data, nowMs, t])

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
      isSalvaging: activity.type === 'salvaging',
      essCountdown,
      trend,
      efficiency: iskPerHour
    },
    isMounted
  }
}
