import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'
import { batchPromiseAll } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const ESI_BASE = 'https://esi.evetech.net/latest'

/**
 * GET /api/esi/fittings - Get character fittings from ESI
 * Query params:
 *   - characterId: EVE character ID (optional, uses main if not provided)
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  let characterIdStr = searchParams.get('characterId')
  
  // Find character
  const characters = await prisma.character.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, accessToken: true }
  })

  if (!characters || characters.length === 0) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'No characters linked', 400)
  }

  // Use first character if not specified
  if (!characterIdStr) {
    characterIdStr = String(characters[0].id)
  }

  const characterId = parseInt(characterIdStr)
  const character = characters.find(c => c.id === characterId)
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }

  // Get access token
  const tokenResult = await getValidAccessToken(character.id)
  if (!tokenResult.accessToken) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'No valid token for character', 401)
  }
  const token = tokenResult.accessToken

  // Fetch fittings from ESI
  const response = await fetch(
    `${ESI_BASE}/characters/${character.id}/fittings/`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'EasyEve/1.0'
      }
    }
  )

  if (!response.ok) {
    logger.error('ESI', `Fittings fetch failed with status ${response.status} for char ${character.id}`)
    throw new AppError(ErrorCodes.ESI_FETCH_FAILED, 'Failed to fetch fittings from ESI', response.status)
  }

  const fittings = await response.json()

  // Transform to our format
  const transformed = fittings.map((fit: any) => ({
    fitId: fit.fitting_id,
    name: fit.name,
    shipTypeId: fit.ship_type_id,
    shipName: '', // Will be resolved
    description: fit.description || '',
    highSlots: fit.slots?.high || [],
    medSlots: fit.slots?.med || [],
    lowSlots: fit.slots?.low || [],
    rigSlots: fit.slots?.rig || [],
  }))

  // Resolve ship names with cache
  const { withCache } = await import('@/lib/cache')
  const shipTypeIdList: number[] = Array.from(new Set(transformed.map((f: any) => f.shipTypeId))) as number[]
  
  const RESOLUTION_CONCURRENCY = 10
  await batchPromiseAll(shipTypeIdList, RESOLUTION_CONCURRENCY, async (tid) => {
    try {
      const shipName = await withCache(`esi:type:${tid}:name`, async () => {
        const res = await fetch(`${ESI_BASE}/universe/types/${tid}/`)
        if (!res.ok) throw new Error(`ESI type fetch failed: ${res.status}`)
        const data = await res.json()
        return data.name as string
      }, 24 * 60 * 60 * 1000) // 24h cache

      for (const fit of transformed) {
        if (fit.shipTypeId === tid) {
          fit.shipName = shipName
        }
      }
    } catch (e) {
      logger.error('ESI', `Failed to resolve ship name for type ${tid}`, e)
    }
  })

  return transformed
})