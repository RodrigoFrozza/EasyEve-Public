import { withCache } from '@/lib/cache'
import { esiClient } from '@/lib/esi-client'
import { getSolarSystemInfo } from '@/lib/sde'
import { logger } from '@/lib/server-logger'
import { batchPromiseAll } from '@/lib/utils'

const POCHVEN_REGION_ID = 10000070
const WORMHOLE_REGION_MIN = 11000000
const WORMHOLE_REGION_MAX = 11999999

export type SecurityBand = 'Highsec' | 'Lowsec' | 'Nullsec' | 'Wormhole' | 'Pochven'

export type SystemGeoInfo = {
  systemId: number
  systemName: string
  regionId: number
  regionName: string
  constellationId: number
  constellationName: string
  security: number
  securityBand: SecurityBand
}

const geoCache = new Map<number, SystemGeoInfo>()
const CACHE_MAX = 5000
const GEO_RESOLVE_CONCURRENCY = 8

function cacheSet(id: number, info: SystemGeoInfo): void {
  if (geoCache.size >= CACHE_MAX) {
    const firstKey = geoCache.keys().next().value
    if (firstKey !== undefined) geoCache.delete(firstKey)
  }
  geoCache.set(id, info)
}

export function deriveSecurityBand(
  securityStatus: number,
  regionId: number
): SecurityBand {
  if (regionId === POCHVEN_REGION_ID) return 'Pochven'
  if (regionId >= WORMHOLE_REGION_MIN && regionId <= WORMHOLE_REGION_MAX) {
    return 'Wormhole'
  }
  if (securityStatus >= 0.45) return 'Highsec'
  if (securityStatus > 0) return 'Lowsec'
  return 'Nullsec'
}

async function resolveEntityNames(
  ids: number[]
): Promise<Record<number, string>> {
  const unique = [...new Set(ids.filter((id) => id > 0))].slice(0, 1000)
  if (unique.length === 0) return {}

  try {
    const response = await esiClient.post('/universe/names/', unique)
    const namesData = response.data as Array<{
      id: number
      name: string
      category: string
    }>
    const result: Record<number, string> = {}
    for (const item of namesData) {
      result[item.id] = item.name
    }
    return result
  } catch (error) {
    logger.error('MINING-GEO', 'Failed batch name resolve', error)
    return {}
  }
}

async function fetchSystemGeo(systemId: number): Promise<SystemGeoInfo | null> {
  if (!systemId || systemId <= 0) return null

  const cached = geoCache.get(systemId)
  if (cached) return cached

  const cacheKey = `mining:system-geo:${systemId}`
  return withCache(cacheKey, async () => {
    const info = await getSolarSystemInfo(systemId)
    if (!info) return null

    const nameIds = [systemId, info.region_id, info.constellation_id].filter(
      (id): id is number => typeof id === 'number' && id > 0
    )
    const names = await resolveEntityNames(nameIds)

    const security = info.security_status ?? 0
    const regionId = info.region_id ?? 0
    const geo: SystemGeoInfo = {
      systemId,
      systemName: names[systemId] ?? info.name ?? `System ${systemId}`,
      regionId,
      regionName: names[regionId] ?? `Region ${regionId}`,
      constellationId: info.constellation_id ?? 0,
      constellationName:
        names[info.constellation_id ?? 0] ??
        `Constellation ${info.constellation_id ?? 0}`,
      security,
      securityBand: deriveSecurityBand(security, regionId),
    }

    cacheSet(systemId, geo)
    return geo
  }, 60 * 60 * 24 * 7)
}

/**
 * Batch-resolve solar system geography (region, constellation, security band).
 */
export async function resolveSystemGeo(
  systemIds: number[]
): Promise<Record<number, SystemGeoInfo>> {
  const result: Record<number, SystemGeoInfo> = {}
  const unique = [...new Set(systemIds.filter((id) => id > 0))]

  await batchPromiseAll(unique, GEO_RESOLVE_CONCURRENCY, async (systemId) => {
    const geo = await fetchSystemGeo(systemId)
    if (geo) result[systemId] = geo
  })

  return result
}

/**
 * Pick the dominant security band by ISK volume from logs.
 */
export function dominantSecurityBand(
  logs: Array<{ securityBand?: SecurityBand; estimatedValue?: number; value?: number }>
): SecurityBand | null {
  const totals = new Map<SecurityBand, number>()
  for (const log of logs) {
    if (!log.securityBand) continue
    const isk = Number(log.estimatedValue ?? log.value ?? 0)
    totals.set(log.securityBand, (totals.get(log.securityBand) ?? 0) + isk)
  }
  let best: SecurityBand | null = null
  let bestIsk = 0
  for (const [band, isk] of totals) {
    if (isk > bestIsk) {
      bestIsk = isk
      best = band
    }
  }
  return best
}
