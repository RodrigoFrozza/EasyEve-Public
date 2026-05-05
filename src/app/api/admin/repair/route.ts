import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling } from '@/lib/api-handler'
import { 
  getRepairStatus, 
  runRepairJob, 
  clearRepairStatusFile 
} from '@/lib/sde/repair-job'

/**
 * Standardized Repair Route
 * Refactored to use centralized repair-job library.
 */

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => ({}))
  const dryRun = body.dryRun !== false

  const current = getRepairStatus()
  if (current.status === 'running') {
    throw new AppError(
      ErrorCodes.VALIDATION_FAILED,
      'Repair already running',
      409
    )
  }

  const jobId = Date.now().toString(36)
  
  // Fire and forget background repair
  runRepairJob(dryRun, { presetJobId: jobId })

  return {
    success: true,
    message: dryRun ? 'Dry run started in background' : 'Repair started in background',
    jobId,
    checkStatus: `/api/admin/repair`,
  }
})

export const GET = withErrorHandling(async () => {
  const status = getRepairStatus()
  
  if (status.status === 'idle') {
    return {
      status: 'idle',
      usage: {
        startRepair: 'POST /api/admin/repair (dry run)',
        startRepairApply: 'POST /api/admin/repair {"dryRun": false}',
        checkStatus: 'GET /api/admin/repair',
        clearStatus: 'DELETE /api/admin/repair',
      },
    }
  }

  return {
    success: true,
    ...status,
  }
})

export const DELETE = withErrorHandling(async () => {
  clearRepairStatusFile()
  return { success: true, message: 'Status cleared' }
})
