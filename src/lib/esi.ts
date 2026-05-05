import {
  getTypeName,
  getSolarSystemName,
  getTypeInfo,
  getSolarSystemInfo,
  getGroupInfo,
  getCategoryInfo,
  getCharacterPortraitUrl,
  getCharacterAvatarUrl,
  getCorporationLogoUrl,
  getAllianceLogoUrl,
  getTypeRenderUrl,
  getTypeIconUrl,
} from './sde'

import { withCache } from '@/lib/cache'
import { logger } from '@/lib/server-logger'
import { esiClient, USER_AGENT } from './esi-client'
import { 
  EsiCharacter, 
  EveCharacter,
  TypeDetails,
  CharacterPublicInfo, 
  CharacterSkills, 
  CharacterLocationSchema,
  CharacterShipSchema,
  WalletJournalSchema,
  EsiCharacterSchema,
  WalletJournal,
  CharacterPublicInfoSchema
} from '../types/esi'
import { AppError } from './app-error'
import { ErrorCodes } from './error-codes'

export {
  getTypeName,
  getSolarSystemName,
  getTypeInfo,
  getSolarSystemInfo,
  getGroupInfo,
  getCategoryInfo,
  getCharacterPortraitUrl,
  getCharacterAvatarUrl,
  getCorporationLogoUrl,
  getAllianceLogoUrl,
  getTypeRenderUrl,
  getTypeIconUrl,
} from './sde'

export * from './sde'

const EVE_SSO_BASE_URL = 'https://login.eveonline.com/v2/oauth'
import axios from 'axios'
import { getValidAccessToken } from './token-manager'

const ASSET_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

const assetCache: Map<number, { data: unknown[]; timestamp: number }> = new Map()

function getCachedAssets(characterId: number): unknown[] | null {
  const cached = assetCache.get(characterId)
  if (cached && Date.now() - cached.timestamp < ASSET_CACHE_TTL) {
    logger.info('ESI', `Using cached assets for character ${characterId}`)
    return cached.data as unknown[]
  }
  return null
}

function setCachedAssets(characterId: number, data: unknown[]) {
  assetCache.set(characterId, { data, timestamp: Date.now() })
}

export type { EveCharacter as EveCharacterLegacy } from '../types/esi'

export async function getAccessToken(code: string, esiApp: string = 'main') {
  const clientId = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_ID : process.env.EVE_CLIENT_ID
  const clientSecret = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_SECRET : process.env.EVE_CLIENT_SECRET

  const response = await axios.post(`${EVE_SSO_BASE_URL}/token`, 
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')}`,
      },
    }
  )

  return response.data
}

export async function getCharacterInfo(accessToken: string): Promise<EveCharacter> {
  logger.info('ESI', 'Verifying token (JWT decode)...')
  
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) {
      throw new Error('Access token is not a valid JWT')
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    )

    const subParts = (payload.sub as string).split(':')
    const characterId = parseInt(subParts[2], 10)

    if (isNaN(characterId)) {
      throw new Error(`Invalid character ID in JWT sub claim: ${payload.sub}`)
    }

    const characterName = payload.name as string
    logger.info('ESI', `Character verified via JWT: ${characterName} (ID: ${characterId})`)

    const charData = {
      character_id: characterId,
      character_name: characterName,
      expires_on: payload.exp ? new Date(payload.exp * 1000).toISOString() : '',
      scopes: (payload.scp as string[] | string)
        ? (Array.isArray(payload.scp) ? payload.scp.join(' ') : payload.scp as string)
        : '',
      token_type: 'Character',
      character_owner_hash: payload.owner as string || '',
      intellectual_property: payload.kid as string || '',
    }

    return EsiCharacterSchema.parse(charData)
  } catch (error) {
    logger.error('ESI', 'JWT decode failed', error)
    throw new Error(`Failed to verify token: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export interface FetchCharacterDataResult {
  name?: string
  total_sp?: number
  wallet?: number
  location?: string
  ship?: string
  shipTypeId?: number
  corporationId?: number
}

export async function fetchCharacterData(characterId: number, accessToken: string): Promise<FetchCharacterDataResult> {
  const [info, location, ship, wallet, skills] = await Promise.all([
    getCharacterPublicInfo(characterId),
    getCharacterLocation(characterId, accessToken),
    getCharacterShip(characterId, accessToken),
    getCharacterWallet(characterId, accessToken),
    getCharacterSkillsSummary(characterId, accessToken),
  ])

  return {
    name: info.name,
    total_sp: skills.total_sp,
    wallet,
    location: location.location,
    ship: ship.ship,
    shipTypeId: ship.shipTypeId,
    corporationId: info.corporation_id,
  }
}

async function getCharacterSkillsSummary(characterId: number, accessToken: string): Promise<{ total_sp?: number }> {
  const cacheKey = `skills-summary-${characterId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/characters/${characterId}/skills/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return { total_sp: response.data.total_sp }
    } catch (error) {
      logger.error('ESI', `Failed to fetch skills summary for ${characterId}`, error)
      return {}
    }
  }, 600000) // 10 minutes cache
}

