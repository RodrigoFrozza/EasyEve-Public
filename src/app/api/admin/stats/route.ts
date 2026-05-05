import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

const getCachedStats = unstable_cache(
  async () => {
    const now = new Date()
    const [
      totalAccounts,
      activeSubscriptions,
      pendingPayments,
      totalCharacters
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          subscriptionEnd: { gt: now }
        }
      }),
      prisma.payment.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true }
      }),
      prisma.character.count()
    ])

    return {
      totalAccounts,
      activeSubscriptions,
      pendingIsk: pendingPayments._sum.amount || 0,
      totalCharacters
    }
  },
  ['admin-stats-summary'],
  { revalidate: 30, tags: ['admin-stats'] }
)

/**
 * GET /api/admin/stats - Fetch high-level admin dashboard statistics
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  return await getCachedStats()
}))
