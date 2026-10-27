import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getCharacterAssets, getTypeName, getCharacterAssetNames, resolveLocationName, getStructureName } from '@/lib/esi'
import { CONTAINER_TYPE_ID_SET, MOBILE_TRACTOR_UNIT_TYPE_ID } from '@/lib/constants/container-types'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import {
  classifyEsiFetchFailure,
  hasAssetReadScope,
  type LocationDiscoveryResult,
} from '@/lib/esi-location-discovery'
import { decryptToken } from '@/lib/crypto/token-cipher'

export const dynamic = 'force-dynamic'

interface AssetItem {
  item_id: number
  type_id: number
  location_id: number
  location_flag?: string
  quantity?: number
  is_singleton?: boolean
}

interface EnrichedAsset {
  itemId: number
  typeId: number
  typeName: string
  customName: string
  locationId: number
  locationName: string
  locationFlag?: string
  quantity: number
}

// SDE type_ids for cargo containers
const CONTAINER_TYPE_IDS = [...CONTAINER_TYPE_ID_SET]

export const GET = withErrorHandling(
  withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }): Promise<
    LocationDiscoveryResult<EnrichedAsset[]>
  > => {
    const { id } = await params
    const characterId = Number.parseInt(id, 10)
    const { searchParams } = new URL(request.url)
    const containerMode = searchParams.get('containerMode')
    const mtuMode = searchParams.get('mtuMode') === 'true'
    const locationId = searchParams.get('locationId')
    const search = searchParams.get('search') || ''
    const cache = searchParams.get('_t')

    const character = await prisma.character.findFirst({
      where: { id: characterId, userId: user.id },
    })

    if (!character) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
    }

    if (!hasAssetReadScope(character.accessToken ? decryptToken(character.accessToken) : null)) {
      logger.warn('Assets:Character', `Character ${characterId} is missing the assets read scope`)
      return { ok: false, reason: 'missing_scopes' }
    }

    let assets: AssetItem[]
    try {
      assets = (await getCharacterAssets(characterId, { throwOnError: true })) as AssetItem[]
    } catch (error) {
      logger.error('Assets:Character', `Failed to fetch assets for character ${characterId}`, error)
      return { ok: false, reason: classifyEsiFetchFailure(error) }
    }

    logger.info('Assets:Character', `Total assets: ${assets.length}`)

    // Primeiro, pega todos os assets do character
    let filteredAssets = assets

    // MTUs ficam soltos no espaço (location_id = sistema solar), não dentro de uma
    // estrutura/estação — descoberta independe de locationId.
    if (mtuMode) {
      filteredAssets = filteredAssets.filter((a) => a.type_id === MOBILE_TRACTOR_UNIT_TYPE_ID)
    } else if (locationId) {
      const locId = Number(locationId)
      
      const containersInStructure = filteredAssets.filter(
        a => a.location_id === locId && CONTAINER_TYPE_IDS.includes(a.type_id)
      )
      
      const containerIdsInStructure = new Set(containersInStructure.map(c => c.item_id))
      
      filteredAssets = filteredAssets.filter(a => 
        a.location_id === locId ||
        containerIdsInStructure.has(a.location_id)
      )
    }

    const itemIds = filteredAssets.map((a) => a.item_id)
    const customNames = await getCharacterAssetNames(characterId, itemIds)
    const nameMap = new Map(customNames.map((n) => [n.item_id, n.name]))

    const uniqueTypeIds = [...new Set(filteredAssets.map((asset) => asset.type_id))]
    const uniqueLocationIds = [...new Set(filteredAssets.map((asset) => asset.location_id))]

    const typeNameEntries = await Promise.all(
      uniqueTypeIds.map(async (typeId) => [typeId, await getTypeName(typeId)] as const)
    )
    const typeNameMap = new Map<number, string>(typeNameEntries)

    const locationNameEntries = await Promise.all(
      uniqueLocationIds.map(async (locId) => {
        if (locId >= 1000000000) {
          return [locId, await getStructureName(locId, characterId)] as const
        }
        return [locId, await resolveLocationName(locId, characterId)] as const
      })
    )
    const locationNameMap = new Map<number, string>(locationNameEntries)

    let enriched = await Promise.all(
      filteredAssets.map(async (asset) => {
        const typeName = typeNameMap.get(asset.type_id) || 'Unknown Type'
        const customName = nameMap.get(asset.item_id) || typeName
        const locationName = locationNameMap.get(asset.location_id) || `Unknown Location (${asset.location_id})`

        return {
          itemId: asset.item_id,
          typeId: asset.type_id,
          typeName,
          customName,
          locationId: asset.location_id,
          locationName,
          locationFlag: asset.location_flag,
          quantity: asset.quantity || 0,
        }
      })
    )

    if (search) {
      const searchLower = search.toLowerCase()
      enriched = enriched.filter(asset =>
        asset.customName.toLowerCase().includes(searchLower) ||
        asset.typeName.toLowerCase().includes(searchLower) ||
        asset.locationName.toLowerCase().includes(searchLower)
      )
    }

    // Apply containerMode filter at the end
    if (containerMode === 'true') {
      const containerTypeIds = new Set(CONTAINER_TYPE_IDS)
      enriched = enriched.filter(asset => containerTypeIds.has(asset.typeId))
    }

    if (enriched.length === 0) {
      return { ok: false, reason: 'empty' }
    }

    return { ok: true, data: enriched }
  })
)

