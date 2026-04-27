import { prisma } from '@/lib/prisma'
import { esiClient, ESI_BASE_URL, USER_AGENT } from '@/lib/esi-client'
import { batchPromiseAll } from '@/lib/utils'
import { logger } from '@/lib/server-logger'

export { esiClient, ESI_BASE_URL, USER_AGENT }

export * from './filaments'

export const EVE_IMAGES_URL = 'https://images.evetech.net'

// --- Visual Helpers ---

export function getCharacterPortraitUrl(characterId: number, size: 'tiny' | 'small' | 'medium' | 'large' | 'huge' = 'medium'): string {
  return `${EVE_IMAGES_URL}/characters/${characterId}/portrait?size=${size}`
}

export function getCharacterAvatarUrl(characterId: number): string {
  return `${EVE_IMAGES_URL}/characters/${characterId}/portrait`
}

export function getCorporationLogoUrl(corpId: number, size: 'tiny' | 'small' | 'medium' | 'large' = 'medium'): string {
  return `${EVE_IMAGES_URL}/corporations/${corpId}/logo?size=${size}`
}

export function getAllianceLogoUrl(allianceId: number, size: 'tiny' | 'small' | 'medium' | 'large' = 'medium'): string {
  return `${EVE_IMAGES_URL}/alliances/${allianceId}/logo?size=${size}`
}

export function getTypeRenderUrl(typeId: number, size: number = 128): string {
  return `${EVE_IMAGES_URL}/types/${typeId}/render?size=${size}`
}

export function getTypeIconUrl(typeId: number, size: number = 64): string {
  return `${EVE_IMAGES_URL}/types/${typeId}/icon?size=${size}`
}

// --- Types & Interfaces ---

export interface TypeInfo {
  id: number
  name: string
  group_id?: number
  group_name?: string
  category_id?: number
  category_name?: string
  volume?: number
  packaged_volume?: number
  mass?: number
  description?: string
  published?: boolean
}

export interface SystemInfo {
  system_id: number
  name: string
  security_class?: string
  security_status?: number
  constellation_id?: number
  region_id?: number
}

export interface GroupInfo {
  id: number
  name: string
  category_id?: number
}

export interface CategoryInfo {
  id: number
  name: string
  published?: boolean
}

// --- SDE Lookup Functions ---

const MAX_CACHE_SIZE = 1000
const systemCache = new Map<number, string>()
const systemInfoCache = new Map<number, SystemInfo>()

