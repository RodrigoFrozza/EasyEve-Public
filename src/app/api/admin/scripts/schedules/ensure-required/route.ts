import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { ensureRequiredSchedulesExist } from '@/lib/scripts/required-schedules'

// POST /api/admin/scripts/schedules/ensure-required - Create any missing schedules
// required by the pause/complete activity automation (idempotent).
export const POST = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    return ensureRequiredSchedulesExist()
  })
)
