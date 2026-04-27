import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { fetchCharacterData } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import { parseScopesFromJwt } from '@/lib/utils'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

/**
 * GET /api/characters/[id] - Get character details
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
      id: true,
      name: true,
      totalSp: true,
      walletBalance: true,
      location: true,
      ship: true,
      shipTypeId: true,
      lastFetchedAt: true,
      isMain: true,
      esiApp: true,
      corporationId: true,
      tokenExpiresAt: true,
      tags: true,
      accessToken: true,
      refreshToken: true,
    }
  })
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }
  
  const scopes = character.accessToken ? parseScopesFromJwt(character.accessToken) : []
  
  return {
    ...character,
    scopes,
  }
}))

/**
 * POST /api/characters/[id] - Refresh character data from ESI
 */
export const POST = withErrorHandling(withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)
  
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id
    }
  })
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }

  const { accessToken, error: refreshError } = await getValidAccessToken(characterId)
  
  if (!accessToken) {
    // If it's a permanent failure, mark it as invalid in the DB
    if (refreshError === 'invalid_grant' || refreshError === 'token_invalid') {
      await prisma.character.update({
        where: { id: characterId },
        data: { tokenExpiresAt: new Date(1) }
      })
    }
    throw new AppError(ErrorCodes.ESI_NO_TOKEN, 'Session expired. Please re-authenticate the character.', 401)
  }

  const charData = await fetchCharacterData(characterId, accessToken)
  
  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      name: charData.name || character.name,
      totalSp: charData.total_sp || character.totalSp,
      walletBalance: charData.wallet || character.walletBalance,
      location: charData.location,
      ship: charData.ship,
      shipTypeId: charData.shipTypeId,
      lastFetchedAt: new Date(),
    },
  })
  
  return updated
}))

/**
 * DELETE /api/characters/[id] - Remove character
 */
export const DELETE = withErrorHandling(withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)
  
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id
    }
  })
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }
  
  await prisma.character.delete({
    where: { id: characterId }
  })
  
  return { success: true }
}))

/**
 * PUT /api/characters/[id] - Update character tokens
 */
export const PUT = withErrorHandling(withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)
  const body = await request.json()
  
  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id
    }
  })
  
  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }
  
  const updated = await prisma.character.update({
    where: { id: characterId },
    data: {
      accessToken: body.accessToken ?? character.accessToken,
      refreshToken: body.refreshToken ?? character.refreshToken,
      tokenExpiresAt: body.tokenExpiresAt ? new Date(body.tokenExpiresAt) : character.tokenExpiresAt
    }
  })
  
  return updated
}))
