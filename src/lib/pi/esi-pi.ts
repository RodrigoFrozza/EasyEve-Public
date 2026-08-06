import { fetchWithAuth } from '@/lib/esi'
import { logger } from '@/lib/server-logger'
import type { PiColonyLayout, PiColonySummary } from '@/lib/pi/types'
import { withCache } from '@/lib/cache'
import { piColoniesCachePrefixForUser } from '@/lib/pi/cache-keys'

// The planets list only changes when the player views a colony in-game, so it can
// be cached generously. This bounds how fast in-game changes are auto-detected
// (≤60 min); the manual refresh button always fetches immediately.
const ESI_PI_CACHE_TTL = 60 * 60 * 1000 // Cache planets lists (and un-keyed layouts) for 60 minutes
// A colony layout is immutable for a given `last_update` — ESI only advances that
// timestamp when the player views the colony in-game. Keying the layout cache by
// it lets us keep the layout for a long time and re-fetch ONLY when it changed.
const LAYOUT_BY_UPDATE_TTL = 24 * 60 * 60 * 1000 // 24h

type FetchOptions = {
  forceRefresh?: boolean
}

export async function getCharacterPlanets(
  characterId: number,
  userId?: string,
  options?: FetchOptions
): Promise<PiColonySummary[]> {
  const fetchFn = async () => {
    try {
      const data = await fetchWithAuth<PiColonySummary[]>(
        `/characters/${characterId}/planets/`,
        characterId
      )
      return Array.isArray(data) ? data : []
    } catch (error) {
      logger.error('PI', `Failed to fetch planets for character ${characterId}`, error)
      throw error
    }
  }

  if (userId && !options?.forceRefresh) {
    const cacheKey = `${piColoniesCachePrefixForUser(userId)}planets:${characterId}`
    return withCache(cacheKey, fetchFn, ESI_PI_CACHE_TTL)
  }

  return fetchFn()
}

export async function getColonyLayout(
  characterId: number,
  planetId: number,
  userId?: string,
  options?: FetchOptions,
  lastUpdate?: string
): Promise<PiColonyLayout | null> {
  const fetchFn = async () => {
    try {
      const data = await fetchWithAuth<PiColonyLayout>(
        `/characters/${characterId}/planets/${planetId}/`,
        characterId
      )
      if (!data || !Array.isArray(data.pins)) return null
      return {
        pins: data.pins ?? [],
        routes: data.routes ?? [],
        links: data.links ?? [],
      }
    } catch (error) {
      logger.error('PI', `Failed to fetch colony layout ${planetId} for ${characterId}`, error)
      throw error
    }
  }

  if (userId && !options?.forceRefresh) {
    const base = `${piColoniesCachePrefixForUser(userId)}layout:${characterId}:${planetId}`
    // When we know the colony's last_update, key the cache by it: the layout for a
    // given timestamp never changes, so it stays cached (24h) and is re-fetched
    // only once the planets list reports a newer last_update. Without it, fall back
    // to the plain 30-min TTL.
    const cacheKey = lastUpdate ? `${base}:${lastUpdate}` : base
    const ttl = lastUpdate ? LAYOUT_BY_UPDATE_TTL : ESI_PI_CACHE_TTL
    return withCache(cacheKey, fetchFn, ttl)
  }

  return fetchFn()
}
