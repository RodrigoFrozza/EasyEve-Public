export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'

export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (
  request: any,
  user: any,
  { params }: { params: { id: string } }
) => {
  const { id } = params
  const body = await request.json()
  const { isBlocked, blockReason } = body

  const updatedUser = await prisma.user.update({
    where: { id },
    data: {
      isBlocked,
      blockedAt: isBlocked ? new Date() : null,
      blockReason: isBlocked ? blockReason : null
    }
  })

  return updatedUser
}))
