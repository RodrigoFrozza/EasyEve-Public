import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { getSchedulerHealth } from '@/lib/scripts/scheduler'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    return getSchedulerHealth()
  })
)
