import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getCharacterLocation } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

/**
 * GET /api/characters/[id]/location - Get current character location (lightweight)
 */
export const GET = withErrorHandling(withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)
  
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id
    },
    select: {
      id: true
    }
  })
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }
  
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) {
    throw new AppError(ErrorCodes.ESI_NO_TOKEN, 'Session expired', 401)
  }

  const location = await getCharacterLocation(characterId, accessToken)
  
  if (location.error) {
    const status = location.status || 500
    if (status === 403) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, location.error, 403)
    }
    if (status === 401) {
      throw new AppError(ErrorCodes.ESI_TOKEN_INVALID, location.error, 401)
    }
    throw new AppError(ErrorCodes.ESI_ERROR, location.error, status)
  }
  
  return location
}))
