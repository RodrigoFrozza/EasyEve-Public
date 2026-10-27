export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { searchStructures, structureHasMarket } from '@/lib/pi/structure-market'

// Verifying each candidate's market costs one ESI call, so cap how many we probe.
const MAX_PROBED = 8

/**
 * Structure search for the monitored-station picker, filtered to structures that
 * actually have an active market (at least one order). Same name search as
 * /api/market/structures, then a light per-structure market probe — so the deficit
 * scanner's station list only offers places that really trade.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  if (query.length < 3) return NextResponse.json({ structures: [] })

  const characterIds = user.characters.map((c) => c.id)
  if (characterIds.length === 0) return NextResponse.json({ structures: [] })

  const candidates = (await searchStructures(characterIds, query)).slice(0, MAX_PROBED)
  const withMarket = await Promise.all(
    candidates.map(async (s) => ((await structureHasMarket(s.structureId, characterIds)) ? s : null))
  )

  return NextResponse.json({ structures: withMarket.filter((s): s is (typeof candidates)[number] => s != null) })
})
