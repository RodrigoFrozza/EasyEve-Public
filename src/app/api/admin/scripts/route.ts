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

    // Map registry to the format expected by the UI
    const availableScripts = Object.values(SCRIPT_REGISTRY).map(script => ({
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
    }))

    // Sort by category then by name
    availableScripts.sort((a, b) => {
      if (a.category === b.category) return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

    return { scripts: availableScripts }
  })
)
