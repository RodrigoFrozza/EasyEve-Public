import { getRegionalMarketDepth, type MarketDepth } from '@/lib/market-prices'
import { getStructureMarketDepth } from '@/lib/pi/structure-market'
import { HUB_STATIONS_BY_REGION } from '@/lib/constants/market'
import { filterDepthByLocations } from '@/lib/appraisal/appraise'
import type { IndustryHub } from '@/lib/industry/config-store'

/**
 * Order-book depth for a configured Industry hub (an NPC region narrowed to its
 * trade-hub station, or a private structure). Returns the hub id/name alongside
 * the depth so callers can build a per-hub comparison.
 */
export async function resolveHubDepth(
  hub: IndustryHub,
  characterIds: number[],
  typeIds: number[]
): Promise<{ hubId: string; hubName: string; depth: Record<number, MarketDepth> }> {
  if (hub.kind === 'structure') {
    const depth = await getStructureMarketDepth(hub.id, characterIds, typeIds)
    return { hubId: hub.id, hubName: hub.name, depth }
  }
  const regionId = Number(hub.id)
  const regionDepth = await getRegionalMarketDepth(regionId, typeIds)
  const stations = HUB_STATIONS_BY_REGION[regionId]
  const depth = stations ? filterDepthByLocations(regionDepth, stations) : regionDepth
  return { hubId: hub.id, hubName: hub.name, depth }
}
