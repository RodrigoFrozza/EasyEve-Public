export const dynamic = 'force-dynamic'

import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { syncCorpWalletPayments } from '@/lib/payments/wallet-sync'

/**
 * POST /api/admin/payments/sync - Sync corporation wallet journal with payments.
 * Same code path as the scheduled sync-wallet-journal script (wallet-sync.ts).
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  const result = await syncCorpWalletPayments()
  return { success: true, ...result }
}))
