export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

/**
 * PUT /api/admin/payments/[id]/link - Link a payment to a user
 */
export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params
  const { userId } = await request.json()

  if (!userId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'User ID is required', 400)
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: { userId }
  })
  
  return payment
}))
