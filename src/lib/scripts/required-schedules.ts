import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { calculateNextRun } from './schedule-cadence'

export interface RequiredScheduleDefinition {
  scriptId: string
  name: string
  interval: string
}

/**
 * Scripts that must always have an active ScriptSchedule row, bootstrapped
 * automatically (see ensureRequiredSchedulesExist) so they never depend on a
 * manual step in the Admin UI or on the VPS. Originally just the pause/complete
 * automation (activity-automation-policy) — if none of those three had a
 * schedule, the external cron would have nothing to trigger and sessions would
 * never auto-pause/auto-complete. Now also covers other schedules that must
 * never silently go unscheduled (e.g. pi-planet-alerts).
 */
export const REQUIRED_SCHEDULES: RequiredScheduleDefinition[] = [
  {
    scriptId: 'auto-activity-detection',
    name: 'Auto-Activity Detection (ratting/mining)',
    interval: '15m',
  },
  {
    scriptId: 'unified-activity-sync',
    name: 'Unified Activity Sync (Background + Loot)',
    interval: '15m',
  },
  {
    scriptId: 'audit-activity-safety',
    name: 'Audit Activity Safety',
    interval: '15m',
  },
  {
    scriptId: 'pi-planet-alerts',
    name: 'PI Planet Buffer & Extractor Alerts',
    interval: '15m',
  },
  {
    scriptId: 'snapshot-monitored-markets',
    name: 'Snapshot Monitored Structure Markets',
    interval: 'daily',
  },
]

export const REQUIRED_SCHEDULE_SCRIPT_IDS = REQUIRED_SCHEDULES.map((s) => s.scriptId)

/**
 * Idempotent bootstrap: creates a ScriptSchedule for any required scriptId that
 * has no schedule row at all yet. Never touches a schedule that already exists,
 * even if the user has since deactivated or reconfigured it.
 */
export async function ensureRequiredSchedulesExist(): Promise<{ created: string[] }> {
  const existing = await prisma.scriptSchedule.findMany({
    where: { scriptId: { in: REQUIRED_SCHEDULE_SCRIPT_IDS } },
    select: { scriptId: true },
  })
  const existingIds = new Set(existing.map((s) => s.scriptId))
  const missing = REQUIRED_SCHEDULES.filter((def) => !existingIds.has(def.scriptId))

  if (missing.length === 0) {
    return { created: [] }
  }

  for (const def of missing) {
    await prisma.scriptSchedule.create({
      data: {
        scriptId: def.scriptId,
        name: def.name,
        interval: def.interval,
        dryRun: false,
        active: true,
        nextRunAt: calculateNextRun(def.interval),
      },
    })
  }

  const created = missing.map((m) => m.scriptId)
  logger.info('RequiredSchedules', 'Created missing required activity-automation schedules', {
    created,
  })

  return { created }
}
