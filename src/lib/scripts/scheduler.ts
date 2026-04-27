import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY } from './registry'
import { runScript } from './runner'
import { logger } from '@/lib/server-logger'
import cronParser from 'cron-parser'


/**
 * Checks for scheduled scripts that need to run and triggers them.
 * This can be called by a cron job or a background worker.
 */
export async function processScheduledScripts() {
  const now = new Date()

  // Find active schedules that haven't run since their next run date
  const schedules = await prisma.scriptSchedule.findMany({
    where: {
      active: true,
      nextRunAt: {
        lte: now
      }
    }
  })

  const results = []

  for (const schedule of schedules) {
    try {
      logger.info('Scheduler', `Triggering scheduled script: ${schedule.scriptId}`, { scheduleId: schedule.id, scriptId: schedule.scriptId })
      
      // 1. Create a new execution record
      const execution = await prisma.scriptExecution.create({
        data: {
          scriptId: schedule.scriptId,
          scheduleId: schedule.id,
          status: 'pending',
          params: schedule.params as any || {},
          dryRun: schedule.dryRun,
          logs: [],
          progress: {}
        }
      })

      // 2. Trigger the execution (non-blocking)
      runScript(execution.id, schedule.dryRun).catch(err => {
        logger.error('Scheduler', `Critical execution failure for ${execution.id}`, { error: err, executionId: execution.id, scriptId: schedule.scriptId })
      })

      // 3. Update nextRunAt based on interval or cron
      const nextRun = calculateNextRun(schedule.interval || 'daily', schedule.cron)
      await prisma.scriptSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRun
        }
      })

      results.push({
        scheduleId: schedule.id,
        scriptId: schedule.scriptId,
        executionId: execution.id
      })

    } catch (error) {
      logger.error('Scheduler', `Failed to trigger ${schedule.scriptId}`, { error, scriptId: schedule.scriptId, scheduleId: schedule.id })
    }
  }

  return results
}

function calculateNextRun(interval: string, cron?: string | null): Date {
  const now = new Date()
  
  // 1. If a cron expression is provided, prioritize it for custom or null intervals
  if (cron && (interval === 'custom' || !interval || interval === 'null')) {
    try {
      const parsed = cronParser.parse(cron)
      return parsed.next().toDate()
    } catch (err) {
      logger.error('Scheduler', `Failed to parse cron expression: ${cron}`, { error: err })
      // Fallback to interval logic if cron parsing fails
    }
  }
  
  // 2. Standard interval logic
  if (interval === 'hourly') {
    // If we have a cron for hourly (e.g. "5 * * * *"), use it to keep the exact minute
    if (cron && cron.includes('* * * *')) {
      try {
        const parsed = cronParser.parse(cron)
        return parsed.next().toDate()
      } catch (err) {}
    }
    return new Date(now.getTime() + 60 * 60 * 1000)
  }
  
  /** Every 15 minutes — used for activity ESI sync + safety audit schedules. */
  if (interval === '15m' || interval === 'every15m') {
    return new Date(now.getTime() + 15 * 60 * 1000)
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

  // 3. Fallback: if we have a cron even if interval was set (except if specifically handled above)
  if (cron) {
    try {
      const parsed = cronParser.parse(cron)
      return parsed.next().toDate()
    } catch (err) {}
  }

  // Default to 24h if unknown
  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}

