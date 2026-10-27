import { processScheduledScripts } from '@/lib/scripts/scheduler'
import { logger } from '@/lib/server-logger'

let started = false

/**
 * Optional in-process scheduler tick (not enabled by default).
 * Prefer an external caller to GET /api/admin/scripts/scheduler/trigger (see docs/AUTOMATION_SYSTEM.md).
 */
export function startSchedulerHeartbeat(): void {
  if (started) return
  started = true

  if (process.env.SCHEDULER_INTERNAL_ENABLED !== 'true') {
    return
  }

  const intervalMs = Math.max(
    15_000,
    parseInt(process.env.SCHEDULER_INTERNAL_INTERVAL_MS || '60000', 10) || 60_000
  )

  const tick = () => {
    processScheduledScripts('internal').catch((err) => {
      logger.error('SchedulerHeartbeat', 'Internal tick failed', { error: err })
    })
  }

  logger.info('SchedulerHeartbeat', 'Internal scheduler heartbeat enabled', { intervalMs })
  setInterval(tick, intervalMs)
  setTimeout(tick, 3000)
}
