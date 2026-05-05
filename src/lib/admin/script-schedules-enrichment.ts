import type { ScriptSchedule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY } from '@/lib/scripts/registry'
import { getSchedulerHealth, type SchedulerHealth } from '@/lib/scripts/scheduler'

export interface EnrichedScheduleLastExecution {
  id: string
  status: string
  startedAt: Date | null
  completedAt: Date | null
  durationMs: number | null
  error: string | null
  progress: unknown
}

export interface EnrichedScheduleStats {
  runs24h: number
  failures24h: number
  avgDurationMs: number | null
}

export type EnrichedScriptSchedule = ScriptSchedule & {
  scriptName: string
  scriptCategory: string
  dangerLevel: string
  lastExecution: EnrichedScheduleLastExecution | null
  stats: EnrichedScheduleStats
  overdue: boolean
}

export interface EnrichedSchedulesResponse {
  schedules: EnrichedScriptSchedule[]
  meta: { health: SchedulerHealth }
}

const OVERDUE_GRACE_MS = 5 * 60 * 1000

export async function getEnrichedSchedulesList(): Promise<EnrichedSchedulesResponse> {
  const health = await getSchedulerHealth()
  const schedules = await prisma.scriptSchedule.findMany({
    orderBy: { nextRunAt: 'asc' },
  })

  if (schedules.length === 0) {
    return { schedules: [], meta: { health } }
  }

  const scheduleIds = schedules.map((s) => s.id)
  const now = new Date()
  const overdueThreshold = new Date(now.getTime() - OVERDUE_GRACE_MS)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [recentExecutions, statsRows] = await Promise.all([
    prisma.scriptExecution.findMany({
      where: { scheduleId: { in: scheduleIds } },
      orderBy: { createdAt: 'desc' },
      take: 4000,
      select: {
        id: true,
        scheduleId: true,
        scriptId: true,
        status: true,
        error: true,
        progress: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    }),
    prisma.scriptExecution.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        createdAt: { gte: dayAgo },
      },
      select: {
        scheduleId: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    }),
  ])

  const lastExecBySchedule = new Map<string, (typeof recentExecutions)[0]>()
  for (const ex of recentExecutions) {
    if (ex.scheduleId && !lastExecBySchedule.has(ex.scheduleId)) {
      lastExecBySchedule.set(ex.scheduleId, ex)
    }
  }

  const statsBySchedule = new Map<
    string,
    { runs24h: number; failures24h: number; durationSumMs: number; durationCount: number }
  >()

  for (const row of statsRows) {
    if (!row.scheduleId) continue
    let s = statsBySchedule.get(row.scheduleId)
    if (!s) {
      s = { runs24h: 0, failures24h: 0, durationSumMs: 0, durationCount: 0 }
      statsBySchedule.set(row.scheduleId, s)
    }
    s.runs24h += 1
    if (row.status === 'failed') s.failures24h += 1
    if (
      row.status === 'completed' &&
      row.startedAt &&
      row.completedAt &&
      row.completedAt > row.startedAt
    ) {
      s.durationSumMs += row.completedAt.getTime() - row.startedAt.getTime()
      s.durationCount += 1
    }
  }

  const enriched: EnrichedScriptSchedule[] = schedules.map((s) => {
    const reg = SCRIPT_REGISTRY[s.scriptId]
    const last = lastExecBySchedule.get(s.id)
    const st = statsBySchedule.get(s.id)
    const avgDurationMs =
      st && st.durationCount > 0 ? Math.round(st.durationSumMs / st.durationCount) : null

    const lastExecution: EnrichedScheduleLastExecution | null = last
      ? {
          id: last.id,
          status: last.status,
          startedAt: last.startedAt,
          completedAt: last.completedAt,
          durationMs:
            last.startedAt && last.completedAt
              ? last.completedAt.getTime() - last.startedAt.getTime()
              : null,
          error: last.error,
          progress: last.progress,
        }
      : null

    const overdue = Boolean(s.active && s.nextRunAt != null && s.nextRunAt < overdueThreshold)

    return {
      ...s,
      scriptName: reg?.name ?? s.scriptId,
      scriptCategory: reg?.category ?? 'unknown',
      dangerLevel: reg?.dangerLevel ?? 'safe',
      lastExecution,
      stats: {
        runs24h: st?.runs24h ?? 0,
        failures24h: st?.failures24h ?? 0,
        avgDurationMs,
      },
      overdue,
    }
  })

  return { schedules: enriched, meta: { health } }
}
