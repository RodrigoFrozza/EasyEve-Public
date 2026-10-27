export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

/**
 * PUT /api/admin/payments/[id]/link - Link a payment to a user
 */
export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params
  const body = await request.json()

  // The admin UI sends the account code the player shows in-app (EVE-XXXXXX);
  // a raw userId is still accepted for scripts/tools.
  let newUserId: string | undefined = body.userId
  if (!newUserId && typeof body.accountCode === 'string' && body.accountCode.trim()) {
    const target = await prisma.user.findUnique({
      where: { accountCode: body.accountCode.trim().toUpperCase() },
      select: { id: true },
    })
    if (!target) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, `No user with account code ${body.accountCode}`, 404)
    }
    newUserId = target.id
  }

  if (!newUserId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'User ID or account code is required', 400)
  }

  const payment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Payment not found', 404)
    }

    const oldUserId = existing.userId

    // Only a 'pending' payment still has a live balance credit to move. 'approved'
    // already consumed it (converted to subscription days) and 'rejected' already
    // reversed it — moving ISK for those would create phantom/negative balance.
    // Clamp to the old user's balance so the move can't drive it negative.
    if (oldUserId !== newUserId && existing.status === 'pending') {
      const oldUser = await tx.user.findUnique({
        where: { id: oldUserId },
        select: { iskBalance: true },
      })
      const moved = Math.min(oldUser?.iskBalance ?? 0, existing.amount)
      if (moved < existing.amount) {
        logger.warn('AUDIT', `Relink of payment ${id}: old user balance (${oldUser?.iskBalance ?? 0}) below amount (${existing.amount}); moved ${moved}`, { paymentId: id })
      }

      await tx.user.update({
        where: { id: oldUserId },
        data: { iskBalance: { decrement: moved } }
      })
      await tx.iskHistory.create({
        data: {
          userId: oldUserId,
          amount: -moved,
          type: 'payment_relink_out',
          reference: existing.id,
        }
      })

      await tx.user.update({
        where: { id: newUserId },
        data: { iskBalance: { increment: moved } }
      })
      await tx.iskHistory.create({
        data: {
          userId: newUserId,
          amount: moved,
          type: 'payment_relink_in',
          reference: existing.id,
        }
      })
    }

    // Linking is the review: the payment now belongs to a real user.
    return tx.payment.update({
      where: { id },
      data: { userId: newUserId, needsReview: false }
    })
  })

  await prisma.securityEvent.create({
    data: {
      event: 'PAYMENT_RELINKED',
      userId: user.id,
      details: {
        paymentId: id,
        amount: payment.amount,
        newUserId,
      }
    }
  })

  return payment
}))
