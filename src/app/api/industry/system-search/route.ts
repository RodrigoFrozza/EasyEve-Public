export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { esiClient } from '@/lib/esi-client'
import { getValidAccessToken } from '@/lib/token-manager'
import { logger } from '@/lib/server-logger'
import { resolveSolarSystemNames } from '@/lib/mining-system-names'

const MAX_SEARCH_CHARACTERS = 15
const MAX_RESULTS = 10

/**
 * Search solar systems by name via ESI character search (categories=solar_system).
 * Same reasoning as PI's structure search: this is an authenticated per-character
 * endpoint, so try each of the user's characters in turn until one succeeds
 * (mirrors searchStructuresForCharacter in src/lib/pi/structure-market.ts).
 */
async function searchSystemsForCharacter(
  characterId: number,
  query: string
): Promise<number[]> {
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) return []

  try {
    const res = await esiClient.get(`/characters/${characterId}/search/`, {
      params: { categories: 'solar_system', search: query, strict: false },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const ids: number[] = Array.isArray(res.data?.solar_system)
      ? res.data.solar_system.slice(0, MAX_RESULTS)
      : []
    return ids
  } catch (error) {
    logger.warn('INDUSTRY_SYSTEM_SEARCH', `Solar system search failed for ${characterId} (query="${query}")`, error)
    return []
  }
}

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ systems: [] })

  const characterIds = user.characters.map((c) => c.id)
  let ids: number[] = []
  for (const characterId of characterIds.slice(0, MAX_SEARCH_CHARACTERS)) {
    ids = await searchSystemsForCharacter(characterId, q)
    if (ids.length > 0) break
  }
  if (ids.length === 0) return NextResponse.json({ systems: [] })

  const names = await resolveSolarSystemNames(ids)
  const systems = ids
    .filter((id) => names[id])
    .map((id) => ({ systemId: id, name: names[id] }))

  return NextResponse.json({ systems })
})
