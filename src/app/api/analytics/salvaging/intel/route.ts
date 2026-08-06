export const dynamic = 'force-dynamic'

import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { querySalvagingIntel } from '@/lib/analytics/salvaging-intel-query'

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const scopeParam = searchParams.get('scope') || 'global'
  const scope = scopeParam === 'me' ? 'me' : 'global'
  const faction = searchParams.get('faction') || undefined
  const space = searchParams.get('space') || undefined
  const daysRaw = Number.parseInt(searchParams.get('days') || '90', 10)
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 90

  const payload = await querySalvagingIntel({
    scope,
    userId: scope === 'me' ? user.id : undefined,
    faction,
    space,
    days: scope === 'me' ? days : undefined,
  })

  return payload
})
