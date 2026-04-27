import { cn } from '@/lib/utils'

export const ESI_BASE_URL = 'https://esi.evetech.net/latest'
export const USER_AGENT = 'EasyEve/1.0.0 (https://github.com/RodrigoFrozza/EasyEve_)'

export interface RegionOption {
  id: number
  name: string
  hub: string
}

export const REGIONS: RegionOption[] = [
  { id: 10000002, name: 'The Forge', hub: 'Jita' },
  { id: 10000043, name: 'Domain', hub: 'Tamat' },
  { id: 10000044, name: 'Tash-Murkon', hub: 'Pasha' },
  { id: 10000030, name: 'Heimatar', hub: 'Rens' },
  { id: 10000037, name: 'Metropolis', hub: 'Hek' },
  { id: 10000032, name: 'The Citadel', hub: 'Aldrat' },
  { id: 10000016, name: 'Lonetrek', hub: 'Inama' },
  { id: 10000068, name: 'Verge Vendor', hub: 'Cistuvaert' },
  { id: 10000069, name: 'Black Rise', hub: 'Villasen' },
]

export const DEFAULT_REGION = REGIONS[0]

export interface TreeItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
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