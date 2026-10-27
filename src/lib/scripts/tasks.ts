import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { encryptToken, decryptToken } from '@/lib/crypto/token-cipher'
import { syncCorpWalletPayments } from '@/lib/payments/wallet-sync'
import { isRevocationError, markCharacterTokenRevoked } from '@/lib/characters/token-revocation'

/**
 * Task: Sync Market Prices from ESI
 */
export async function syncMarketPrices() {
  const component = 'Task:SyncPrices'
  const ESI_BASE = 'https://esi.evetech.net/latest'
  
  const response = await fetch(`${ESI_BASE}/markets/prices/`, {
    headers: { 'User-Agent': 'EasyEve-Task/1.0' }
  })
  
  if (!response.ok) throw new Error(`ESI Error: ${response.status}`)
  
  const data = await response.json()
  let updatedCount = 0
  const priceMap: Record<number, number> = {}
  
  for (const item of data) {
    const price = item.adjusted_price || item.average_price || 0
    if (price > 0) {
      priceMap[item.type_id] = price
      updatedCount++
    }
  }

  await prisma.sdeCache.upsert({
    where: { key: 'market_prices_map' },
    create: {
      key: 'market_prices_map',
      value: priceMap as any,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    },
    update: {
      value: priceMap as any,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  })

  logger.info(component, `Updated ${updatedCount} prices`)
  return updatedCount
}

/**
 * Task: Sync Corporation Wallet Payments
 * Thin wrapper: the sync itself lives in wallet-sync.ts, shared with the admin button.
 */
export async function syncCorporationPayments() {
  const result = await syncCorpWalletPayments()
  return result.newPaymentsCount
}

/**
 * Task: Clear Expired Cache
 */
export async function clearExpiredCache() {
  const result = await prisma.sdeCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  return result.count
}

/**
 * Task: Auto-refresh expiring character tokens
 */
export async function autoRefreshToken() {
  const component = 'Task:AutoRefresh'
  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  const characters = await prisma.character.findMany({
    where: {
      refreshToken: { not: null },
      tokenExpiresAt: {
        lte: oneHourFromNow,
      },
    },
    select: {
      id: true,
      name: true,
      refreshToken: true,
      esiApp: true,
    },
  })

  const refreshedCount = {
    total: characters.length,
    success: 0,
    failed: 0,
  }

  for (const char of characters) {
    if (!char.refreshToken) continue

    try {
      const { refreshAccessToken } = await import('@/lib/token-manager')
      const refreshResult = await refreshAccessToken(decryptToken(char.refreshToken), char.esiApp || 'main')

      if (refreshResult?.token) {
        const newTokens = refreshResult.token
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)

        await prisma.character.update({
          where: { id: char.id },
          data: {
            accessToken: encryptToken(newTokens.access_token),
            refreshToken: encryptToken(newTokens.refresh_token),
            tokenExpiresAt: newExpiresAt,
          },
        })
        
        logger.info(component, 'Token refreshed', { characterId: char.id, characterName: char.name })
        refreshedCount.success++
      } else {
        const error = refreshResult?.error || 'unknown_error'
        logger.warn(component, 'Token refresh failed', {
          characterId: char.id,
          characterName: char.name,
          error,
        })
        
        // Handle revocation
        if (isRevocationError(error)) {
          await markCharacterTokenRevoked(char.id)
        }

        refreshedCount.failed++
      }
    } catch (error) {
      logger.error(component, `Unexpected token refresh error for ${char.name}`, error)
      refreshedCount.failed++
    }
  }

  return refreshedCount
}

