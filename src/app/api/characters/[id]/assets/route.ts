import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getCharacterAssets, getTypeName, getCharacterAssetNames, resolveLocationName, getStructureName } from '@/lib/esi'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

interface AssetItem {
  item_id: number
  type_id: number
  location_id: number
  location_flag?: string
  quantity?: number
  is_singleton?: boolean
}

// SDE type_ids for cargo containers
const CONTAINER_TYPE_IDS = [
  17364, 17365, 17366, 17367, 17368, 17369,
  33397, 33398, 33399, 33400, 33401, 33402,
  17370, 17531, 17532, 17533, 17534, 17535,
  17536, 17537, 17538, 17539, 26872,
]

export const GET = withErrorHandling(
  withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const characterId = Number.parseInt(id, 10)
    const { searchParams } = new URL(request.url)
    const containerMode = searchParams.get('containerMode')
    const locationId = searchParams.get('locationId')
    const search = searchParams.get('search') || ''
    const cache = searchParams.get('_t')

    const character = await prisma.character.findFirst({
      where: { id: characterId, userId: user.id },
    })

    if (!character) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
    }

    const assets = (await getCharacterAssets(characterId)) as AssetItem[]

    logger.info('Assets:Character', `Total assets: ${assets.length}`)

    // Primeiro, pega todos os assets do character
    let filteredAssets = assets

    // Se locationId especificado, pega assets dessa estrutura OU dentro de containers dessa estrutura
    if (locationId) {
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
      return enriched.filter(asset => containerTypeIds.has(asset.typeId))
    }

    return enriched
  })
)

