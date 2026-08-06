import { logger } from '@/lib/server-logger'
import cronParser from 'cron-parser'

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
