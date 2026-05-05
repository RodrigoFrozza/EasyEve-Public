import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { fetchCharacterData } from '@/lib/esi'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { LinkCharacterSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { toPublicCharacter } from '@/lib/characters/public-character'
import { parseCharacterPagination } from '@/lib/characters/pagination'
import { CHARACTER_STALE_THRESHOLD_MS } from '@/lib/characters/constants'
import type { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const { paginated, page, limit, skip } = parseCharacterPagination({
    pageParam: searchParams.get('page'),
    limitParam: searchParams.get('limit'),
  })
  const search = searchParams.get('search')?.trim()
  const sort = searchParams.get('sort')
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
  const status = searchParams.get('status')
  const tag = searchParams.get('tag')

  const where: Prisma.CharacterWhereInput = { userId: user.id }

  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  if (status === 'main') {
    where.isMain = true
  } else if (status === 'stale') {
    where.OR = [
      { lastFetchedAt: null },
      { lastFetchedAt: { lt: new Date(Date.now() - CHARACTER_STALE_THRESHOLD_MS) } },
    ]
  } else if (status === 'tag' && tag) {
    where.tags = { has: tag }
  }

  const orderByMap: Record<string, Prisma.CharacterOrderByWithRelationInput> = {
    name: { name: order },
    totalSp: { totalSp: order },
    walletBalance: { walletBalance: order },
    lastFetchedAt: { lastFetchedAt: order },
  }
  const orderBy = orderByMap[sort || ''] ?? { createdAt: 'desc' }
  
  const characters = await prisma.character.findMany({
    where,
    orderBy,
    ...(paginated ? { skip, take: limit } : {}),
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
    },
  })

  const items = characters.map(toPublicCharacter)
  if (!paginated) return items

  const total = await prisma.character.count({
    where,
  })

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  }
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
  
  return toPublicCharacter(character)
})
