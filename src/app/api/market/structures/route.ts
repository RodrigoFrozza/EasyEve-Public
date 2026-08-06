export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { searchStructures } from '@/lib/pi/structure-market'

/**
 * Search structures the logged-in player can dock at / see, by name — for the
 * Market Browser's "check a private structure's orders" picker. Reuses the
 * same authenticated ESI search as the PI module's structure price source
 * (docking/market access is per-character, not tied to any one feature).
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  if (query.length < 3) {
    return NextResponse.json({ structures: [] })
  }

  const characterIds = user.characters.map((c) => c.id)
  if (characterIds.length === 0) {
    return NextResponse.json({ structures: [] })
  }

  const structures = await searchStructures(characterIds, query)
  return NextResponse.json({ structures })
})
