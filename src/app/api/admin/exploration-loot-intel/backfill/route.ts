export const dynamic = 'force-dynamic'

import { withErrorHandling } from '@/lib/api-handler'
import { backfillExplorationLootIntel } from '@/lib/analytics/exploration-loot-intel-ingest'
import { requireMasterOrCronToken } from '@/lib/admin-cron-auth'

export const POST = withErrorHandling(async (request: Request) => {
  await requireMasterOrCronToken(request)

  const body = await request.json().catch(() => ({}))
  const limit =
    typeof body.limit === 'number' && body.limit > 0
      ? Math.min(body.limit, 2000)
      : 500
  const reconcile = body.reconcile === true

  return backfillExplorationLootIntel({ limit, reconcile })
})
