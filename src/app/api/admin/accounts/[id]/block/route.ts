export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { z } from 'zod'

const blockAccountSchema = z.object({
  isBlocked: z.boolean(),
  blockReason: z.string().max(500).optional().nullable(),
})

export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params

  if (id === user.id) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'You cannot block your own account', 400)
  }

  const body = await request.json().catch(() => ({}))
  const parsed = blockAccountSchema.safeParse(body)
  if (!parsed.success) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid request body', 400)
  }
  const { isBlocked, blockReason } = parsed.data

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isBlocked,
      blockedAt: isBlocked ? new Date() : null,
      blockReason: isBlocked ? blockReason : null
    }
  })

  await prisma.securityEvent.create({
    data: {
      event: isBlocked ? 'ADMIN_ACCOUNT_BLOCKED' : 'ADMIN_ACCOUNT_UNBLOCKED',
      userId: user.id,
      path: `/api/admin/accounts/${id}/block`,
      details: { targetUserId: id, blockReason: isBlocked ? blockReason ?? null : null },
    },
  })

  return updatedUser
}))
