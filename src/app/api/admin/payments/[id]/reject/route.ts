export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
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

  const payment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Payment not found', 404)
    }
    if (existing.status === 'rejected') {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Payment already rejected', 400)
    }
    if (existing.status === 'approved') {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Cannot reject an approved payment', 400)
    }

    const updated = await tx.payment.update({
      where: { id },
      data: { status: 'rejected' }
    })

    // The wallet-journal sync credits iskBalance immediately at ingestion time (status
    // starts 'pending') — rejecting must reverse that credit, otherwise the user keeps
    // ISK for a payment the admin has determined is invalid. Clamp so the balance
    // can't go negative if the user already spent part of it via /subscribe.
    const balUser = await tx.user.findUnique({
      where: { id: updated.userId },
      select: { iskBalance: true },
    })
    const debit = Math.min(balUser?.iskBalance ?? 0, updated.amount)
    await tx.user.update({
      where: { id: updated.userId },
      data: { iskBalance: { decrement: debit } }
    })
    await tx.iskHistory.create({
      data: {
        userId: updated.userId,
        amount: -debit,
        type: 'payment_reversal',
        reference: updated.id,
      }
    })
    if (debit < updated.amount) {
      logger.warn('AUDIT', `Payment ${id} rejected but balance (${balUser?.iskBalance ?? 0}) was below amount (${updated.amount}); reversed ${debit}`, { paymentId: id })
    }

    return updated
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
