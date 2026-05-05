import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY } from './registry'
import { runScript } from './runner'
import { logger } from '@/lib/server-logger'
import cronParser from 'cron-parser'

/** Who invoked `processScheduledScripts` — stored on `SchedulerHeartbeat`. */
export type SchedulerTickSource = 'external' | 'internal' | 'manual'

export type SchedulerHealthStatus = 'healthy' | 'stale' | 'never'

export interface SchedulerHealth {
  lastTickAt: Date | null
  lastSource: string | null
  ticksLast24h: number
  lastDueCount: number | null
  overdueSchedules: number
  status: SchedulerHealthStatus
}

const STALE_AFTER_MS = 10 * 60 * 1000
const OVERDUE_GRACE_MS = 5 * 60 * 1000

/**
 * Aggregated scheduler tick + overdue schedule signal for admin UI and APIs.
 */
export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [last, ticksLast24h, overdueSchedules] = await Promise.all([
    prisma.schedulerHeartbeat.findFirst({
      orderBy: { tickAt: 'desc' },
    }),
    prisma.schedulerHeartbeat.count({
      where: { tickAt: { gte: dayAgo } },
    }),
    prisma.scriptSchedule.count({
      where: {
        active: true,
        nextRunAt: { lt: new Date(now.getTime() - OVERDUE_GRACE_MS) },
      },
    }),
  ])

  let status: SchedulerHealthStatus
  if (!last) {
    status = 'never'
  } else if (now.getTime() - last.tickAt.getTime() > STALE_AFTER_MS) {
    status = 'stale'
  } else {
    status = 'healthy'
  }

  return {
    lastTickAt: last?.tickAt ?? null,
    lastSource: last?.source ?? null,
    ticksLast24h,
    lastDueCount: last?.dueCount ?? null,
    overdueSchedules,
    status,
  }
}

/**
 * Checks for scheduled scripts that need to run and triggers them.
 * This can be called by a cron job or a background worker.
 */
export async function processScheduledScripts(source: SchedulerTickSource = 'external') {
  const tickStart = Date.now()
  const now = new Date()

  const schedules = await prisma.scriptSchedule.findMany({
    where: {
      active: true,
      nextRunAt: {
        lte: now,
      },
    },
  })

  const results: Array<{ scheduleId: string; scriptId: string; executionId: string }> = []

  for (const schedule of schedules) {
    try {
      logger.info('Scheduler', `Triggering scheduled script: ${schedule.scriptId}`, {
        scheduleId: schedule.id,
        scriptId: schedule.scriptId,
      })

      const execution = await prisma.scriptExecution.create({
        data: {
          scriptId: schedule.scriptId,
          scheduleId: schedule.id,
          status: 'pending',
          params: (schedule.params as object) || {},
          dryRun: schedule.dryRun,
          logs: [],
          progress: {},
        },
      })

      runScript(execution.id, schedule.dryRun).catch((err) => {
        logger.error('Scheduler', `Critical execution failure for ${execution.id}`, {
          error: err,
          executionId: execution.id,
          scriptId: schedule.scriptId,
        })
      })

      const nextRun = calculateNextRun(schedule.interval || 'daily', schedule.cron)
      await prisma.scriptSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRun,
        },
      })

      results.push({
        scheduleId: schedule.id,
        scriptId: schedule.scriptId,
        executionId: execution.id,
      })
    } catch (error) {
      logger.error('Scheduler', `Failed to trigger ${schedule.scriptId}`, {
        error,
        scriptId: schedule.scriptId,
        scheduleId: schedule.id,
      })
    }
  }

  const durationMs = Date.now() - tickStart

  try {
    await prisma.schedulerHeartbeat.create({
      data: {
        dueCount: schedules.length,
        triggeredCount: results.length,
        source,
        durationMs,
      },
    })
  } catch (err) {
    logger.error('Scheduler', 'Failed to write SchedulerHeartbeat', { error: err, source })
  }

  return results
}

export function calculateNextRun(interval: string, cron?: string | null): Date {
  const now = new Date()

  if (cron && (interval === 'custom' || !interval || interval === 'null')) {
    try {
      const parsed = cronParser.parse(cron)
      return parsed.next().toDate()
    } catch (err) {
      logger.error('Scheduler', `Failed to parse cron expression: ${cron}`, { error: err })
    }
  }

  if (interval === 'hourly') {
    if (cron && cron.includes('* * * *')) {
      try {
        const parsed = cronParser.parse(cron)
        return parsed.next().toDate()
      } catch (err) {
        /* fall through */
      }
    }
    return new Date(now.getTime() + 60 * 60 * 1000)
  }

  if (interval === '15m' || interval === 'every15m') {
    return new Date(now.getTime() + 15 * 60 * 1000)
  }

  if (interval === '10m' || interval === 'every10m') {
    return new Date(now.getTime() + 10 * 60 * 1000)
  }

  if (interval === '5m' || interval === 'every5m') {
    return new Date(now.getTime() + 5 * 60 * 1000)
  }

  if (interval === 'daily') {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000)
  }

  if (interval === 'weekly') {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  if (interval === 'monthly') {
    const next = new Date(now)
    next.setMonth(next.getMonth() + 1)
    return next
  }

  if (cron) {
    try {
      const parsed = cronParser.parse(cron)
      return parsed.next().toDate()
    } catch (err) {
      /* fall through */
    }
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}
