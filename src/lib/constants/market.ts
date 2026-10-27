import { cn } from '@/lib/utils'

export const ESI_BASE_URL = 'https://esi.evetech.net/latest'
export const USER_AGENT = 'EasyEve/1.0.0 (https://github.com/RodrigoFrozza/EasyEve_)'

export interface RegionOption {
  id: number
  name: string
  hub: string
}

// The 5 major NPC trade hubs. Region IDs + hub names verified against live ESI
// (`/universe/regions/{id}/`) on 2026-07-14 — the previous list had 3 wrong
// entries (Metropolis pointed at Everyshore's id; "The Citadel" was actually
// Sinq Laison/Dodixie; Domain's hub was mislabeled "Tamat" instead of Amarr).
export const REGIONS: RegionOption[] = [
  { id: 10000002, name: 'The Forge', hub: 'Jita' },
  { id: 10000043, name: 'Domain', hub: 'Amarr' },
  { id: 10000032, name: 'Sinq Laison', hub: 'Dodixie' },
  { id: 10000030, name: 'Heimatar', hub: 'Rens' },
  { id: 10000042, name: 'Metropolis', hub: 'Hek' },
]

export const DEFAULT_REGION = REGIONS[0]

/** Jita IV - Moon 4 - Caldari Navy Assembly Plant (standard trade hub reference). */
export const JITA_44_STATION_ID = 60003760

/** NPC trade hubs around Jita used for mining/ore pricing (4-4 + Perimeter). */
export const JITA_TRADE_HUB_LOCATION_IDS: ReadonlySet<number> = new Set([
  JITA_44_STATION_ID,
  60003754, // Perimeter II
  60003755, // Perimeter III
  60003756, // Perimeter IV
  60003757, // Perimeter V
  60003758, // Perimeter VI
  60003759, // Perimeter VII
])

export const JITA_REGION_ID = 10000002

/**
 * The primary trade-hub station of each NPC hub region, so a region's depth can
 * be narrowed to its hub (not skewed by cheap orders in remote stations). Station
 * ids verified against live ESI (`/universe/stations/{id}/`) on 2026-07-15.
 * The Forge maps to the Jita 4-4 + Perimeter set already defined above.
 */
export const HUB_STATIONS_BY_REGION: Record<number, ReadonlySet<number>> = {
  10000002: JITA_TRADE_HUB_LOCATION_IDS, // The Forge → Jita 4-4 (+ Perimeter)
  10000043: new Set([60008494]), // Domain → Amarr VIII (Oris) - Emperor Family Academy
  10000032: new Set([60011866]), // Sinq Laison → Dodixie IX-20 - Federation Navy Assembly Plant
  10000030: new Set([60004588]), // Heimatar → Rens VI-8 - Brutor Tribe Treasury
  10000042: new Set([60005686]), // Metropolis → Hek VIII-12 - Boundless Creation Factory
}

export interface TreeItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  volume?: number
  metaLevel?: number
  metaGroupName?: string
}

export interface MarketGroupNode {
  id: number
  name: string
  description?: string
  parentId: number | null
  children: MarketGroupNode[]
  items: TreeItem[]
}

export interface OldMarketGroupNode {
  id: number
  name: string
  description?: string
  parent_id?: number | null
  children: OldMarketGroupNode[]
  types?: number[]
}

export interface MarketOrder {
  is_buy_order: boolean
  price: number
  volume_remain: number
  volume_total: number
  location_id: number
  location_name?: string
  type_id: number
  order_id: number
  duration: number
  escrow: number
  range: string
  region_id: number
  created_at: string
}

export interface ItemInfo {
  typeId: number
  name: string
  groupId: number
  groupName: string
  categoryId: number
  categoryName: string
  volume?: number
  iconId?: number
  published: boolean
}

export async function fetchWithCache<T>(
  url: string,
  cacheKey: string,
  cacheExpiry: number = 1000 * 60 * 60 * 24
): Promise<T> {
  const { prisma } = await import('@/lib/prisma')
  
  const cached = await prisma.sdeCache.findUnique({
    where: { key: cacheKey }
  })

  const now = new Date()
  if (cached && cached.expiresAt && cached.expiresAt > now) {
    return cached.value as T
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const data = await response.json()

  if (cacheKey) {
    await prisma.sdeCache.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        value: data,
        expiresAt: new Date(now.getTime() + cacheExpiry)
      },
      update: {
        value: data,
        expiresAt: new Date(now.getTime() + cacheExpiry)
      }
    })
  }

  return data as T
}