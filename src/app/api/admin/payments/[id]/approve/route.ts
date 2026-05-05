export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

/**
 * POST /api/admin/payments/[id]/approve - Manually approve a payment and grant subscription
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params
  const body = await request.json()
  const { allowedActivities = [], months = 1 } = body

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch payment
    const payment = await tx.payment.findUnique({
      where: { id },
      include: { user: true }
    })

    if (!payment) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Payment not found', 404)
    }
    
    if (payment.status === 'approved') {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Payment already approved', 400)
    }

    // 2. Calculate new subscription end
    const currentEnd = payment.user.subscriptionEnd && new Date(payment.user.subscriptionEnd) > new Date()
      ? new Date(payment.user.subscriptionEnd)
      : new Date()
    
    const newEnd = new Date(currentEnd)
    newEnd.setDate(newEnd.getDate() + (30 * months))

    // 3. Update User
    const updatedUser = await tx.user.update({
      where: { id: payment.userId },
      data: {
        subscriptionEnd: newEnd,
        allowedActivities: Array.from(new Set([...payment.user.allowedActivities, ...allowedActivities])),
        isBlocked: false,
        blockReason: null
      }
    })

    // 4. Update Payment
    const updatedPayment = await tx.payment.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        modules: allowedActivities,
        monthsPaid: months
      }
    })

    // 5. Audit Log
    await tx.securityEvent.create({
      data: {
        event: 'PAYMENT_APPROVED',
        userId: user.id,
        details: {
          paymentId: id,
          amount: payment.amount,
          months,
          newSubscriptionEnd: newEnd.toISOString(),
          targetUserId: payment.userId
        }
      }
    })

    logger.info('AUDIT', `Payment approved: ${id} by admin ${user.id}`, {
      paymentId: id,
      amount: payment.amount,
      adminUserId: user.id
    })

    return { user: updatedUser, payment: updatedPayment }
  })

  return { success: true, ...result }
}))