async function getCharacterPublicInfo(characterId: number): Promise<CharacterPublicInfo> {
  const cacheKey = `char-public-${characterId}`
  
  return withCache(cacheKey, async () => {
    const response = await esiClient.get(`/characters/${characterId}/`)
    return CharacterPublicInfoSchema.parse(response.data)
  }, 3600000) // 1 hour cache
}

export interface CharacterLocationResult {
  location?: string
  station_id?: number
  structure_id?: number
  solar_system_id?: number
  error?: string
  status?: number
}

export async function getCharacterLocation(characterId: number, accessToken: string): Promise<CharacterLocationResult> {
  try {
    const response = await esiClient.get(`/characters/${characterId}/location/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = response.data
    if (!data.solar_system_id) {
      return {
        location: 'Unknown Location',
        station_id: data.station_id,
        structure_id: data.structure_id,
        solar_system_id: 0
      }
    }

    const solarSystemName = await getSolarSystemName(data.solar_system_id)
    
    return {
      location: solarSystemName,
      station_id: data.station_id,
      structure_id: data.structure_id,
      solar_system_id: data.solar_system_id
    }
  } catch (error: any) {
    logger.error('ESI', `Failed to fetch location for character ${characterId}`, error)
    return {
      error: error?.response?.status === 403 ? 'Missing required scope: esi-location.read_location.v1' : 
             error?.response?.status === 401 ? 'Unauthorized/Invalid token' :
             error?.message || 'Unknown ESI error',
      status: error?.response?.status || (error?.statusCode) || 500
    }
  }
}

export interface CharacterShipResult {
  ship?: string
  shipTypeId?: number
}

export async function getCharacterShip(characterId: number, accessToken: string): Promise<CharacterShipResult> {
  try {
    const response = await esiClient.get(`/characters/${characterId}/ship/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = response.data
    const shipName = await getTypeName(data.ship_type_id)
    
    return {
      ship: shipName,
      shipTypeId: data.ship_type_id,
    }
  } catch (error) {
    logger.error('ESI', `Failed to fetch ship for character ${characterId}`, error)
    return {}
  }
}

async function getCharacterWallet(characterId: number, accessToken: string): Promise<number> {
  try {
    const response = await esiClient.get(`/characters/${characterId}/wallet/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return Number(response.data)
  } catch (error) {
    logger.error('ESI', `Failed to fetch wallet for character ${characterId}`, error)
    return 0
  }
}

export async function getCharacterSkills(characterId: number, accessToken: string): Promise<CharacterSkills> {
  const [skillsResponse, queueResponse] = await Promise.all([
    esiClient.get(`/characters/${characterId}/skills/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    esiClient.get(`/characters/${characterId}/skillqueue/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ])

  const skills = skillsResponse.data
  const queue = queueResponse.data

  return {
    total_sp: skills.total_sp,
    free_sp: skills.free_points,
    skills: skills.skills || [],
    queues: queue || [],
  }
}

export async function getCorporationInfo(corpId: number) {
  const cacheKey = `corp-info-${corpId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/corporations/${corpId}/`)
      const data = response.data
      return {
        name: data.name,
        ticker: data.ticker,
        alliance_id: data.alliance_id,
      }
    } catch (error) {
      logger.error('ESI', `Failed to fetch corp info for ${corpId}`, error)
      return { name: `Corp ${corpId}` }
    }
  }, 86400000) // 24 hours cache
}

export async function getAllianceInfo(allianceId: number) {
  const cacheKey = `alliance-info-${allianceId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/alliances/${allianceId}/`)
      const data = response.data
      return { name: data.name, ticker: data.ticker }
    } catch (error) {
      logger.error('ESI', `Failed to fetch alliance info for ${allianceId}`, error)
      return { name: `Alliance ${allianceId}` }
    }
  }, 86400000) // 24 hours cache
}

export interface MiningLedgerEntry {
  date: string
  quantity: number
  type_id: number
  corporation_id: number
}

export async function getCharacterMiningLedger(
  characterId: number,
  accessToken: string
): Promise<MiningLedgerEntry[] | null> {
  try {
    const response = await esiClient.get(`/characters/${characterId}/mining/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    return response.data
  } catch (error) {
    logger.error('ESI', `Failed to fetch mining ledger for character ${characterId}`, error)
    return null
  }
}

export async function getCategoryGroups(categoryId: number): Promise<number[]> {
  const cacheKey = `cat-groups-${categoryId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/universe/categories/${categoryId}/`)
      return response.data.groups || []
    } catch (error) {
      logger.error('ESI', `Failed to fetch category groups for ${categoryId}`, error)
      return []
    }
  }, 86400000)
}

export async function getGroupTypes(groupId: number): Promise<number[]> {
  const cacheKey = `group-types-${groupId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/universe/groups/${groupId}/`)
      return response.data.types || []
    } catch (error) {
      logger.error('ESI', `Failed to fetch group types for ${groupId}`, error)
      return []
    }
  }, 86400000)
}

