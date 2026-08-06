import {
  dominantSecurityBand,
  resolveSystemGeo,
  type SecurityBand,
} from '@/lib/mining-system-geo'

type MiningLogLike = {
  solarSystemId?: number
  estimatedValue?: number
  value?: number
  volumeValue?: number
  quantity?: number
  regionId?: number
  regionName?: string
  constellationId?: number
  constellationName?: string
  security?: number
  securityBand?: string
}

export type MiningGeoBreakdowns = {
  logs: MiningLogLike[]
  systemBreakdown: Record<
    number,
    {
      solarSystemId: number
      name: string
      regionId: number
      regionName: string
      constellationId?: number
      constellationName?: string
      isk: number
      m3: number
      quantity: number
    }
  >
  regionBreakdown: Record<
    number,
    {
      regionId: number
      regionName: string
      isk: number
      m3: number
      quantity: number
      systemCount: number
    }
  >
  dominantSystemId: number | null
  dominantRegionId: number | null
  derivedSpace: SecurityBand | null
}

export async function enrichMiningLogsWithGeo(
  logs: MiningLogLike[]
): Promise<MiningGeoBreakdowns> {
  const systemIds = [
    ...new Set(
      logs
        .map((log) => Number(log.solarSystemId))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ]
  const geoMap = await resolveSystemGeo(systemIds)

  const systemBreakdown: MiningGeoBreakdowns['systemBreakdown'] = {}
  const regionBreakdownInternal = new Map<
    number,
    {
      regionId: number
      regionName: string
      isk: number
      m3: number
      quantity: number
      systems: Set<number>
    }
  >()

  for (const log of logs) {
    const sysId = Number(log.solarSystemId)
    if (!sysId || sysId <= 0) continue

    const geo = geoMap[sysId]
    if (geo) {
      log.regionId = geo.regionId
      log.regionName = geo.regionName
      log.constellationId = geo.constellationId
      log.constellationName = geo.constellationName
      log.security = geo.security
      log.securityBand = geo.securityBand
    }

    const logIsk = Number(log.estimatedValue ?? log.value) || 0
    const logM3 = Number(log.volumeValue) || 0
    const logQty = Number(log.quantity) || 0

    const sysRow = systemBreakdown[sysId] ?? {
      solarSystemId: sysId,
      name: geo?.systemName ?? `System ${sysId}`,
      regionId: geo?.regionId ?? 0,
      regionName: geo?.regionName ?? 'Unknown',
      constellationId: geo?.constellationId ?? 0,
      constellationName: geo?.constellationName ?? undefined,
      isk: 0,
      m3: 0,
      quantity: 0,
    }
    sysRow.isk += logIsk
    sysRow.m3 += logM3
    sysRow.quantity += logQty
    if (geo?.constellationId) {
      sysRow.constellationId = geo.constellationId
      sysRow.constellationName = geo.constellationName
    }
    systemBreakdown[sysId] = sysRow

    const regionId = geo?.regionId ?? 0
    if (regionId > 0) {
      const regRow = regionBreakdownInternal.get(regionId) ?? {
        regionId,
        regionName: geo?.regionName ?? `Region ${regionId}`,
        isk: 0,
        m3: 0,
        quantity: 0,
        systems: new Set<number>(),
      }
      regRow.isk += logIsk
      regRow.m3 += logM3
      regRow.quantity += logQty
      regRow.systems.add(sysId)
      regionBreakdownInternal.set(regionId, regRow)
    }
  }

  const regionBreakdown: MiningGeoBreakdowns['regionBreakdown'] = {}
  for (const [regionId, row] of regionBreakdownInternal) {
    regionBreakdown[regionId] = {
      regionId: row.regionId,
      regionName: row.regionName,
      isk: row.isk,
      m3: row.m3,
      quantity: row.quantity,
      systemCount: row.systems.size,
    }
  }

  const dominantSystemId =
    Object.values(systemBreakdown).sort((a, b) => b.isk - a.isk)[0]?.solarSystemId ?? null
  const dominantRegionId =
    Object.values(regionBreakdown).sort((a, b) => b.isk - a.isk)[0]?.regionId ?? null

  return {
    logs,
    systemBreakdown,
    regionBreakdown,
    dominantSystemId,
    dominantRegionId,
    derivedSpace: dominantSecurityBand(
      logs as Array<{
        securityBand?: SecurityBand
        estimatedValue?: number
        value?: number
      }>
    ),
  }
}
