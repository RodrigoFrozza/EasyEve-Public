import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling } from '@/lib/api-handler'
import {
  clearSyncChargesStatusFile,
  getSyncChargesStatus,
  runSyncChargesJob,
} from '@/lib/sde/sync-charges-job'

export const POST = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const target = (searchParams.get('target') || 'all') as 'all' | 'charges' | 'modules'

  const current = getSyncChargesStatus()
  if (current.status === 'running') {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Sync already running', 409)
  }

  const jobId = Date.now().toString(36)

  // Fire and forget - the job handles its own logging and state
  void runSyncChargesJob(target, { presetJobId: jobId })

  return {
    success: true,
    message: 'Charge sync started in background',
    jobId,
    checkStatus: `GET /api/admin/sync-charges`,
  }
})

export const GET = withErrorHandling(async () => {
  const status = getSyncChargesStatus()

  if (status.status === 'idle') {
    const dbStats = {
      charges: await prisma.chargeStats.count(),
      modulesWithCharges: await prisma.moduleStats.count({
        where: { chargeGroup1: { not: null } },
      }),
    }
    return {
      status: 'idle',
      database: dbStats,
      usage: {
        startSync: 'POST /api/admin/sync-charges?target=all|charges|modules',
        checkStatus: 'GET /api/admin/sync-charges',
        clearStatus: 'DELETE /api/admin/sync-charges',
      },
    }
  }

  return {
    success: true,
    ...status,
  }
})

export const DELETE = withErrorHandling(async () => {
  try {
    clearSyncChargesStatusFile()
    return { success: true, message: 'Status cleared' }
  } catch {
    // If it fails, it's usually because file doesn't exist, which is fine
    return { success: true, message: 'No status file to clear' }
  }
})