export async function getTypeDetails(typeId: number): Promise<TypeDetails | null> {
  const cacheKey = `type-details-${typeId}`
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get(`/universe/types/${typeId}/`)
      return response.data
    } catch (error) {
      logger.error('ESI', `Failed to fetch type details for ${typeId}`, error)
      return null
    }
  }, 86400000)
}

export interface MarketPrice {
  type_id: number
  average_price?: number
  adjusted_price?: number
}

export async function getMarketPrices(): Promise<Record<number, number>> {
  const cacheKey = 'market-prices-map'
  
  return withCache(cacheKey, async () => {
    try {
      const response = await esiClient.get('/markets/prices/')
      const data: MarketPrice[] = response.data
      
      const priceMap: Record<number, number> = {}
      data.forEach(item => {
        if (item.average_price) {
          priceMap[item.type_id] = item.average_price
        } else if (item.adjusted_price) {
          priceMap[item.type_id] = item.adjusted_price
        }
      })
      
      return priceMap
    } catch (error) {
      logger.error('ESI', 'Failed to fetch market prices', error)
      return {}
    }
  }, 300000) // 5 minutes cache
}

// --- Authenticated ESI Helpers ---

export async function fetchWithAuth<T>(endpoint: string, characterId: number): Promise<T> {
  const { accessToken } = await getValidAccessToken(characterId)
  
  if (!accessToken) {
    logger.warn('ESI', `No access token for character ${characterId}`)
    throw new AppError(ErrorCodes.ESI_NO_TOKEN, 'No valid access token available')
  }
  
  const response = await esiClient.get(endpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-User-Agent': USER_AGENT,
    },
  })

  return response.data as T
}

export async function getCharacterFits(characterId: number) {
  try {
    return await fetchWithAuth(`/characters/${characterId}/fits/`, characterId)
  } catch (error) {
    logger.error('ESI', `Failed to fetch fits for ${characterId}`, error)
    return []
  }
}

