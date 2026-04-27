import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getCharacterAssets, getTypeName, getCharacterAssetNames, resolveLocationName, getStructureName } from '@/lib/esi'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

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

    console.log(`[Assets API] Request: characterId=${characterId}, containerMode=${containerMode}, locationId=${locationId}, search=${search}, cache=${cache}, userId=${user.id}`)

    const character = await prisma.character.findFirst({
      where: { id: characterId, userId: user.id },
    })

    if (!character) {
      console.log(`[Assets API] Character ${characterId} NOT FOUND for user ${user.id}`)
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
    }

    console.log(`[Assets API] Character found: ${character.name} (id: ${character.id}), userId=${user.id}`)

    const assets = (await getCharacterAssets(characterId)) as AssetItem[]

    console.log(`[Assets API] Total assets returned: ${assets.length}`)
    if (assets.length > 0) {
      console.log(`[Assets API] Sample asset locations:`, assets.slice(0, 5).map(a => a.location_id))
    }

    // Primeiro, pega todos os assets do character
    let filteredAssets = assets

    // Se locationId especificado, pega assets dessa estrutura OU dentro de containers dessa estrutura
    if (locationId) {
      const locId = Number(locationId)
      console.log(`Filtering by locationId: ${locId}`)
      console.log(`Total assets before filter: ${filteredAssets.length}`)
      
      // Encontra os containers que estão nessa estrutura (location_id = estrutura)
      const containersInStructure = filteredAssets.filter(
        a => a.location_id === locId && CONTAINER_TYPE_IDS.includes(a.type_id)
      )
      console.log(`Containers in structure: ${containersInStructure.length}`)
      
      // Cria um set com os item_ids dos containers na estrutura
      const containerIdsInStructure = new Set(containersInStructure.map(c => c.item_id))
      
      // Agora pega TODOS os items que estão nessa estrutura OU dentro de containers dessa estrutura
      filteredAssets = filteredAssets.filter(a => 
        a.location_id === locId ||  // Items no hangar da estrutura
        containerIdsInStructure.has(a.location_id)  // Items dentro de containers na estrutura
      )
      
      console.log(`Total assets after filter: ${filteredAssets.length}`)
    }

    const itemIds = filteredAssets.map((a) => a.item_id)
    const customNames = await getCharacterAssetNames(characterId, itemIds)
    const nameMap = new Map(customNames.map((n) => [n.item_id, n.name]))

    let enriched = await Promise.all(
      filteredAssets.map(async (asset) => {
        const typeName = await getTypeName(asset.type_id)
        const customName = nameMap.get(asset.item_id) || typeName

        let locationName: string
        if (asset.location_id >= 1000000000) {
          locationName = await getStructureName(asset.location_id, characterId)
        } else {
          locationName = await resolveLocationName(asset.location_id, characterId)
        }

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

    return enriched
  })
)

