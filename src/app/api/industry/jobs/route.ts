export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getUserIndustryJobs } from '@/lib/industry/industry-jobs'

/**
 * Multi-character Industry Jobs dashboard. POST (not GET) so the client can pass
 * `forceRefresh` cleanly, consistent with the other industry endpoints
 * (e.g. /api/industry/deficits).
 */
export const POST = withErrorHandling(async (req: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  let forceRefresh = false
  try {
    const body = await req.json()
    forceRefresh = body?.forceRefresh === true
  } catch {
    // No/empty body is fine — forceRefresh defaults to false.
  }

  const characterIds = user.characters.map((c) => c.id)
  const result = await getUserIndustryJobs(user.id, characterIds, { forceRefresh })

  return NextResponse.json(result)
})