export async function getCharacterAssets(characterId: number) {
  const cached = getCachedAssets(characterId)
  if (cached) {
    return cached
  }

  try {
    logger.info('ESI', `Fetching assets for character ${characterId}`)
    
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) {
      logger.warn('ESI', `No access token for character ${characterId}`)
      throw new AppError(ErrorCodes.ESI_NO_TOKEN, 'No valid access token available')
    }

    // First call to get total pages
    const firstResponse = await esiClient.get(`/characters/${characterId}/assets/`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-User-Agent': USER_AGENT,
      },
    })

    const totalPages = parseInt(firstResponse.headers['x-pages'] || '1', 10)
    const allAssets = [...(firstResponse.data || [])]

    logger.info('ESI', `Character ${characterId}: Page 1/${totalPages}, got ${allAssets.length} assets`)

    // Fetch remaining pages in parallel
    if (totalPages > 1) {
      const pageRequests = []
      for (let page = 2; page <= totalPages; page++) {
        pageRequests.push(
          esiClient.get(`/characters/${characterId}/assets/?page=${page}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'X-User-Agent': USER_AGENT,
            },
          }).then(res => res.data)
        )
      }

      const pageResults = await Promise.all(pageRequests)
      for (const pageData of pageResults) {
        allAssets.push(...(pageData || []))
      }
      
      logger.info('ESI', `Character ${characterId}: Total pages ${totalPages}, got ${allAssets.length} assets total`)
    }

    setCachedAssets(characterId, allAssets)
    return allAssets
  } catch (error) {
    logger.error('ESI', `Failed to fetch assets for ${characterId}`, error)
    return []
  }
}

const assetNamesCache: Map<number, Map<number, string>> = new Map()
const ASSET_NAMES_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function getCharacterAssetNames(characterId: number, itemIds: number[]) {
  if (itemIds.length === 0) return []
  
  // Check cache
  let charCache = assetNamesCache.get(characterId)
  if (!charCache) {
    charCache = new Map()
    assetNamesCache.set(characterId, charCache)
  }
  
  const uncachedIds: number[] = []
  const result: Array<{ item_id: number; name: string }> = []
  
  for (const id of itemIds) {
    const cached = charCache.get(id)
    if (cached) {
      result.push({ item_id: id, name: cached })
    } else {
      uncachedIds.push(id)
    }
  }
  
  if (uncachedIds.length === 0) {
    return result
  }
  
  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) throw new AppError(ErrorCodes.ESI_NO_TOKEN)

    const response = await esiClient.post(`/characters/${characterId}/assets/names/`, uncachedIds, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    
    const namesData = response.data as Array<{ item_id: number; name: string }>
    
    for (const item of namesData) {
      charCache!.set(item.item_id, item.name)
      result.push(item)
    }
    
    return result
  } catch (error) {
    logger.error('ESI', `Failed to fetch asset names for ${characterId}`, error)
    return result
  }
}

export async function getStationName(stationId: number) {
  try {
    const response = await esiClient.get(`/universe/stations/${stationId}/`)
    return response.data.name as string
  } catch (error) {
    logger.error('ESI', `Failed to fetch station name for ${stationId}`, error)
    return 'Unknown Station'
  }
}

export interface StructureInfo {
  id: number
  name: string
  solarSystemId: number
  solarSystemName: string
  corporationId: number
  type: string
}

export async function getStructureInfo(structureId: number, characterId: number): Promise<StructureInfo | null> {
  try {
    const { accessToken } = await getValidAccessToken(characterId)
    if (!accessToken) throw new AppError(ErrorCodes.ESI_NO_TOKEN)

    const response = await esiClient.get(`/universe/structures/${structureId}/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = response.data

    let solarSystemName = 'Unknown System'
    try {
      solarSystemName = await getSolarSystemName(data.solar_system_id)
    } catch {
      solarSystemName = `System ${data.solar_system_id}`
    }

    return {
      id: structureId,
      name: data.name || `Structure ${structureId}`,
      solarSystemId: data.solar_system_id,
      solarSystemName,
      corporationId: data.corporation_id,
      type: data.type || 'structure',
    }
  } catch (error) {
    logger.error('ESI', `Failed to fetch structure info for ${structureId}`, error)
    return null
  }
}

export async function getStructureName(structureId: number, characterId: number) {
  return (await getStructureNamesBatch([structureId], characterId)).get(structureId) ?? 'Unknown Structure'
}

const structureNamesCache: Map<number, { name: string; timestamp: number }> = new Map()
const STRUCTURE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function getStructureNamesBatch(structureIds: number[], characterId: number): Promise<Map<number, string>> {
  const result = new Map<number, string>()
  
  // Check cache first
  const uncachedIds: number[] = []
  for (const id of structureIds) {
    const cached = structureNamesCache.get(id)
    if (cached && Date.now() - cached.timestamp < STRUCTURE_CACHE_TTL) {
      result.set(id, cached.name)
    } else {
      uncachedIds.push(id)
    }
  }
  
  if (uncachedIds.length === 0) {
    return result
  }
  
  try {
    // Use /universe/names/ endpoint for batch lookup (max 1000 per call)
    // This endpoint is public (no auth required)
    const response = await esiClient.post('/universe/names/', uncachedIds.slice(0, 1000))
    const namesData = response.data as Array<{ id: number; name: string; category: string }>
    
    logger.info('ESI', `Batch names response: ${namesData.length} items, categories:`, [...new Set(namesData.map(n => n.category))])
    
    for (const item of namesData) {
      if (item.category === 'structure') {
        result.set(item.id, item.name)
        structureNamesCache.set(item.id, { name: item.name, timestamp: Date.now() })
      } else if (item.category === 'station') {
        result.set(item.id, item.name)
        structureNamesCache.set(item.id, { name: item.name, timestamp: Date.now() })
      } else {
        // Handle other categories (solar_system, etc.)
        result.set(item.id, item.name)
        structureNamesCache.set(item.id, { name: item.name, timestamp: Date.now() })
      }
    }
    
    // Any IDs not found in response, mark as unknown
    for (const id of uncachedIds) {
      if (!result.has(id)) {
        result.set(id, 'Unknown Structure')
      }
    }
    
    logger.info('ESI', `Batch resolved ${namesData.length} structure/station names`)
  } catch (error) {
    logger.error('ESI', `Failed to batch fetch structure names`, error)
    // Fallback: mark all uncached as unknown
    for (const id of uncachedIds) {
      result.set(id, 'Unknown Structure')
    }
  }
  
  return result
}

export async function resolveLocationName(locationId: number, characterId: number) {
  if (locationId >= 60000000 && locationId < 64000000) {
    return await getStationName(locationId)
  } else if (locationId >= 1000000000) {
    return await getStructureName(locationId, characterId)
  }
  return `Unknown Location (${locationId})`
}

export async function getCharacterWalletTransactions(characterId: number) {
  try {
    return await fetchWithAuth(`/characters/${characterId}/wallet/transactions/`, characterId)
  } catch (error) {
    logger.error('ESI', `Failed to fetch wallet transactions for ${characterId}`, error)
    return []
  }
}

export async function getCharacterIndustryJobs(characterId: number) {
  try {
    return await fetchWithAuth(`/characters/${characterId}/industry/jobs/`, characterId)
  } catch (error) {
    logger.error('ESI', `Failed to fetch industry jobs for ${characterId}`, error)
    return []
  }
}

export async function getCharacterContracts(characterId: number) {
  try {
    return await fetchWithAuth(`/characters/${characterId}/contracts/`, characterId)
  } catch (error) {
    logger.error('ESI', `Failed to fetch contracts for ${characterId}`, error)
    return []
  }
}

export async function getCharacterNotifications(characterId: number) {
  try {
    return await fetchWithAuth(`/characters/${characterId}/notifications/`, characterId)
  } catch (error) {
    logger.error('ESI', `Failed to fetch notifications for ${characterId}`, error)
    return []
  }
}


async function fetchPaginatedJournal(
  url: string,
  characterId: number,
  params: Record<string, string | number | boolean> = {},
  untilDate?: Date
): Promise<WalletJournal[]> {
  const results: WalletJournal[] = []
  const { accessToken } = await getValidAccessToken(characterId)
  
  if (!accessToken) throw new AppError(ErrorCodes.ESI_NO_TOKEN)

  for (let page = 1; page <= 50; page++) {
    const response = await esiClient.get(url, {
      params: { ...params, page },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    
    const data = response.data
    if (Array.isArray(data) && data.length > 0) {
      // Validate with schema if available or just cast
      results.push(...data as WalletJournal[])
      
      if (untilDate) {
        const lastEntry = data[data.length - 1]
        if (new Date(lastEntry.date) < untilDate) break
      }

      if (data.length < 500) break 
    } else {
      break
    }

    if (page > 1) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  return results
}

export async function getCharacterWalletJournal(characterId: number, untilDate?: Date) {
  try {
    return await fetchPaginatedJournal(`/characters/${characterId}/wallet/journal/`, characterId, {}, untilDate)
  } catch (error: unknown) {
    logger.error('ESI', `Exception fetching wallet journal for ${characterId}`, error)
    throw error
  }
}

export async function getCorporationWalletJournal(corporationId: number, characterId: number, division: number = 1) {
  try {
    return await fetchPaginatedJournal(`/corporations/${corporationId}/wallets/${division}/journal/`, characterId, {})
  } catch (error: unknown) {
    logger.error('ESI', `Exception fetching corp wallet journal for corp ${corporationId}`, error)
    throw error
  }
}

