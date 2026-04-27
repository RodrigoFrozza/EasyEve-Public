export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

/**
 * GET /api/admin/module-prices - List all module prices
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  const prices = await prisma.modulePrice.findMany({
    orderBy: { module: 'asc' }
  })
  
  return prices
}))

/**
 * POST /api/admin/module-prices - Upsert a module price
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: NextRequest) => {
  const body = await request.json()
  const { module, price, isActive } = body

  if (!module) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Module name required', 400)
  }
  
  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Price must be a positive number', 400)
  }
  
  if (typeof isActive !== 'boolean') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'isActive must be a boolean', 400)
  }

  // Get current price if not provided to avoid resetting it to 0
  const existing = await prisma.modulePrice.findUnique({ where: { module } })
  const finalPrice = price !== undefined ? price : (existing?.price || 0)

  const newPrice = await prisma.modulePrice.upsert({
    where: { module },
    update: { price: finalPrice, isActive },
    create: { module, price: finalPrice, isActive }
  })

  return newPrice
}))
