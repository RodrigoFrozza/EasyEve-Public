import { SCRIPT_REGISTRY } from '@/lib/scripts/registry'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    // Fetch last successful execution for each script
    const lastSuccesses = await prisma.scriptExecution.findMany({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      distinct: ['scriptId'],
      select: {
        scriptId: true,
        createdAt: true,
      }
    })

    const lastSyncMap = Object.fromEntries(
      lastSuccesses.map(s => [s.scriptId, s.createdAt])
    )

    // Last execution of any status per script (for admin status + "last run")
    const recentForLastRun = await prisma.scriptExecution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 800,
      select: {
        scriptId: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    })
    const lastRunByScript = new Map<
      string,
      { status: string; createdAt: Date; startedAt: Date | null; completedAt: Date | null }
    >()
    for (const row of recentForLastRun) {
      if (!lastRunByScript.has(row.scriptId)) {
        lastRunByScript.set(row.scriptId, {
          status: row.status,
          createdAt: row.createdAt,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        })
      }
    }

    const activeExecutions = await prisma.scriptExecution.findMany({
      where: { status: { in: ['pending', 'running'] } },
      select: { scriptId: true },
    })
    const runningScriptIds = new Set(activeExecutions.map((e) => e.scriptId))

    // Fetch active schedules
    const activeSchedules = await prisma.scriptSchedule.findMany({
      where: { active: true },
      select: {
        scriptId: true,
        interval: true,
        cron: true
      }
    })

    const scheduleMap = Object.fromEntries(
      activeSchedules.map(s => [
        s.scriptId, 
        s.interval === 'custom' ? `Cron: ${s.cron}` : s.interval
      ])
    )

    // Map registry to the format expected by the UI
    const availableScripts = Object.values(SCRIPT_REGISTRY).map((script) => {
      const lastRun = lastRunByScript.get(script.id)
      const isActive = runningScriptIds.has(script.id)
      const status: 'idle' | 'running' | 'completed' | 'failed' = isActive
        ? 'running'
        : lastRun?.status === 'failed'
          ? 'failed'
          : lastRun?.status === 'completed'
            ? 'completed'
            : 'idle'

      return {
        id: script.id,
        name: script.name,
        description: script.description,
        category: script.category,
        dangerLevel: script.dangerLevel ?? 'safe',
        deprecated: script.deprecated ?? false,
        deprecatedReason: script.deprecatedReason ?? null,
        paramsSchema: script.paramsSchema ?? [],
        supportsDryRun: script.supportsDryRun ?? true,
        executionPolicy: script.executionPolicy ?? 'standard',
        lastSync: lastSyncMap[script.id] || null,
        schedule: scheduleMap[script.id] || null,
        lastRunAt: lastRun?.createdAt ?? null,
        lastExecutionStatus: lastRun?.status ?? null,
        status,
      }
    })

    // Sort by category then by name
    availableScripts.sort((a, b) => {
      if (a.category === b.category) return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

    return { scripts: availableScripts }
  })
)
