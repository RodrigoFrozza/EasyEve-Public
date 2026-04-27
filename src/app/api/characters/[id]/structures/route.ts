import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getStructureName, getSolarSystemInfo } from '@/lib/esi'
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

export const GET = withErrorHandling(
  withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const characterId = Number.parseInt(id, 10)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''

    const character = await prisma.character.findFirst({
      where: { id: characterId, userId: user.id },
    })

    if (!character) {
      throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
    }

    const { getCharacterAssets } = await import('@/lib/esi')
    const assets = await getCharacterAssets(characterId) as AssetItem[]

    logger.info('Activity:Structures', `Got ${Array.isArray(assets) ? assets.length : 0} assets for character ${characterId}`)

    if (!assets || assets.length === 0) {
      logger.warn('Activity:Structures', `No assets found for character ${characterId}`)
      return []
    }

    const locationCounts: Record<number, number> = {}
    assets.forEach(asset => {
      locationCounts[asset.location_id] = (locationCounts[asset.location_id] || 0) + 1
    })

    const uniqueLocationIds = Object.keys(locationCounts).map(Number)
    logger.info('Activity:Structures', `Unique locations: ${uniqueLocationIds.length}`, uniqueLocationIds.slice(0, 10))

    const uniqueLocations = uniqueLocationIds.filter(locId => locId >= 1000000000)
    logger.info('Activity:Structures', `Structures (locId >= 1000000000): ${uniqueLocations.length}`, uniqueLocations.slice(0, 10))

    if (uniqueLocations.length === 0) {
      logger.warn('Activity:Structures', `No structures found for character ${characterId}. Sample locations:`, uniqueLocationIds.slice(0, 5))
      return []
    }

    const structures = await Promise.all(
      uniqueLocations.slice(0, 200).map(async (locId) => {
        const name = await getStructureName(locId, characterId)
        const systemInfo = await getSolarSystemInfo(locId).catch(() => null)
        return {
          id: locId,
          name: name || `Structure ${locId}`,
          solarSystem: systemInfo?.name || 'Unknown System',
          assetCount: locationCounts[locId],
        }
      })
    )

    const filteredStructures = search
      ? structures.filter(s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.solarSystem.toLowerCase().includes(search.toLowerCase())
        )
      : structures

    filteredStructures.sort((a, b) => b.assetCount - a.assetCount)

    logger.info('Activity:Structures', `Found ${filteredStructures.length} structures for character ${characterId}`)

    return filteredStructures.slice(0, 50)
  })
)