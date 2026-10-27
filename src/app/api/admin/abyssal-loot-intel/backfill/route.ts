export const dynamic = 'force-dynamic'

import { withErrorHandling } from '@/lib/api-handler'
import { backfillAbyssalLootIntel } from '@/lib/analytics/abyssal-loot-intel-ingest'
import { requireMasterOrCronToken } from '@/lib/admin-cron-auth'

export const POST = withErrorHandling(async (request: Request) => {
  await requireMasterOrCronToken(request)

  const body = await request.json().catch(() => ({}))
  const limit =
    typeof body.limit === 'number' && body.limit > 0
      ? Math.min(body.limit, 2000)
      : 500
  const reconcile = body.reconcile === true

  return backfillAbyssalLootIntel({ limit, reconcile })
})
