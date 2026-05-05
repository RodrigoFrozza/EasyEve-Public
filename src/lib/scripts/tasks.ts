import { prisma } from '@/lib/prisma'
import { getCorporationWalletJournal } from '@/lib/esi'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'

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
 */
export async function syncCorporationPayments() {
  const component = 'Task:WalletSync'
  
  // 1. Find a manager character
  const managerChar = await prisma.character.findFirst({
    where: { 
      OR: [
        { esiApp: 'holding' },
        { isCorpManager: true },
      ]
    },
    orderBy: { esiApp: 'asc' }
  })

  if (!managerChar) {
    throw new Error('No Corporation Manager character found')
  }

  // Get character public info to get corp ID
  const charInfoRes = await esiClient.get(`/characters/${managerChar.id}/`)
  const corpId = charInfoRes.data.corporation_id
  
  if (!corpId) {
    throw new Error('Could not determine corporation ID')
  }

  // Fetch Journal
  const journal = await getCorporationWalletJournal(corpId, managerChar.id)

  // Process entries
  let newPaymentsCount = 0
  
  for (const entry of journal) {
    const validRefTypes = ['player_donation', 10, 'donation', 8, 'corporation_payment', 15]
    if (!validRefTypes.includes(entry.ref_type)) continue
    if (!entry.amount || entry.amount <= 0) continue 

    const existing = await prisma.payment.findUnique({
      where: { journalId: entry.id.toString() }
    })
    if (existing) continue

    // Resolve user
    let resolvedUserId: string | null = null
    const accountCodeMatch = entry.description?.match(/EVE-[A-HJ-NP-Z2-9]{6}/i)
    
    if (accountCodeMatch) {
      const userByCode = await prisma.user.findUnique({
        where: { accountCode: accountCodeMatch[0].toUpperCase() },
        select: { id: true }
      })
      if (userByCode) {
        resolvedUserId = userByCode.id
      }
    }

    const payerChar = await prisma.character.findUnique({
      where: { id: entry.first_party_id },
      select: { userId: true, name: true }
    })
    
    if (!resolvedUserId && payerChar?.userId) {
      resolvedUserId = payerChar.userId
    }

    if (!resolvedUserId) {
      const masterUser = await prisma.user.findFirst({ where: { role: 'master' } })
      resolvedUserId = masterUser?.id || ''
    }

    // Create payment and update balance
    const payment = await prisma.payment.create({
      data: {
        userId: resolvedUserId,
        amount: entry.amount || 0,
        payerCharacterId: entry.first_party_id,
        payerCharacterName: payerChar?.name || entry.description || 'Unknown Payer',
        journalId: entry.id.toString(),
        status: 'pending',
        createdAt: new Date(entry.date)
      }
    })

    await prisma.user.update({
      where: { id: resolvedUserId },
      data: { iskBalance: { increment: entry.amount || 0 } }
    })

    // Also add to history if it exists
    try {
      await prisma.iskHistory.create({
        data: {
          userId: resolvedUserId,
          amount: entry.amount || 0,
          type: 'payment',
          reference: payment.id
        }
      })
    } catch (e) {
      // Ignore if table doesn't exist
    }

    newPaymentsCount++
  }

  // Update last sync info
  const now = new Date().toISOString()
  await prisma.sdeCache.upsert({
    where: { key: 'last_wallet_sync' },
    update: { value: { timestamp: now, payments: newPaymentsCount } },
    create: { key: 'last_wallet_sync', value: { timestamp: now, payments: newPaymentsCount } }
  })

  logger.info(component, `Synced ${newPaymentsCount} new payments`)
  return newPaymentsCount
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
      const refreshResult = await refreshAccessToken(char.refreshToken, char.esiApp || 'main')
      
      if (refreshResult?.token) {
        const newTokens = refreshResult.token
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
        
        await prisma.character.update({
          where: { id: char.id },
          data: {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
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
        if (error === 'invalid_grant' || error === 'token_invalid') {
           await prisma.character.update({
             where: { id: char.id },
             data: { tokenExpiresAt: new Date(1) }
           })
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

