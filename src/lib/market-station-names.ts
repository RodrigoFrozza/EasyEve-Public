import { prisma } from '@/lib/prisma'
import { getStationName } from '@/lib/esi'

const CACHE_PREFIX = 'market_station_name_'
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000 // station names are effectively static
const MAX_CONCURRENT = 10

/**
 * Real station/structure names, resolved from ESI and cached — replaces a
 * previous hardcoded 17-entry lookup table that silently fell back to
 * "Station {id}" for everything else (and had 2 wrong names on top of that).
 *
 * NPC stations (`/universe/stations/{id}/`, via `getStationName`) are public.
 * Player-owned structures (14-digit ids) require docking-access auth the
 * anonymous market browser doesn't have — those resolve to `Structure {id}`
 * without a round trip, since we already know that call would fail.
 */
export async function resolveStationNames(locationIds: number[]): Promise<Record<number, string>> {
  const uniqueIds = Array.from(new Set(locationIds)).filter((id) => Number.isFinite(id) && id > 0)
  const result: Record<number, string> = {}
  if (uniqueIds.length === 0) return result

  const keyFor = (id: number) => `${CACHE_PREFIX}${id}`
  const cached = await prisma.sdeCache.findMany({
    where: { key: { in: uniqueIds.map(keyFor) } },
  })
  const cachedIds = new Set<number>()
  for (const entry of cached) {
    const id = parseInt(entry.key.replace(CACHE_PREFIX, ''), 10)
    if (Number.isFinite(id)) {
      result[id] = entry.value as unknown as string
      cachedIds.add(id)
    }
  }

  const missing = uniqueIds.filter((id) => !cachedIds.has(id))
  if (missing.length === 0) return result

  for (let i = 0; i < missing.length; i += MAX_CONCURRENT) {
    const batch = missing.slice(i, i + MAX_CONCURRENT)
    await Promise.all(
      batch.map(async (id) => {
        // Player structures use 64-bit ids well above the NPC station range —
        // the stations endpoint 404s for them and there's no public way to
        // resolve the name without a docked character's token.
        const isLikelyStructure = id >= 1_000_000_000_000
        const name = isLikelyStructure ? `Structure ${id}` : await getStationName(id)
        result[id] = name
        await prisma.sdeCache.upsert({
          where: { key: keyFor(id) },
          create: { key: keyFor(id), value: name as any, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
          update: { value: name as any, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
        })
      })
    )
  }

  return result
}
