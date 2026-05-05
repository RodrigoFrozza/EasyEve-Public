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
export async function getMiningTypes(miningType: 'Ore' | 'Ice' | 'Gas' | 'Moon'): Promise<{ id: number; name: string; volume: number }[]> {
  try {
    // Normalize miningType for matching
    const type = miningType.charAt(0).toUpperCase() + miningType.slice(1).toLowerCase()

    const filters: any = {
      published: true, // Only show published items
      AND: [
        { name: { not: { contains: 'Booster' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Blueprint' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Skin' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Apparel' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Reaction' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Interface' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Data' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Rookie' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Relic' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Formula' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Compressed' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Crystal' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Processing' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Module' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Stabilizer' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Compensation' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Core' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Rig' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Charge' }, mode: 'insensitive' } },
        { name: { not: { contains: 'UNUSED' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Asteroid Set' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Quantum' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Upwell' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Crate' }, mode: 'insensitive' } },
        { name: { not: { contains: 'CreoDron' }, mode: 'insensitive' } },
        { name: { not: { contains: 'Integrated' }, mode: 'insensitive' } }
      ]
    }

    switch (type) {
      case 'Ore':
        // Category 25 = Asteroid.
        // Specific groups for standard ores (excluding ships 25-33)
        filters.AND.push({
          group: { categoryId: 25 },
          OR: [
            { group: { id: { in: [18, 19, 20, 21, 22, 23, 467, 468, 469, 470, 513, 571] } } },
            { name: { contains: 'Veldspar', mode: 'insensitive' } },
            { name: { contains: 'Scordite', mode: 'insensitive' } },
            { name: { contains: 'Pyroxeres', mode: 'insensitive' } },
            { name: { contains: 'Plagioclase', mode: 'insensitive' } },
            { name: { contains: 'Kernite', mode: 'insensitive' } },
            { name: { contains: 'Omber', mode: 'insensitive' } },
            { name: { contains: 'Hedbergite', mode: 'insensitive' } },
            { name: { contains: 'Hemorphite', mode: 'insensitive' } },
            { name: { contains: 'Jaspet', mode: 'insensitive' } },
            { name: { contains: 'Gneiss', mode: 'insensitive' } },
            { name: { contains: 'Dark Ochre', mode: 'insensitive' } },
            { name: { contains: 'Spodumain', mode: 'insensitive' } },
            { name: { contains: 'Crokite', mode: 'insensitive' } },
            { name: { contains: 'Bistot', mode: 'insensitive' } },
            { name: { contains: 'Arkonor', mode: 'insensitive' } },
            { name: { contains: 'Mercoxit', mode: 'insensitive' } },
            { name: { contains: 'Bezdnacine', mode: 'insensitive' } },
            { name: { contains: 'Rakovene', mode: 'insensitive' } },
            { name: { contains: 'Talassonite', mode: 'insensitive' } }
          ]
        })
        break
      case 'Ice':
        // Category 25 = Asteroid, Group 465 = Ice Asteroid, 903 = Ancient Compressed Ice
        filters.AND.push({
          group: { categoryId: 25 },
          OR: [
            { group: { id: { in: [465, 903] } } },
            { name: { equals: 'Blue Ice' } },
            { name: { equals: 'Clear Icicle' } },
            { name: { equals: 'Glacial Mass' } },
            { name: { equals: 'White Glaze' } },
            { name: { equals: 'Dark Glitter' } },
            { name: { equals: 'Gelidus' } },
            { name: { equals: 'Krystallos' } },
            { name: { equals: 'Enriched Clear Icicle' } }
          ]
        })
        break
      case 'Gas':
        // Gas items: Harvestable Cloud (711), Gas Clouds (712), Gas Cloud Materials (713), Gas Isotopes (422)
        // Usually Category 18 (Material)
        filters.AND.push({
          group: { categoryId: 18 },
          OR: [
            { group: { id: { in: [711, 712, 713, 422, 1147, 1143] } } },
            { name: { contains: 'Cytoserocin', mode: 'insensitive' } },
            { name: { contains: 'Mykoserocin', mode: 'insensitive' } },
            { name: { contains: 'Fullerite', mode: 'insensitive' } }
          ]
        })
        break
      case 'Moon':
        // Moon raw ores are in Category 25 (Asteroid)
        filters.AND.push({
          group: { categoryId: 25 },
          OR: [
            { group: { id: { in: [1884, 1920, 1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1929, 1930] } } },
            { name: { contains: 'Bitumens', mode: 'insensitive' } },
            { name: { contains: 'Coesite', mode: 'insensitive' } },
            { name: { contains: 'Sylvite', mode: 'insensitive' } },
            { name: { contains: 'Zeolites', mode: 'insensitive' } },
            { name: { contains: 'Cobaltite', mode: 'insensitive' } },
            { name: { contains: 'Scheelite', mode: 'insensitive' } },
            { name: { contains: 'Titanite', mode: 'insensitive' } },
            { name: { contains: 'Vanadinite', mode: 'insensitive' } },
            { name: { contains: 'Chromite', mode: 'insensitive' } },
            { name: { contains: 'Otavite', mode: 'insensitive' } },
            { name: { contains: 'Sperrylite', mode: 'insensitive' } },
            { name: { contains: 'Wolframite', mode: 'insensitive' } },
            { name: { contains: 'Euxenite', mode: 'insensitive' } },
            { name: { contains: 'Loparite', mode: 'insensitive' } },
            { name: { contains: 'Monazite', mode: 'insensitive' } },
            { name: { contains: 'Xenotime', mode: 'insensitive' } },
            { name: { contains: 'Ytterbite', mode: 'insensitive' } },
            { name: { contains: 'Carnotite', mode: 'insensitive' } },
            { name: { contains: 'Cinnabar', mode: 'insensitive' } },
            { name: { contains: 'Pollucite', mode: 'insensitive' } },
            { name: { contains: 'Zircon', mode: 'insensitive' } }
          ]
        })
        break
      default:
        return []
    }

    
    let types = await prisma.eveType.findMany({
      where: filters,
      select: {
        id: true,
        name: true,
        volume: true
      },
      orderBy: { name: 'asc' }
    })

    // Fallback: If no types found with strict group filters, try a name-based search with same global exclusions
    if (types.length === 0) {
      let keywords: string[] = []
      switch (type) {
        case 'Ore':
          keywords = ['Veldspar', 'Scordite', 'Pyroxeres', 'Plagioclase', 'Kernite', 'Omber', 'Hedbergite', 'Hemorphite', 'Jaspet', 'Gneiss', 'Ochre', 'Spodumain', 'Crokite', 'Bistot', 'Arkonor', 'Mercoxit', 'Bezdnacine', 'Rakovene', 'Talassonite']
          break
        case 'Ice':
          keywords = ['Blue Ice', 'Clear Icicle', 'Glacial Mass', 'White Glaze', 'Dark Glitter', 'Gelidus', 'Krystallos', 'Enriched Clear Icicle']
          break
        case 'Gas':
          keywords = ['Cytoserocin', 'Mykoserocin', 'Fullerite', 'Fullerene', 'Isotope', 'Gas']
          break
        case 'Moon':
          keywords = ['Bitumens', 'Coesite', 'Sylvite', 'Zeolites', 'Cobaltite', 'Scheelite', 'Titanite', 'Vanadinite', 'Chromite', 'Otavite', 'Sperrylite', 'Wolframite', 'Euxenite', 'Loparite', 'Monazite', 'Xenotime', 'Ytterbite', 'Carnotite', 'Cinnabar', 'Pollucite', 'Zircon']
          break
      }

      if (keywords.length > 0) {
        types = await prisma.eveType.findMany({
          where: {
            published: true,
            OR: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
            AND: filters.AND // Reuse global exclusions
          },
          select: {
            id: true,
            name: true,
            volume: true
          },
          orderBy: { name: 'asc' },
          take: 200
        })
      }
    }
    
    return types.map(t => ({
      ...t,
      volume: t.volume ?? 0
    }))


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
