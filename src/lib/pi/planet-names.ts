import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'

// Celestial names are static game data — cache indefinitely, no TTL. Not
// negative-cached: a fetch failure (network blip, transient 5xx) should be
// retried next call rather than permanently masking a real name.
const planetNameCache = new Map<number, string>()
const CACHE_MAX = 5000

function cacheSet(id: number, name: string): void {
  if (planetNameCache.size >= CACHE_MAX) {
    const firstKey = planetNameCache.keys().next().value
    if (firstKey !== undefined) planetNameCache.delete(firstKey)
  }
  planetNameCache.set(id, name)
}

/**
 * Resolve planet celestial names via ESI /universe/planets/{planet_id}/.
 *
 * Deliberately NOT /universe/names/ (the batch resolver used for systems,
 * structures, etc.) — confirmed live against ESI that the batch endpoint does
 * not support the "planet" category at all: any planet_id in that request
 * makes the whole call fail with "Ensure all IDs are valid before
 * resolving.". That silently produced zero names forever, so every caller's
 * fallback (solar system name) was the only thing ever shown, in production,
 * for as long as this function existed. One GET per uncached planet id is the
 * only way to actually get the name.
 *
 * Ids ESI can't resolve are simply absent from the result (never a
 * "Planet 4001234" placeholder) — callers should fall back to something a
 * player recognizes, e.g. the solar system name, not a raw id.
 */
export async function resolvePlanetNames(
  planetIds: number[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {}
  const uncached: number[] = []

  for (const id of planetIds) {
    if (!id || id <= 0) continue
    const cached = planetNameCache.get(id)
    if (cached) {
      result[id] = cached
    } else {
      uncached.push(id)
    }
  }

  const uniqueUncached = [...new Set(uncached)]

  await Promise.all(
    uniqueUncached.map(async (id) => {
      try {
        const response = await esiClient.get(`/universe/planets/${id}/`)
        const name = response.data?.name
        if (name) {
          result[id] = name
          cacheSet(id, name)
        }
      } catch (error) {
        logger.error('PI', `Failed to resolve planet name for ${id}`, error)
      }
    })
  )

  return result
}
