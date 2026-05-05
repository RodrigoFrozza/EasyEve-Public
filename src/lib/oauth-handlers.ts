import { prisma } from './prisma'
import { generateAccountCode } from './account-code'
import { getCharacterInfo, fetchCharacterData } from './esi'
import { logger } from './server-logger'

const EVE_SSO_BASE_URL = 'https://login.eveonline.com/v2/oauth'

export interface OAuthState {
  accountCode?: string
  esiApp?: string
  callbackUrl?: string
}

export function parseState(state: string | null): OAuthState | null {
  if (!state) return null
  
  try {
    return JSON.parse(state)
  } catch {
    return null
  }
}

export async function exchangeCodeForToken(
  code: string, 
  baseUrl: string,
  esiApp: string = 'main'
): Promise<{
  access_token: string
  refresh_token: string
  expires_in: number
}> {
  const endCallback = esiApp === 'holding' ? '/api/auth/callback/holding' : '/api/auth/callback/eveonline'
  const callbackUrl = `${baseUrl}${endCallback}`
  
  const clientId = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_ID : process.env.EVE_CLIENT_ID
  const clientSecret = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_SECRET : process.env.EVE_CLIENT_SECRET

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64')
  
  logger.debug('OAuth', 'Exchanging code for token', { esiApp, callbackUrl })
  
  const response = await fetch(`${EVE_SSO_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    logger.error('OAuth', 'Token exchange failed', { status: response.status, error: text, esiApp })
    throw new Error(`Token exchange failed: ${text}`)
  }

  const data = await response.json()
  logger.debug('OAuth', 'Token received', { esiApp, expires_in: data.expires_in })
  return data
}

export async function handleLoginFlow(
  code: string, 
  baseUrl: string,
  esiApp: string = 'main',
  callbackUrl: string = '/dashboard'
): Promise<{
  userId: string
  characterId: number
  ownerHash: string
  redirectUrl: string
}> {
  logger.info('OAuthLogin', `Starting login flow for app: ${esiApp}`)
  
  const tokenData = await exchangeCodeForToken(code, baseUrl, esiApp)
  logger.debug('OAuthLogin', 'Token obtained, fetching character info', { esiApp })
  
  const charInfo = await getCharacterInfo(tokenData.access_token)
  
  const characterId = charInfo.character_id
  const ownerHash = charInfo.character_owner_hash || ''
  const characterName = charInfo.character_name

  logger.info('OAuthLogin', `Processing character ${characterName} (${characterId})`, { characterId, esiApp })

  const existingChar = await prisma.character.findUnique({
    where: { id: characterId },
    include: { user: true }
  })

  let userId: string
  let user: any

  if (existingChar) {
    logger.info('OAuthLogin', `Updating existing character ${characterId}`, { characterId, userId: existingChar.userId })
    await prisma.character.update({
      where: { id: characterId },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        name: characterName,
        esiApp,
      },
    })
    userId = existingChar.userId
    user = existingChar.user
  } else {
    logger.info('OAuthLogin', `Creating new user and character for ${characterName}`, { characterId })
    const accountCode = generateAccountCode()
    user = await prisma.user.create({
      data: {
        accountCode,
        name: characterName,
        role: 'user',
        allowedActivities: ['ratting'],
        lastLoginAt: new Date(),
      },
    })

    const charData = await fetchCharacterData(characterId, tokenData.access_token)

    await prisma.character.create({
      data: {
        id: characterId,
        name: characterName,
        ownerHash,
        userId: user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        totalSp: charData.total_sp || 0,
        walletBalance: charData.wallet || 0,
        location: charData.location,
        ship: charData.ship,
        shipTypeId: charData.shipTypeId,
        corporationId: charData.corporationId,
        isMain: true,
        esiApp,
      },
    })
    userId = user.id
  }

  logger.debug('OAuthLogin', 'Login flow pre-flight checks', { userId, isBlocked: (user as any).isBlocked })
  
  // Check Blocking & Subscription
  if ((user as any).isBlocked === true) {
    return {
      userId,
      characterId,
      ownerHash,
      redirectUrl: `/login?blocked=true&reason=${encodeURIComponent((user as any).blockReason || 'Manual block')}`,
    }
  }

  // Monthly Auto-check (Subscription Expiration)
  if (!(user as any).isTester && (user as any).subscriptionEnd && new Date() > new Date((user as any).subscriptionEnd)) {
    logger.info('Auth', `User ${userId} subscription expired. Resetting activities.`, { userId })
    await prisma.user.update({
      where: { id: userId },
      data: { allowedActivities: ['ratting'] }
    })
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() }
  })

  return {
    userId,
    characterId,
    ownerHash,
    redirectUrl: callbackUrl,
  }
}

export async function handleLinkFlow(
  code: string,
  accountCode: string,
  baseUrl: string,
  esiApp: string = 'main'
): Promise<{
  userId: string
  characterId: number
  ownerHash: string
  redirectUrl: string
} | { error: string; redirectUrl: string }> {
  const user = await prisma.user.findUnique({
    where: { accountCode },
  })

  if (!user) {
    return {
      error: 'invalid_account',
      redirectUrl: '/login?error=invalid_account',
    }
  }

  // Blocked users cannot link new characters
  if ((user as any).isBlocked === true) {
    return {
      error: 'account_blocked',
      redirectUrl: `/login?blocked=true&reason=${encodeURIComponent((user as any).blockReason || 'Manual block')}`,
    }
  }

  const tokenData = await exchangeCodeForToken(code, baseUrl, esiApp)
  const charInfo = await getCharacterInfo(tokenData.access_token)

  const characterId = charInfo.character_id
  const ownerHash = charInfo.character_owner_hash || ''
  const characterName = charInfo.character_name

  const existingChar = await prisma.character.findUnique({
    where: { id: characterId },
    include: { user: { include: { _count: { select: { characters: true } } } } },
  })

  if (existingChar && existingChar.userId !== user.id) {
    // If the character is under a "ghost" user (only 1 character, created by wrong login flow),
    // migrate it to the correct user and clean up the orphan user
    const otherUser = existingChar.user
    if (otherUser._count.characters === 1) {
      logger.info('OAuthLink', `Migrating character ${characterId} from orphan user ${otherUser.id} to user ${user.id}`, { characterId, fromUser: otherUser.id, toUser: user.id })
      await prisma.character.update({
        where: { id: characterId },
        data: { userId: user.id, isMain: false },
      })
      await prisma.user.delete({ where: { id: otherUser.id } })
    } else {
      return {
        error: 'character_taken',
        redirectUrl: '/dashboard?error=character_taken',
      }
    }
  }

  if (existingChar) {
    await prisma.character.update({
      where: { id: characterId },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        name: characterName,
        esiApp, // Ensure the app context is updated
      },
    })
  } else {
    const charData = await fetchCharacterData(characterId, tokenData.access_token)

    await prisma.character.create({
      data: {
        id: characterId,
        name: characterName,
        ownerHash,
        userId: user.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        totalSp: charData.total_sp || 0,
        walletBalance: charData.wallet || 0,
        location: charData.location,
        ship: charData.ship,
        shipTypeId: charData.shipTypeId,
        corporationId: charData.corporationId,
        isMain: false,
        esiApp,
      },
    })
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  })

  return {
    userId: user.id,
    characterId,
    ownerHash,
    redirectUrl: '/dashboard/characters',
  }
}
