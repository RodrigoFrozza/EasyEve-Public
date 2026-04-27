import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling } from '@/lib/api-handler'
import { 
  getSyncStatus, 
  runSyncJob, 
  clearSyncStatusFile 
} from '@/lib/sde/sync-job'

/**
 * Standardized Sync Route
 * Refactored to use centralized sync-job library.
 */

export const POST = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const target = (searchParams.get('target') || 'all') as 'all' | 'ships' | 'modules'

  const current = getSyncStatus()
  if (current.status === 'running') {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      'Sync already running',
      409
    )
  }

  const jobId = Date.now().toString(36)

  // Fire and forget background sync
  runSyncJob(target, { presetJobId: jobId })

  return {
    success: true,
    message: 'Sync started in background',
    jobId,
    checkStatus: `/api/admin/sync`,
  }
})

export const GET = withErrorHandling(async () => {
  const status = getSyncStatus()
  
  if (status.status === 'idle') {
    const [shipCount, moduleCount] = await Promise.all([
      prisma.shipStats.count(),
      prisma.moduleStats.count(),
    ])

    return {
      status: 'idle',
      database: {
        ships: shipCount,
        modules: moduleCount,
      },
      usage: {
        startSync: 'POST /api/admin/sync?target=all|ships|modules',
        checkStatus: 'GET /api/admin/sync',
        clearStatus: 'DELETE /api/admin/sync',
      },
    }
  }

  return {
    success: true,
    ...status,
  }
})

export const DELETE = withErrorHandling(async () => {
  clearSyncStatusFile()
  return { success: true, message: 'Status cleared' }
})
