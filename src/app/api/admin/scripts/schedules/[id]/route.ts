import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { calculateNextRun } from '@/lib/scripts/scheduler'

// PATCH /api/admin/scripts/schedules/[id] - Update a schedule
export const PATCH = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (req, user, { params }) => {
    const { id } = params as { id: string }
    const body = await req.json()
    const { interval, cron, params: scriptParams, dryRun, active, name } = body

    const updateData: Record<string, any> = {}
    
    if (interval !== undefined) updateData.interval = interval === '' ? null : interval
    if (cron !== undefined) updateData.cron = cron === '' ? null : cron
    if (scriptParams !== undefined) updateData.params = scriptParams
    if (dryRun !== undefined) updateData.dryRun = dryRun
    if (active !== undefined) updateData.active = active
    if (name !== undefined) updateData.name = name

    // Recalculate nextRunAt if interval or cron changes
    if (interval !== undefined || cron !== undefined) {
      const schedule = await prisma.scriptSchedule.findUnique({
        where: { id },
        select: { interval: true, cron: true }
      })
      
      if (schedule) {
        const finalInterval = interval !== undefined ? (interval === '' ? 'daily' : interval) : (schedule.interval || 'daily')
        const finalCron = cron !== undefined ? (cron === '' ? null : cron) : schedule.cron
        updateData.nextRunAt = calculateNextRun(finalInterval, finalCron)
      }
    }

    const schedule = await prisma.scriptSchedule.update({
      where: { id },
      data: updateData
    })

    return schedule
  })
)

// DELETE /api/admin/scripts/schedules/[id] - Delete a schedule
export const DELETE = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (req, user, { params }) => {
    const { id } = params as { id: string }
    await prisma.scriptSchedule.delete({ where: { id } })
    return { success: true }
  })
)
