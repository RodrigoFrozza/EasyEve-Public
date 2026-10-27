import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY } from '@/lib/scripts/registry'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { calculateNextRun } from '@/lib/scripts/scheduler'
import { getEnrichedSchedulesList } from '@/lib/admin/script-schedules-enrichment'

// GET /api/admin/scripts/schedules - List all schedules (enriched for admin dashboard)
export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    return getEnrichedSchedulesList()
  })
)

// POST /api/admin/scripts/schedules - Create a new schedule
export const POST = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (req) => {
    const body = await req.json()
    const { scriptId, interval, cron, params, dryRun, active, name } = body

    if (!scriptId || !SCRIPT_REGISTRY[scriptId as keyof typeof SCRIPT_REGISTRY]) {
      return Response.json({ error: 'Invalid scriptId' }, { status: 400 })
    }

    const nextRunAt = calculateNextRun(interval || 'daily', cron)

    const schedule = await prisma.scriptSchedule.create({
      data: {
        scriptId,
        name: name || scriptId,
        interval: interval || 'daily',
        cron: cron || undefined,
        params: params || undefined,
        dryRun: dryRun ?? false,
        active: active ?? true,
        nextRunAt,
      }
    })

    return schedule
  })
)
