export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { deleteCacheByPrefix } from '@/lib/cache'
import { piColoniesCachePrefixForUser } from '@/lib/pi/cache-keys'
import {
  listReferencePrices,
  upsertReferencePrice,
  deleteReferencePrice,
} from '@/lib/pi/reference-prices'
import { getCommodityName } from '@/lib/pi/pi-static-data'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  await assertPlatformModuleActive('pi')

  const prices = await listReferencePrices(user.id)
  return NextResponse.json({
    prices: prices.map((p) => ({ ...p, name: getCommodityName(p.typeId) })),
  })
})

export const PUT = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  await assertPlatformModuleActive('pi')

  const body = (await request.json()) as {
    typeId?: number
    price?: number
    source?: string | null
    confidence?: string | null
  }
  if (!Number.isInteger(body.typeId) || (body.typeId ?? 0) <= 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'typeId is required', 400)
  }
  if (body.price == null || !Number.isFinite(body.price) || body.price < 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'price must be a non-negative number', 400)
  }

  await upsertReferencePrice(user.id, body.typeId!, body.price, body.source, body.confidence)
  await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
  return NextResponse.json({ success: true })
})

export const DELETE = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  await assertPlatformModuleActive('pi')

  const { searchParams } = new URL(request.url)
  const typeId = Number.parseInt(searchParams.get('typeId') ?? '', 10)
  if (!Number.isInteger(typeId) || typeId <= 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'typeId is required', 400)
  }
  await deleteReferencePrice(user.id, typeId)
  await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
  return NextResponse.json({ success: true })
})
