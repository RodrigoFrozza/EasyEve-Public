export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { esiClient } from '@/lib/esi-client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

const CACHE_KEY = 'pi_region_list'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // regions rarely change

interface RegionOption {
  id: number
  name: string
}

/**
 * GET /api/pi/regions — the list of EVE market regions (known space) as
 * { id, name }, so the PI home-region picker shows names instead of raw ids.
 * Sourced live from ESI (/universe/regions/ + /universe/names/), cached.
 */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const cached = await prisma.sdeCache.findUnique({ where: { key: CACHE_KEY } })
  if (cached && cached.expiresAt && cached.expiresAt > new Date()) {
    return NextResponse.json({ regions: cached.value as unknown as RegionOption[] })
  }

  try {
    const idsRes = await esiClient.get('/universe/regions/')
    const ids: number[] = (Array.isArray(idsRes.data) ? idsRes.data : []).filter(
      (id: number) => id >= 10000000 && id <= 11000000
    )

    const regions: RegionOption[] = []
    // /universe/names/ accepts up to 1000 ids per call — one call covers all regions.
    const namesRes = await esiClient.post('/universe/names/', ids.slice(0, 1000))
    for (const entry of Array.isArray(namesRes.data) ? namesRes.data : []) {
      if (entry?.category === 'region' && typeof entry.id === 'number') {
        regions.push({ id: entry.id, name: String(entry.name) })
      }
    }
    regions.sort((a, b) => a.name.localeCompare(b.name))

    await prisma.sdeCache.upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, value: regions as unknown as object, expiresAt: new Date(Date.now() + CACHE_TTL) },
      update: { value: regions as unknown as object, expiresAt: new Date(Date.now() + CACHE_TTL) },
    })

    return NextResponse.json({ regions })
  } catch (error) {
    if (cached) {
      logger.warn('PI_REGIONS', 'ESI error, serving expired region cache', error)
      return NextResponse.json({ regions: cached.value as unknown as RegionOption[] })
    }
    logger.error('PI_REGIONS', 'Failed to load regions from ESI', error)
    throw new AppError(ErrorCodes.ESI_ERROR, 'Could not load regions', 502)
  }
})
