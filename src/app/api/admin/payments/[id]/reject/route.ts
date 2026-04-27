export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { logger } from '@/lib/server-logger'

/**
 * POST /api/admin/payments/[id]/reject - Reject a payment
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params

  const payment = await prisma.payment.update({
    where: { id },
    data: { status: 'rejected' }
  })

  // Audit Log
  await prisma.securityEvent.create({
    data: {
      event: 'PAYMENT_REJECTED',
      userId: user.id,
      details: {
        paymentId: id,
        amount: payment.amount,
        targetUserId: payment.userId
      }
    }
  })

  logger.info('AUDIT', `Payment rejected: ${id} by admin ${user.id}`, {
    paymentId: id,
    adminUserId: user.id
  })

  return payment
}))
