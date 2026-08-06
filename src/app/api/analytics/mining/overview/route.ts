export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withCache } from '@/lib/cache'
import { queryMiningPersonalOverview } from '@/lib/analytics/mining-personal-overview'

const OVERVIEW_CACHE_TTL = 2 * 60 * 1000

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const daysRaw = Number.parseInt(searchParams.get('days') || '0', 10)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : undefined
  const characterIdRaw = Number.parseInt(searchParams.get('characterId') || '0', 10)
  const characterId =
    Number.isFinite(characterIdRaw) && characterIdRaw > 0 ? characterIdRaw : undefined
  const space = searchParams.get('space') || undefined
  const category = searchParams.get('category') || undefined

  const cacheKey = `mining-overview:${user.id}:${days ?? 'all'}:${characterId ?? 'all'}:${space ?? 'all'}:${category ?? 'all'}`

  const data = await withCache(
    cacheKey,
    () =>
      queryMiningPersonalOverview({
        userId: user.id,
        days,
        characterId,
        space,
        category,
      }),
    OVERVIEW_CACHE_TTL
  )

  return NextResponse.json(data)
})