function setWithLimit<K, V>(cache: Map<K, V>, key: K, value: V) {
  cache.set(key, value)
  if (cache.size > MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
}

/**
 * Get item name by typeId, prioritized from local database.
 */
export async function getTypeName(typeId: number): Promise<string> {
  try {
    const item = await prisma.eveType.findUnique({
      where: { id: typeId },
      select: { name: true }
    })
    if (item) return item.name

    // Fallback to ESI
    const response = await esiClient.get(`/universe/types/${typeId}/`)
    return response.data.name || `Type ${typeId}`
  } catch (error) {
    logger.error('SDE', `Error fetching type name for ${typeId}`, error)
  }
  return `Type ${typeId}`
}

/**
 * Get comprehensive type information.
 */
export async function getTypeInfo(typeId: number): Promise<TypeInfo | null> {
  try {
    const item = await prisma.eveType.findUnique({
      where: { id: typeId },
      include: { 
        group: {
          include: { category: true }
        }
      }
    })

    if (item) {
      return {
        id: item.id,
        name: item.name,
        group_id: item.groupId,
        group_name: item.group?.name,
        category_id: item.group?.categoryId,
        category_name: item.group?.category?.name,
        volume: item.volume ?? undefined,
        description: item.description ?? undefined,
        published: item.published
      }
    }

    // Fallback to ESI
    const response = await esiClient.get(`/universe/types/${typeId}/`)
    const data = response.data
    return {
      id: typeId,
      name: data.name,
      group_id: data.group_id,
      volume: data.volume,
      description: data.description,
      published: data.published
    }
  } catch (error) {
    logger.error('SDE', `Error fetching type info for ${typeId}`, error)
  }
  return null
}

/**
 * Get solar system name, currently using ESI + local cache.
 */
export async function getSolarSystemName(systemId: number): Promise<string> {
  if (!systemId) return 'Unknown System'
  
  if (systemCache.has(systemId)) {
    return systemCache.get(systemId)!
  }

  try {
    const response = await esiClient.get(`/universe/systems/${systemId}/`)
    const data = response.data
    const name = data.name || `System ${systemId}`
    setWithLimit(systemCache, systemId, name)
    return name
  } catch (error) {
    logger.error('SDE', `Error fetching system name for ${systemId}`, error)
  }
  return `System ${systemId}`
}

/**
 * Get comprehensive solar system information.
 */
export async function getSolarSystemInfo(systemId: number): Promise<SystemInfo | null> {
  if (systemInfoCache.has(systemId)) {
    return systemInfoCache.get(systemId)!
  }

  try {
    const response = await esiClient.get(`/universe/systems/${systemId}/`)
    const data = response.data
    const info: SystemInfo = {
      system_id: systemId,
      name: data.name,
      security_class: data.security_class,
      security_status: data.security_status,
      constellation_id: data.constellation_id,
      region_id: data.region_id
    }
    setWithLimit(systemInfoCache, systemId, info)
    return info
  } catch (error) {
    logger.error('SDE', `Error fetching system info for ${systemId}`, error)
  }
  return null
}

/**
 * Get group information.
 */
export async function getGroupInfo(groupId: number): Promise<GroupInfo | null> {
  try {
    const group = await prisma.eveGroup.findUnique({
      where: { id: groupId }
    })
    if (group) {
      return {
        id: group.id,
        name: group.name,
        category_id: group.categoryId
      }
    }
    
    // Fallback ESI would require group endpoint (skipping for brevity as most should be synced)
  } catch (error) {
    logger.error('SDE', `Error fetching group info for ${groupId}`, error)
  }
  return null
}

/**
 * Get category information.
 */
export async function getCategoryInfo(categoryId: number): Promise<CategoryInfo | null> {
  try {
    const category = await prisma.eveCategory.findUnique({
      where: { id: categoryId }
    })
    if (category) {
      return {
        id: category.id,
        name: category.name
      }
    }
  } catch (error) {
    logger.error('SDE', `Error fetching category info for ${categoryId}`, error)
  }
  return null
}

/**
 * Get mining types from the database based on mining category.
 * 'Ore' - All asteroid ores (base + variants)
 * 'Ice' - Ice products
 * 'Gas' - Gas cloud materials  
 * 'Moon' - Moon mining materials
 */
/**
 * Get mining types from the database based on mining category.
 */
export async function getMiningTypes(miningType: 'Ore' | 'Ice' | 'Gas' | 'Moon'): Promise<{ id: number; name: string }[]> {
  try {
    const filters: any = {
      published: true,
    }

    // Map high-level categories to SDE IDs
    switch (miningType) {
      case 'Ore':
        filters.AND = [
          { group: { categoryId: 25 } },
          { name: { not: { contains: 'Booster', mode: 'insensitive' } } }
        ]
        break
      case 'Ice':
        // Category 2 = Celestial, Group 465 = Ice
        filters.groupId = 465
        break
      case 'Gas':
        // Category 4 = Material
        // Groups: 712 (Biochemical), 1032 (Fullerites), etc.
        filters.group = {
          categoryId: 4,
          name: { in: ['Biochemical Material', 'Gas Cloud Harvesting', 'Fullerite'] }
        }
        break
      case 'Moon':
        // Category 4 = Material or 25 = Asteroid (for unprocessed)
        // The current app uses the processed material names (Cadmium, etc.)
        filters.group = {
          categoryId: 4,
          name: { in: ['Moon Materials', 'Processed Moon Materials'] }
        }
        break
    }
    
    const types = await prisma.eveType.findMany({
      where: filters,
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    })
    
    return types
  } catch (error) {
    logger.error('SDE', `Error fetching mining types for ${miningType}`, error)
    return []
  }
}

/**
 * Batch resolve type IDs to names - uses local DB first, falls back to ESI
 */
export async function resolveTypeNames(typeIds: number[]): Promise<Record<number, string>> {
  const uniqueIds = Array.from(new Set(typeIds))
  const result: Record<number, string> = {}
  
  // Try local DB first
  const localTypes = await prisma.eveType.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true }
  })
  
  localTypes.forEach(t => {
    result[t.id] = t.name
  })
  
  // Find missing IDs
  const missingIds = uniqueIds.filter(id => !result[id])
  
  // Fetch missing from ESI in parallel (batched)
  if (missingIds.length > 0) {
    const BATCH_SIZE = 10
    await batchPromiseAll(missingIds, BATCH_SIZE, async (typeId) => {
      try {
        const response = await esiClient.get(`/universe/types/${typeId}/`)
        const data = response.data
        result[typeId] = data.name || `Type ${typeId}`
      } catch {
        result[typeId] = `Type ${typeId}`
      }
    })
  }
  
  return result
}
