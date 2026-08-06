export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import {
  PI_PERFORMANCE_ACTIVITY,
  buildPiDailyPerformance,
  fetchPiLivePortfolio,
  loadPiDailySnapshots,
  recordPiDailySnapshot,
} from '@/lib/pi/portfolio-performance'

const ACTIVITY_TYPES = ['mining', 'ratting', 'abyssal', 'exploration', 'salvaging', 'escalations', 'crab', 'pvp'] as const

type PerformanceActivityType = (typeof ACTIVITY_TYPES)[number]

const THRESHOLD = 10

interface DailyData {
  date: string
  value: number
  sessions: number
  durationMinutes: number
}

interface ActivityTrend {
  activity: string
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  currentValue: number
  previousValue: number
  dailyData: DailyData[]
}

interface PerformanceResponse {
  period: number
  generatedAt: string
  summary: {
    totalValue: number
    totalSessions: number
    topActivity: string
  }
  byActivity: Record<string, ActivityTrend>
  alerts: Array<{
    type: 'up' | 'down'
    activity: string
    changePercent: number
  }>
}

interface ActivityData {
  totalEstimatedValue?: number
  estimatedLootValue?: number
  grossBounties?: number
  totalLootValue?: number
  totalValue?: number
  logs?: Array<{ amount?: number; value?: number }>
  [key: string]: unknown
}

function logIncomeTotal(data: ActivityData): number {
  const logs = data.logs
  if (!Array.isArray(logs)) return 0
  return logs.reduce(
    (sum, log) => sum + Math.max(Number(log.amount) || 0, Number(log.value) || 0),
    0,
  )
}

function extractValue(activityType: PerformanceActivityType, data: ActivityData | null | undefined): number {
  if (!data) return 0

  switch (activityType) {
    case 'mining':
      return data.totalEstimatedValue || 0
    case 'ratting':
    case 'abyssal':
      return getActivityFinancialMetrics({ type: activityType, data }).gross
    case 'exploration':
    case 'salvaging':
      return data.totalLootValue || logIncomeTotal(data) || 0
    case 'escalations':
    case 'crab':
    case 'pvp':
      return data.totalValue || 0
    default: {
      const _exhaustive: never = activityType
      return _exhaustive
    }
  }
}

function calculateTrend(current: number, previous: number): { trend: 'up' | 'down' | 'stable'; changePercent: number } {
  if (previous === 0) {
    return current > 0 ? { trend: 'up' as const, changePercent: 100 } : { trend: 'stable' as const, changePercent: 0 }
  }
  const changePercent = ((current - previous) / previous) * 100
  if (changePercent > THRESHOLD) return { trend: 'up' as const, changePercent: Math.round(changePercent) }
  if (changePercent < -THRESHOLD) return { trend: 'down' as const, changePercent: Math.round(changePercent) }
  return { trend: 'stable' as const, changePercent: Math.round(changePercent) }
}

