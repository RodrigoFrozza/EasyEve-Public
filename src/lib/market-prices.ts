import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'

const JITA_REGION_ID = 10000002
const PRICE_CACHE_TTL = 45 * 60 * 1000 // 45 minutes

export interface JitaPrice {
  buy: number
  sell: number
  updatedAt: number
}

/**
 * Robust, persistent market price fetcher for Jita.
 * 1. Checks SdeCache (Postgres) first.
 * 2. Fetches missing/expired items from ESI.
 * 3. Fallback: If ESI fails, returns the last known value from cache (even if expired).
 * 4. Ensures prices never drop to 0 during transient ESI errors.
 */
export async function getJitaPricesPersistent(typeIds: number[]): Promise<Record<number, JitaPrice>> {
  const now = Date.now()
  const uniqueIds = Array.from(new Set(typeIds))
  const results: Record<number, JitaPrice> = {}
  
  if (uniqueIds.length === 0) return results

  // 1. Fetch all existing cache entries from DB
  const cacheKeys = uniqueIds.map(id => `price_jita_${id}`)
  const cachedEntries = await prisma.sdeCache.findMany({
    where: { key: { in: cacheKeys } }
  })

  const cacheMap = new Map<number, JitaPrice>()
  cachedEntries.forEach(entry => {
    const typeId = parseInt(entry.key.replace('price_jita_', ''))
    cacheMap.set(typeId, entry.value as unknown as JitaPrice)
  })

  const missingOrExpiredIds: number[] = []

  // 2. Separate IDs into "fresh from cache" and "need ESI"
  uniqueIds.forEach(id => {
    const cached = cacheMap.get(id)
    if (cached && (now - cached.updatedAt < PRICE_CACHE_TTL)) {
      results[id] = cached
    } else {
      missingOrExpiredIds.push(id)
    }
  })

  if (missingOrExpiredIds.length === 0) {
    return results
  }

  // 3. Fetch missing/expired from ESI in parallel
  // esiClient has internal concurrency control (MAX_CONCURRENT_REQUESTS = 20)
  await Promise.all(
    missingOrExpiredIds.map(async (typeId) => {
      try {
        const [buyRes, sellRes] = await Promise.all([
          esiClient.get(`/markets/${JITA_REGION_ID}/orders/?type_id=${typeId}&order_type=buy`),
          esiClient.get(`/markets/${JITA_REGION_ID}/orders/?type_id=${typeId}&order_type=sell`)
        ])

        const buyOrders = buyRes.data || []
        const sellOrders = sellRes.data || []

        const bestBuy = buyOrders.length > 0 ? Math.max(...buyOrders.map((o: any) => o.price)) : 0
        const bestSell = sellOrders.length > 0 ? Math.min(...sellOrders.map((o: any) => o.price)) : 0

        const newPrice: JitaPrice = {
          buy: bestBuy,
          sell: bestSell,
          updatedAt: now
        }

        // Store in DB
        await prisma.sdeCache.upsert({
          where: { key: `price_jita_${typeId}` },
          create: {
            key: `price_jita_${typeId}`,
            value: newPrice as any,
            expiresAt: new Date(now + PRICE_CACHE_TTL)
          },
          update: {
            value: newPrice as any,
            expiresAt: new Date(now + PRICE_CACHE_TTL)
          }
        })

        results[typeId] = newPrice
      } catch (error) {
        const cached = cacheMap.get(typeId)
        if (cached) {
          logger.warn('MARKET_PRICE', `ESI error for ${typeId}, falling back to expired cache`, error)
          results[typeId] = cached // Fallback to expired cache
        } else {
          logger.error('MARKET_PRICE', `ESI error for ${typeId} and no cache available`, error)
          results[typeId] = { buy: 0, sell: 0, updatedAt: 0 }
        }
      }
    })
  )

  return results
}
