export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

const ACTIVITY_TYPES = ['mining', 'ratting', 'abyssal', 'exploration', 'escalations', 'crab', 'pvp'] as const

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
    message: string
  }>
}

interface ActivityData {
  totalEstimatedValue?: number
  estimatedLootValue?: number
  grossBounties?: number
  totalLootValue?: number
  totalValue?: number
  [key: string]: unknown
}

function extractValue(activityType: string, data: ActivityData | null | undefined): number {
  if (!data) return 0
  
  switch (activityType) {
    case 'mining':
      return data.totalEstimatedValue || 0
    case 'ratting':
      return (data.estimatedLootValue || 0) + (data.grossBounties || 0)
    case 'abyssal':
    case 'exploration':
      return data.totalLootValue || 0
    default:
      return data.totalValue || 0
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

    const value = extractValue(type, activity.data as ActivityData | null)
    const duration = activity.endTime
      ? (new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()) / 60000
      : 0

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
        message: `${type} está em alta (+${changePercent}%)`,
      })
    } else if (trend === 'down' && changePercent < -THRESHOLD) {
      alerts.push({
        type: 'down',
        activity: type,
        message: `${type} está em queda (${changePercent}%)`,
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