function generateDateRange(days: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const period = Math.min(Math.max(Number.parseInt(searchParams.get('days') || '7', 10), 7), 30)
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - period)
  startDate.setHours(0, 0, 0, 0)

  const activities = await prisma.activity.findMany({
    where: {
      userId: user.id,
      status: 'completed',
      isDeleted: false,
      startTime: { gte: startDate },
    },
    select: {
      id: true,
      type: true,
      startTime: true,
      endTime: true,
      status: true,
      updatedAt: true,
      accumulatedPausedTime: true,
      isPaused: true,
      pausedAt: true,
      data: true,
    },
    orderBy: { startTime: 'asc' },
  })

  const dateRange = generateDateRange(period)
  const byActivity: Record<string, { daily: Map<string, { value: number; sessions: number; duration: number }> }> = {}

  for (const type of ACTIVITY_TYPES) {
    byActivity[type] = { daily: new Map() }
    for (const date of dateRange) {
      byActivity[type].daily.set(date, { value: 0, sessions: 0, duration: 0 })
    }
  }

  let totalValue = 0
  let totalSessions = 0

  for (const activity of activities) {
    const type = activity.type.toLowerCase()
    if (!byActivity[type]) continue

    const date = activity.startTime.toISOString().split('T')[0]
    const existing = byActivity[type].daily.get(date)
    if (!existing) continue

    const value = extractValue(type as PerformanceActivityType, activity.data as ActivityData | null)
    const duration = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    }) / 60000

    existing.value += value
    existing.sessions += 1
    existing.duration += duration

    totalValue += value
    totalSessions += 1
  }

  const halfPoint = Math.floor(period / 2)
  const resultByActivity: Record<string, ActivityTrend> = {}
  const alerts: PerformanceResponse['alerts'] = []
  let topActivity = ''
  let topValue = 0

  for (const type of ACTIVITY_TYPES) {
    const data = byActivity[type]
    const dailyData: DailyData[] = []
    let currentHalf = 0
    let previousHalf = 0

    data.daily.forEach((v, date) => {
      const idx = dateRange.indexOf(date)
      dailyData.push({
        date,
        value: v.value,
        sessions: v.sessions,
        durationMinutes: Math.round(v.duration),
      })
      if (idx >= halfPoint) currentHalf += v.value
      else previousHalf += v.value
    })

    const { trend, changePercent } = calculateTrend(currentHalf, previousHalf)
    const activityTotal = currentHalf + previousHalf

    if (activityTotal > topValue) {
      topValue = activityTotal
      topActivity = type
    }

    resultByActivity[type] = {
      activity: type,
      trend,
      changePercent,
      currentValue: currentHalf,
      previousValue: previousHalf,
      dailyData,
    }

    if (trend === 'up' && changePercent > THRESHOLD) {
      alerts.push({
        type: 'up',
        activity: type,
        changePercent,
      })
    } else if (trend === 'down' && changePercent < -THRESHOLD) {
      alerts.push({
        type: 'down',
        activity: type,
        changePercent,
      })
    }
  }

  const livePi = await fetchPiLivePortfolio(
    user.id,
    user.characters.map((c) => ({
      id: c.id,
      name: c.name,
      accessToken: c.accessToken,
    }))
  )

  if (livePi && livePi.colonyCount > 0 && !livePi.hasPartialFailure) {
    await recordPiDailySnapshot(user.id, livePi.currentNetIskPerHour, livePi.colonyCount).catch(
      () => undefined
    )
  }

  const piSnapshots = await loadPiDailySnapshots(user.id).catch(() => ({}))
  const piDailyRows = buildPiDailyPerformance(dateRange, piSnapshots, livePi)

  let piCurrentHalf = 0
  let piPreviousHalf = 0
  let piSessions = 0

  piDailyRows.forEach((row, idx) => {
    if (idx >= halfPoint) piCurrentHalf += row.value
    else piPreviousHalf += row.value
    piSessions += row.sessions
  })

  const piPeriodTotal = piCurrentHalf + piPreviousHalf
  if (piPeriodTotal !== 0 || piDailyRows.some((r) => r.sessions > 0)) {
    const { trend, changePercent } = calculateTrend(piCurrentHalf, piPreviousHalf)

    if (piPeriodTotal > topValue) {
      topValue = piPeriodTotal
      topActivity = PI_PERFORMANCE_ACTIVITY
    }

    totalValue += piPeriodTotal
    totalSessions += piSessions

    resultByActivity[PI_PERFORMANCE_ACTIVITY] = {
      activity: PI_PERFORMANCE_ACTIVITY,
      trend,
      changePercent,
      currentValue: piCurrentHalf,
      previousValue: piPreviousHalf,
      dailyData: piDailyRows.map(({ date, value, sessions, durationMinutes }) => ({
        date,
        value,
        sessions,
        durationMinutes,
      })),
    }

    if (trend === 'up' && changePercent > THRESHOLD) {
      alerts.push({
        type: 'up',
        activity: PI_PERFORMANCE_ACTIVITY,
        changePercent,
      })
    } else if (trend === 'down' && changePercent < -THRESHOLD) {
      alerts.push({
        type: 'down',
        activity: PI_PERFORMANCE_ACTIVITY,
        changePercent,
      })
    }
  }

  const response: PerformanceResponse = {
    period,
    generatedAt: new Date().toISOString(),
    summary: {
      totalValue,
      totalSessions,
      topActivity,
    },
    byActivity: resultByActivity,
    alerts,
  }

  return Response.json(response)
})