import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

/**
 * Repeated-failure detection for scheduled scripts.
 *
 * A schedule can fail on every run while the scheduler itself stays "healthy"
 * (it ticks, it dispatches) — that is how the corp-wallet payment sync went
 * months without a single successful run and nobody noticed. Here a schedule
 * whose last FAILURE_ALERT_THRESHOLD finished executions all failed counts as
 * failing: it is listed in getSchedulerHealth().failingSchedules and every
 * master user gets a bell notification, repeated at most once per
 * REMINDER_INTERVAL_MS while it stays broken.
 */

export const FAILURE_ALERT_THRESHOLD = 3
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000
const STREAK_LOOKBACK = 50
const ERROR_PREVIEW_CHARS = 500

export const SCHEDULES_ADMIN_PATH = '/dashboard/admin/system/schedules'

export interface FailingSchedule {
  scheduleId: string
  scriptId: string
  name: string
  /** Consecutive failed runs, counted back from the newest (capped at STREAK_LOOKBACK). */
  consecutiveFailures: number
  /** True when every looked-back run failed, i.e. the real streak may be longer. */
  streakCapped: boolean
  lastError: string | null
  lastFailedAt: Date | null
}

/**
 * Consecutive failures at the head of the schedule's finished executions
 * (pending/running/cancelled ones are ignored).
 */
export async function getFailureStreak(scheduleId: string): Promise<{
  consecutiveFailures: number
  streakCapped: boolean
  lastError: string | null
  lastFailedAt: Date | null
}> {
  const recent = await prisma.scriptExecution.findMany({
    where: { scheduleId, status: { in: ['completed', 'failed'] } },
    orderBy: { createdAt: 'desc' },
    take: STREAK_LOOKBACK,
    select: { status: true, error: true, completedAt: true },
  })

  let consecutiveFailures = 0
  for (const execution of recent) {
    if (execution.status !== 'failed') break
    consecutiveFailures++
  }
  const newest = consecutiveFailures > 0 ? recent[0] : null
  return {
    consecutiveFailures,
    streakCapped: consecutiveFailures === STREAK_LOOKBACK,
    lastError: newest?.error ?? null,
    lastFailedAt: newest?.completedAt ?? null,
  }
}

export async function getFailingSchedules(
  schedules: Array<{ id: string; scriptId: string; name: string }>
): Promise<FailingSchedule[]> {
  const streaks = await Promise.all(
    schedules.map(async (schedule) => ({ schedule, streak: await getFailureStreak(schedule.id) }))
  )
  return streaks
    .filter(({ streak }) => streak.consecutiveFailures >= FAILURE_ALERT_THRESHOLD)
    .map(({ schedule, streak }) => ({
      scheduleId: schedule.id,
      scriptId: schedule.scriptId,
      name: schedule.name,
      ...streak,
    }))
}

/** "50+" when the lookback was exhausted, so a capped count never reads as exact. */
export function formatStreak(streak: { consecutiveFailures: number; streakCapped: boolean }): string {
  return `${streak.consecutiveFailures}${streak.streakCapped ? '+' : ''}`
}

function notificationTitle(scheduleName: string) {
  return `Script agendado falhando: ${scheduleName}`
}

/**
 * Called by the runner after a scheduled execution fails. Never throws — a
 * broken alert path must not mask the original failure.
 */
export async function alertOnRepeatedFailure(scheduleId: string): Promise<void> {
  try {
    const schedule = await prisma.scriptSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, name: true, scriptId: true },
    })
    if (!schedule) return

    const streak = await getFailureStreak(scheduleId)
    if (streak.consecutiveFailures < FAILURE_ALERT_THRESHOLD) return

    const title = notificationTitle(schedule.name)
    const masters = await prisma.user.findMany({ where: { role: 'master' }, select: { id: true } })
    if (masters.length === 0) {
      logger.error('ScriptFailureAlert', 'No master user to notify about a failing schedule', {
        scheduleId,
        scriptId: schedule.scriptId,
      })
      return
    }

    const since = new Date(Date.now() - REMINDER_INTERVAL_MS)
    const alreadyNotified = await prisma.notification.findMany({
      where: { userId: { in: masters.map((m) => m.id) }, type: 'system', title, createdAt: { gte: since } },
      select: { userId: true },
    })
    const notified = new Set(alreadyNotified.map((n) => n.userId))
    const pending = masters.filter((m) => !notified.has(m.id))
    if (pending.length === 0) return

    const error = streak.lastError ? streak.lastError.slice(0, ERROR_PREVIEW_CHARS) : 'sem mensagem de erro'
    await prisma.notification.createMany({
      data: pending.map((m) => ({
        userId: m.id,
        type: 'system',
        title,
        content: `${schedule.scriptId} falhou nas últimas ${formatStreak(streak)} execuções. Último erro: ${error}`,
        link: SCHEDULES_ADMIN_PATH,
      })),
    })
    logger.warn('ScriptFailureAlert', `Notified ${pending.length} master(s) about failing schedule ${schedule.scriptId}`, {
      scheduleId,
      consecutiveFailures: streak.consecutiveFailures,
    })
  } catch (error) {
    logger.error('ScriptFailureAlert', `Failed to alert on repeated failures of schedule ${scheduleId}`, error)
  }
}
