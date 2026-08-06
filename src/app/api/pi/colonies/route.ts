export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { deleteCacheByPrefix, withCache } from '@/lib/cache'
import { PI_COLONIES_CACHE_PREFIX, piColoniesCachePrefixForUser } from '@/lib/pi/cache-keys'
import { fetchAndAnalyzePiColonies } from '@/lib/pi/isk-per-hour'
import { normalizePiColoniesResponse } from '@/lib/pi/normalize-response'
import { recordPiDailySnapshot } from '@/lib/pi/portfolio-performance'

// Short TTL so the silent 60s background poll re-simulates buffer countdowns on
// the cached ESI data (no forced ESI fetch). The raw ESI layer (esi-pi) keeps its
// own 30-min TTL, so this re-run reads cached ESI and does not call ESI itself.
const PI_CACHE_TTL = 3 * 60 * 1000

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  await assertPlatformModuleActive('pi')

  const { searchParams } = new URL(request.url)
  const characterIdRaw = Number.parseInt(searchParams.get('characterId') || '0', 10)
  const characterId =
    Number.isFinite(characterIdRaw) && characterIdRaw > 0 ? characterIdRaw : undefined
  const forceRefresh = searchParams.get('refresh') === 'true'

  const cacheKey = `${PI_COLONIES_CACHE_PREFIX}:${user.id}:${characterId ?? 'all'}`

  if (forceRefresh) {
    await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
  }

  const fetchData = () =>
    fetchAndAnalyzePiColonies({
      userId: user.id,
      characters: user.characters.map((c) => ({
        id: c.id,
        name: c.name,
        accessToken: c.accessToken,
      })),
      characterIdFilter: characterId,
      forceRefresh,
    })

  const data = normalizePiColoniesResponse(
    forceRefresh
      ? await fetchData()
      : await withCache(cacheKey, fetchData, PI_CACHE_TTL)
  )

  // Only record the daily snapshot from unfiltered (whole-portfolio) requests with no
  // partial ESI failures — a single-character view or a run where some characters/planets
  // failed to fetch has incomplete totals that would corrupt the history if persisted.
  const hasPartialFailure = data.charactersFailed.length > 0 || data.planetsFailed.length > 0
  if (
    !characterId &&
    !hasPartialFailure &&
    (data.totals.colonyCount > 0 || data.totals.currentNetIskPerHour !== 0)
  ) {
    await recordPiDailySnapshot(
      user.id,
      data.totals.currentNetIskPerHour,
      data.totals.colonyCount
    ).catch(() => undefined)
  }

  return NextResponse.json(data)
})
