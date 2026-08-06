export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { Prisma } from '@prisma/client'

/**
 * POST /api/admin/payments/[id]/approve - Manually approve a payment and grant subscription
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params
  let body: any = {}
  try {
    body = await request.json()
  } catch (e) {
    // Allow empty body
  }
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

    if (payment.status === 'rejected') {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Cannot approve a rejected payment — its ISK credit was already reversed', 400)
    }

    // Lock the user row before the balance read-modify-write (mirrors /subscribe).
    await tx.$executeRaw(Prisma.sql`SELECT id FROM "User" WHERE id = ${payment.userId} FOR UPDATE`)
    const lockedUser = await tx.user.findUnique({
      where: { id: payment.userId },
      select: { iskBalance: true },
    })
    const currentBalance = lockedUser?.iskBalance ?? 0

    // Approving consumes the ISK this payment credited to the balance at sync
    // time (symmetric with reject's reversal), so the same deposit cannot also be
    // spent again via /subscribe. Clamp to avoid a negative balance if it was
    // already partially spent.
    const debit = Math.min(currentBalance, payment.amount)

    // 2. Calculate new subscription end
    const currentEnd = payment.user.subscriptionEnd && new Date(payment.user.subscriptionEnd) > new Date()
      ? new Date(payment.user.subscriptionEnd)
      : new Date()

    const newEnd = new Date(currentEnd)
    newEnd.setDate(newEnd.getDate() + (30 * months))

    // 3. Update User (extend subscription + consume the payment's ISK credit)
    const updatedUser = await tx.user.update({
      where: { id: payment.userId },
      data: {
        subscriptionEnd: newEnd,
        allowedActivities: Array.from(new Set([...(payment.user.allowedActivities || []), ...allowedActivities])),
        isBlocked: false,
        blockReason: null,
        iskBalance: { decrement: debit },
      }
    })

    if (debit > 0) {
      await tx.iskHistory.create({
        data: {
          userId: payment.userId,
          amount: -debit,
          type: 'subscription',
          reference: payment.id,
        },
      })
    }

    if (debit < payment.amount) {
      logger.warn('AUDIT', `Payment ${id} approved but balance (${currentBalance}) was below amount (${payment.amount}); debited ${debit}`, { paymentId: id })
    }

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
