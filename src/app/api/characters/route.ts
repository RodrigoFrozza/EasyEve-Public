import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { fetchCharacterData } from '@/lib/esi'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { LinkCharacterSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  
  const characters = await prisma.character.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  })
  
  return characters
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  
  const body = await validateBody(request, LinkCharacterSchema)
  const { characterId, accessToken, characterOwnerHash } = body
  
  const existingChar = await prisma.character.findUnique({
    where: { id: characterId }
  })
  
  if (existingChar && existingChar.userId !== user.id) {
    throw new AppError(
      ErrorCodes.API_CONFLICT, 
      'Character already linked to another account', 
      409
    )
  }
  
  const charData = await fetchCharacterData(characterId, accessToken)
  
  const character = await prisma.character.upsert({
    where: { id: characterId },
    create: {
      id: characterId,
      name: charData.name || `Character ${characterId}`,
      ownerHash: characterOwnerHash || '',
      accessToken: accessToken,
      userId: user.id,
      totalSp: charData.total_sp || 0,
      walletBalance: charData.wallet || 0,
      location: charData.location,
      ship: charData.ship,
      shipTypeId: charData.shipTypeId,
      lastFetchedAt: new Date()
    },
    update: {
      accessToken: accessToken,
      totalSp: charData.total_sp || 0,
      walletBalance: charData.wallet || 0,
      location: charData.location,
      ship: charData.ship,
      shipTypeId: charData.shipTypeId,
      lastFetchedAt: new Date()
    }
  })
  
  return character
})
