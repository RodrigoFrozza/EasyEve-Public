import { prisma } from './prisma'
import { logger } from './server-logger'

const EVE_SSO_URL = 'https://login.eveonline.com/v2/oauth/token'

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

export async function refreshAccessToken(refreshToken: string, esiApp: string = 'main'): Promise<{ token?: TokenResponse; error?: string } | null> {
  const clientId = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_ID : process.env.EVE_CLIENT_ID
  const clientSecret = esiApp === 'holding' ? process.env.HOLDING_EVE_CLIENT_SECRET : process.env.EVE_CLIENT_SECRET

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout
    
    try {
      const response = await fetch(EVE_SSO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        let error = 'refresh_failed'
        try {
          const errorJson = JSON.parse(errorText)
          error = errorJson.error || error
        } catch {}
        
        logger.error('TokenManager', 'Token refresh failed', { status: response.status, error, errorText })
        return { error }
      }

      const data = await response.json()
      return { token: data }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    logger.error('TokenManager', 'Token refresh exception', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'exception' }
  }
}

// Map to track ongoing refresh promises to prevent concurrent redundant refreshes
const refreshPromises = new Map<number, Promise<{ accessToken: string | null; characterId: number; error?: string }>>()

export async function getValidAccessToken(characterId: number): Promise<{ accessToken: string | null; characterId: number; error?: string }> {
  // Check if there is already an ongoing refresh for this character
  if (refreshPromises.has(characterId)) {
    return refreshPromises.get(characterId)!
  }

  const performRefresh = async () => {
    try {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: {
          id: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiresAt: true,
          esiApp: true,
        },
      })

      if (!character || !character.refreshToken) {
        return { accessToken: null, characterId, error: 'no_character' }
      }

      // If tokenExpiresAt is extremely low, it was marked as invalid by us
      if (character.tokenExpiresAt && character.tokenExpiresAt.getTime() < 1000000000000) {
        return { accessToken: null, characterId, error: 'token_invalid' }
      }

      const now = new Date()
      const expiresAt = character.tokenExpiresAt

      // If token is still valid (more than 5 mins remaining), return it
      if (character.accessToken && expiresAt && expiresAt.getTime() > now.getTime() + 5 * 60 * 1000) {
        return { accessToken: character.accessToken, characterId }
      }

      logger.info('TokenManager', `Refreshing token for character ${characterId}`, { esiApp: character.esiApp })
      const refreshResult = await refreshAccessToken(character.refreshToken, character.esiApp)
      
      if (!refreshResult || refreshResult.error) {
        return { accessToken: null, characterId, error: refreshResult?.error || 'refresh_failed' }
      }

      const newTokens = refreshResult.token!
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)

      try {
        await prisma.character.update({
          where: { id: characterId },
          data: {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            tokenExpiresAt: newExpiresAt,
          },
        })
      } catch (error) {
        logger.error('TokenManager', `Failed to update token for character ${characterId}`, { error })
        return { accessToken: null, characterId, error: 'db_update_failed' }
      }

      return { accessToken: newTokens.access_token, characterId }
    } finally {
      // Always clear the promise from the map when done
      refreshPromises.delete(characterId)
    }
  }

  const promise = performRefresh()
  refreshPromises.set(characterId, promise)
  return promise
}

export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= Date.now()
}

export function isTokenExpiringSoon(expiresAt: Date | null, minutesThreshold: number = 5): boolean {
  if (!expiresAt) return true
  return expiresAt.getTime() <= Date.now() + minutesThreshold * 60 * 1000
}
