export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { queryExplorationLootIntel } from '@/lib/analytics/exploration-loot-intel-query'

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') === 'me' ? 'me' : 'global'
  const daysRaw = Number.parseInt(searchParams.get('days') || '90', 10)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 90

  return queryExplorationLootIntel({
    scope,
    userId: scope === 'me' ? user.id : undefined,
    days: scope === 'me' ? days : undefined,
  })
})
