import { cookies } from 'next/headers'
import { verifyJWT, type JWTPayload } from './auth-jwt'
import { prisma } from './prisma'
import { logger } from './server-logger'

export interface SessionUser {
  id: string
  accountCode: string
  characterId: number
  ownerHash: string
  role: string
  allowedActivities: string[]
  isBlocked: boolean
  blockReason: string | null
  subscriptionEnd: Date | null
  characters: Array<{
    id: number
    name: string
    isMain: boolean
    corporationId: number | null
    tags: string[]
  }>
}

export interface Session {
  user: SessionUser
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value

  if (!token) return null

  const payload = await verifyJWT(token)
  if (!payload) return null

  const character = await prisma.character.findUnique({
    where: { id: payload.characterId }, // Use characterId for more precise lookup
    include: {
      user: {
        include: {
          characters: {
            select: { id: true, name: true, isMain: true, corporationId: true, tags: true },
          },
        },
      },
    },
  })

  if (!character) return null

  const user = character.user

  // Check if user is blocked
  if (user.isBlocked) {
    logger.warn('Session', `User ${user.id} access denied (blocked)`, { reason: user.blockReason })
    return null
  }

  // Check and handle subscription expiration in real-time
  if (user.subscriptionEnd && new Date() > user.subscriptionEnd) {
    // If expired and not already reset
    if (user.allowedActivities.length > 0) {
      logger.info('Session', `User ${user.id} subscription expired`, { userId: user.id })
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { 
            allowedActivities: [],
            // Keep account active so they can renew
          }
        })
        user.allowedActivities = []
      } catch (error) {
        logger.error('Session', `Failed to update expired subscription for user ${user.id}`, { error })
      }
    }
  }

  return {
    user: {
      id: user.id,
      accountCode: user.accountCode || '',
      characterId: character.id,
      ownerHash: character.ownerHash,
      role: user.role || 'user',
      allowedActivities: user.allowedActivities,
      isBlocked: user.isBlocked,
      blockReason: user.blockReason,
      subscriptionEnd: user.subscriptionEnd,
      characters: user.characters.map(c => ({
        id: c.id,
        name: c.name,
        isMain: c.isMain,
        corporationId: c.corporationId,
        tags: c.tags || []
      })),
    },
  }
}

export async function getSessionFromToken(token: string): Promise<JWTPayload | null> {
  return verifyJWT(token)
}
