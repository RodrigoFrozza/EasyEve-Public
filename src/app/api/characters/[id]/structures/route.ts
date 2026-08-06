import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getStructureInfo, resolveTrackableLocationCategories } from '@/lib/esi'
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

interface StructureOption {
  id: number
  name: string
  solarSystem: string
  assetCount: number
}

export const GET = withErrorHandling(
  withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }): Promise<
    LocationDiscoveryResult<StructureOption[]>
  > => {
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

    if (!hasAssetReadScope(character.accessToken ? decryptToken(character.accessToken) : null)) {
      logger.warn('Activity:Structures', `Character ${characterId} is missing the assets read scope`)
      return { ok: false, reason: 'missing_scopes' }
    }

    const { getCharacterAssets } = await import('@/lib/esi')

    let assets: AssetItem[]
    try {
      assets = (await getCharacterAssets(characterId, { throwOnError: true })) as AssetItem[]
    } catch (error) {
      logger.error('Activity:Structures', `Failed to fetch assets for character ${characterId}`, error)
      return { ok: false, reason: classifyEsiFetchFailure(error) }
    }

    logger.info('Activity:Structures', `Got ${Array.isArray(assets) ? assets.length : 0} assets for character ${characterId}`)

    if (!assets || assets.length === 0) {
      logger.warn('Activity:Structures', `No assets found for character ${characterId}`)
      return { ok: false, reason: 'no_valid_locations' }
    }

    const locationCounts: Record<number, number> = {}
    assets.forEach(asset => {
      locationCounts[asset.location_id] = (locationCounts[asset.location_id] || 0) + 1
    })

    const uniqueLocationIds = Object.keys(locationCounts).map(Number)
    logger.info('Activity:Structures', `Unique locations: ${uniqueLocationIds.length}`, uniqueLocationIds.slice(0, 10))

    const trackableMap = await resolveTrackableLocationCategories(uniqueLocationIds, characterId)
    const trackableLocationIds = [...trackableMap.keys()]

    logger.info(
      'Activity:Structures',
      `Strict trackable locations: ${trackableLocationIds.length}`,
      trackableLocationIds.slice(0, 10)
    )

    if (trackableLocationIds.length === 0) {
      logger.warn('Activity:Structures', `No stations or structures found for character ${characterId}. Sample locations:`, uniqueLocationIds.slice(0, 5))
      return { ok: false, reason: 'no_valid_locations' }
    }

    const locations = await Promise.all(
      trackableLocationIds.map(async (locId) => {
        const resolved = trackableMap.get(locId)
        if (!resolved) return null

        if (resolved.category === 'station') {
          return {
            id: locId,
            name: resolved.name,
            solarSystem: 'NPC Station',
            assetCount: locationCounts[locId] || 0,
          }
        }

        const structureInfo = await getStructureInfo(locId, characterId).catch(() => null)
        return {
          id: locId,
          name: structureInfo?.name || resolved.name,
          solarSystem: structureInfo?.solarSystemName || 'Unknown System',
          assetCount: locationCounts[locId] || 0,
        }
      })
    )

    const filteredLocations = (locations.filter(Boolean) as Array<{
      id: number
      name: string
      solarSystem: string
      assetCount: number
    }>)
      .filter((location) =>
        !search ||
        location.name.toLowerCase().includes(search.toLowerCase()) ||
        location.solarSystem.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.assetCount - a.assetCount)

    logger.info('Activity:Structures', `Found ${filteredLocations.length} locations for character ${characterId}`)

    return { ok: true, data: filteredLocations.slice(0, 50) }
  })
)
