import { prisma } from '@/lib/prisma'
import { runScript } from './runner'
import { logger } from '@/lib/server-logger'
import { REQUIRED_SCHEDULE_SCRIPT_IDS, ensureRequiredSchedulesExist } from './required-schedules'
import { calculateNextRun } from './schedule-cadence'

export { calculateNextRun } from './schedule-cadence'

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
  /** scriptIds required by the pause/complete automation with no active schedule. */
  missingRequiredSchedules: string[]
}

const STALE_AFTER_MS = 10 * 60 * 1000
const OVERDUE_GRACE_MS = 5 * 60 * 1000
const ENSURE_REQUIRED_SCHEDULES_INTERVAL_MS = 10 * 60 * 1000

let schedulerTickInFlight = false
let lastEnsureRequiredSchedulesAt = 0

/**
 * Aggregated scheduler tick + overdue schedule signal for admin UI and APIs.
 */
export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [last, ticksLast24h, overdueSchedules, activeRequiredSchedules] = await Promise.all([
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
    prisma.scriptSchedule.findMany({
      where: { scriptId: { in: REQUIRED_SCHEDULE_SCRIPT_IDS }, active: true },
      select: { scriptId: true },
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

  const activeRequiredIds = new Set(activeRequiredSchedules.map((s) => s.scriptId))
  const missingRequiredSchedules = REQUIRED_SCHEDULE_SCRIPT_IDS.filter(
    (id) => !activeRequiredIds.has(id)
  )

  return {
    lastTickAt: last?.tickAt ?? null,
    lastSource: last?.source ?? null,
    ticksLast24h,
    lastDueCount: last?.dueCount ?? null,
    overdueSchedules,
    status,
    missingRequiredSchedules,
  }
}

/**
 * Checks for scheduled scripts that need to run and triggers them.
 * This can be called by a cron job or a background worker.
 */
export async function processScheduledScripts(source: SchedulerTickSource = 'external') {
  if (schedulerTickInFlight) {
    logger.warn('Scheduler', 'Skipping tick — previous scheduler run still in progress', { source })
    return []
  }

  schedulerTickInFlight = true
  const tickStart = Date.now()
  const now = new Date()

  if (tickStart - lastEnsureRequiredSchedulesAt > ENSURE_REQUIRED_SCHEDULES_INTERVAL_MS) {
    lastEnsureRequiredSchedulesAt = tickStart
    try {
      await ensureRequiredSchedulesExist()
    } catch (err) {
      logger.error('Scheduler', 'Failed to ensure required schedules exist', { error: err, source })
    }
  }

  try {
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
        // Don't dispatch a script whose previous execution is still running — a
        // slow run (longer than its interval) would otherwise get a concurrent
        // second execution racing on the same rows. Ignore executions older than
        // the max runtime so a crashed/stuck one can't block the schedule forever.
        const SCRIPT_MAX_RUNTIME_MS = 15 * 60 * 1000
        const existingRunning = await prisma.scriptExecution.findFirst({
          where: {
            scriptId: schedule.scriptId,
            status: { in: ['pending', 'running'] },
            createdAt: { gte: new Date(Date.now() - SCRIPT_MAX_RUNTIME_MS) },
          },
          select: { id: true },
        })
        if (existingRunning) {
          logger.warn('Scheduler', `Skipping ${schedule.scriptId} — previous execution still running`, {
            scheduleId: schedule.id,
            scriptId: schedule.scriptId,
            runningExecutionId: existingRunning.id,
          })
          continue
        }

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
  } finally {
    schedulerTickInFlight = false
  }
}
