import { esiClient } from '@/lib/esi-client'
import { getSolarSystemName } from '@/lib/sde'
import { logger } from '@/lib/server-logger'

const solarSystemNameCache = new Map<number, string>()
const CACHE_MAX = 5000

function cacheSet(id: number, name: string): void {
  if (solarSystemNameCache.size >= CACHE_MAX) {
    const firstKey = solarSystemNameCache.keys().next().value
    if (firstKey !== undefined) solarSystemNameCache.delete(firstKey)
  }
  solarSystemNameCache.set(id, name)
}

/**
 * Batch-resolve solar system names via ESI /universe/names/ with in-memory cache.
 */
export async function resolveSolarSystemNames(
  systemIds: number[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {}
  const uncached: number[] = []

  for (const id of systemIds) {
    if (!id || id <= 0) continue
    const cached = solarSystemNameCache.get(id)
    if (cached) {
      result[id] = cached
    } else {
      uncached.push(id)
    }
  }

  const uniqueUncached = [...new Set(uncached)].slice(0, 1000)

  if (uniqueUncached.length > 0) {
    try {
      const response = await esiClient.post('/universe/names/', uniqueUncached)
      const namesData = response.data as Array<{
        id: number
        name: string
        category: string
      }>

      for (const item of namesData) {
        if (item.category === 'solar_system') {
          result[item.id] = item.name
          cacheSet(item.id, item.name)
        }
      }
    } catch (error) {
      logger.error('MINING-SYSTEMS', 'Failed batch solar system name resolve', error)
    }

    for (const id of uniqueUncached) {
      if (!result[id]) {
        const name = await getSolarSystemName(id)
        result[id] = name
        cacheSet(id, name)
      }
    }
  }

  return result
}
