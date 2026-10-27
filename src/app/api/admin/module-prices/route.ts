export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  ensurePlatformModuleRows,
  orderPlatformModulesForAdmin,
} from '@/lib/admin/platform-modules-registry'

/**
 * GET /api/admin/module-prices - List platform modules (`ModulePrice` rows, canonical order).
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  await ensurePlatformModuleRows(prisma)
  const rows = await prisma.modulePrice.findMany({
    orderBy: { module: 'asc' },
  })

  return { modules: orderPlatformModulesForAdmin(rows) }
}))

/**
 * POST /api/admin/module-prices - Upsert global module flags (and optional legacy `price`).
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: NextRequest) => {
  await ensurePlatformModuleRows(prisma)

  const body = await request.json()
  const { module, price, isActive } = body

  if (!module) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Module name required', 400)
  }

  if (price !== undefined && (typeof price !== 'number' || price < 0)) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Price must be a non-negative number', 400)
  }

  if (typeof isActive !== 'boolean') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'isActive must be a boolean', 400)
  }

  const existing = await prisma.modulePrice.findUnique({ where: { module } })
  const finalPrice = price !== undefined ? price : (existing?.price ?? 0)

  const row = await prisma.modulePrice.upsert({
    where: { module },
    update: { price: finalPrice, isActive },
    create: { module, price: finalPrice, isActive },
  })

  return row
}))
