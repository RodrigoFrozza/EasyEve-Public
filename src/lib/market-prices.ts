import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'
import { withEsiRetry } from '@/lib/esi-retry'
import {
  JITA_REGION_ID,
  JITA_TRADE_HUB_LOCATION_IDS,
} from '@/lib/constants/market'

const PRICE_CACHE_TTL = 45 * 60 * 1000 // 45 minutes
const PRICE_CACHE_KEY_PREFIX = 'price_jita_hub_'
const MAX_ORDER_PAGES = 50

export interface JitaPrice {
  buy: number
  sell: number
  updatedAt: number
}

export interface MarketOrderQuote {
  price: number
  location_id: number
  volume: number
}

export function resolveJitaBuySellFromOrderSets(
  buyOrders: MarketOrderQuote[],
  sellOrders: MarketOrderQuote[]
): { buy: number; sell: number } {
  const hubBuy = buyOrders.filter((o) => JITA_TRADE_HUB_LOCATION_IDS.has(o.location_id))
  const hubSell = sellOrders.filter((o) => JITA_TRADE_HUB_LOCATION_IDS.has(o.location_id))
  const scopedBuy = hubBuy.length > 0 ? hubBuy : buyOrders
  const scopedSell = hubSell.length > 0 ? hubSell : sellOrders

  const buy = scopedBuy.length > 0 ? Math.max(...scopedBuy.map((o) => o.price)) : 0
  const sell = scopedSell.length > 0 ? Math.min(...scopedSell.map((o) => o.price)) : 0

  return { buy, sell }
}

export interface MarketOrderLevel {
  price: number
  volume: number
}

export interface OrderBookFill {
  requestedQty: number
  filledQty: number
  sufficient: boolean
  /** Volume-weighted average unit price over the filled portion (0 if empty). */
  avgUnitPrice: number
  /** Best (top-of-book) unit price, for display / fallback. */
  bestUnitPrice: number
}

/**
 * Walk a pre-sorted order book (best price first — sell ascending / buy
 * descending) to fill `requestedQty`, returning the volume-weighted average unit
 * price actually paid/received and whether the book had enough depth.
 *
 * This is the core of real pricing: a single top-of-book reference price hides
 * thin markets. A book with 210 units against a demand of thousands surfaces
 * here as `sufficient: false` instead of a misleadingly cheap price.
 */
export function fillFromOrders(
  orders: MarketOrderLevel[],
  requestedQty: number
): OrderBookFill {
  const bestUnitPrice = orders[0]?.price ?? 0
  if (requestedQty <= 0) {
    return {
      requestedQty: 0,
      filledQty: 0,
      sufficient: true,
      avgUnitPrice: bestUnitPrice,
      bestUnitPrice,
    }
  }

  let remaining = requestedQty
  let cost = 0
  let filled = 0
  for (const level of orders) {
    if (remaining <= 1e-9) break
    if (level.volume <= 0) continue
    const take = Math.min(remaining, level.volume)
    cost += take * level.price
    filled += take
    remaining -= take
  }

  return {
    requestedQty,
    filledQty: filled,
    sufficient: filled >= requestedQty - 1e-6,
    avgUnitPrice: filled > 0 ? cost / filled : 0,
    bestUnitPrice,
  }
}

async function fetchAllMarketOrders(
  regionId: number,
  typeId: number,
  orderType: 'buy' | 'sell'
): Promise<MarketOrderQuote[]> {
  const allOrders: MarketOrderQuote[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && page <= MAX_ORDER_PAGES) {
    const res = await withEsiRetry(() =>
      esiClient.get(`/markets/${regionId}/orders/`, {
        params: { type_id: typeId, order_type: orderType, page },
      })
    )

    const data = Array.isArray(res.data) ? res.data : []
    totalPages = parseInt(String(res.headers['x-pages'] ?? '1'), 10) || 1

    allOrders.push(
      ...data.map((o: { price: number; location_id: number; volume_remain?: number }) => ({
        price: o.price,
        location_id: o.location_id,
        volume: Number(o.volume_remain ?? 0),
      }))
    )

    if (data.length === 0) break
    page += 1
  }

  return allOrders
}

/**
 * Robust, persistent market price fetcher for Jita trade hubs.
 * 1. Checks SdeCache (Postgres) first.
 * 2. Fetches all ESI order pages for buy/sell at Jita hubs (4-4 + Perimeter).
 * 3. Fallback: If ESI fails, returns the last known value from cache (even if expired).
 */
export async function getJitaPricesPersistent(typeIds: number[]): Promise<Record<number, JitaPrice>> {
  const now = Date.now()
  const uniqueIds = Array.from(new Set(typeIds))
  const results: Record<number, JitaPrice> = {}

  if (uniqueIds.length === 0) return results

  const cacheKeys = uniqueIds.map((id) => `${PRICE_CACHE_KEY_PREFIX}${id}`)
  const cachedEntries = await prisma.sdeCache.findMany({
    where: { key: { in: cacheKeys } },
  })

  const cacheMap = new Map<number, JitaPrice>()
  cachedEntries.forEach((entry) => {
    const typeId = parseInt(entry.key.replace(PRICE_CACHE_KEY_PREFIX, ''), 10)
    cacheMap.set(typeId, entry.value as unknown as JitaPrice)
  })

  const missingOrExpiredIds: number[] = []

  uniqueIds.forEach((id) => {
    const cached = cacheMap.get(id)
    if (cached && now - cached.updatedAt < PRICE_CACHE_TTL) {
      results[id] = cached
    } else {
      missingOrExpiredIds.push(id)
    }
  })

  if (missingOrExpiredIds.length === 0) {
    return results
  }

  await Promise.all(
    missingOrExpiredIds.map(async (typeId) => {
      const cacheKey = `${PRICE_CACHE_KEY_PREFIX}${typeId}`
      try {
        const [buyOrders, sellOrders] = await Promise.all([
          fetchAllMarketOrders(JITA_REGION_ID, typeId, 'buy'),
          fetchAllMarketOrders(JITA_REGION_ID, typeId, 'sell'),
        ])

        const { buy, sell } = resolveJitaBuySellFromOrderSets(buyOrders, sellOrders)

        const cached = cacheMap.get(typeId)

        // An empty order book right now (illiquid/niche item momentarily without
        // orders at the Jita hubs) is not the same as "this item is worthless" —
        // persisting 0 for a full 45min would zero out every colony/valuation that
        // uses it. Both sides empty: keep the last known entry verbatim (leave its
        // timestamp stale so it's retried soon).
        if (buy === 0 && sell === 0 && cached) {
          logger.warn('MARKET_PRICE', `Empty order book for ${typeId}, keeping last known price`)
          results[typeId] = cached
          return
        }

        // One side empty: keep the last known price for just that side. Illiquid PI
        // commodities (P3/P4) often lack orders on one side, and zeroing only that
        // side still corrupts import/export valuations that read buy/sell separately.
        const effectiveBuy = buy === 0 && cached?.buy ? cached.buy : buy
        const effectiveSell = sell === 0 && cached?.sell ? cached.sell : sell
        if ((buy === 0 && effectiveBuy !== 0) || (sell === 0 && effectiveSell !== 0)) {
          logger.warn('MARKET_PRICE', `One-sided empty order book for ${typeId}, keeping last known price for the empty side`)
        }

        const newPrice: JitaPrice = {
          buy: effectiveBuy,
          sell: effectiveSell,
          updatedAt: now,
        }

        await prisma.sdeCache.upsert({
          where: { key: cacheKey },
          create: {
            key: cacheKey,
            value: newPrice as any,
            expiresAt: new Date(now + PRICE_CACHE_TTL),
          },
          update: {
            value: newPrice as any,
            expiresAt: new Date(now + PRICE_CACHE_TTL),
          },
        })

        results[typeId] = newPrice
      } catch (error) {
        const cached = cacheMap.get(typeId)
        if (cached) {
          logger.warn('MARKET_PRICE', `ESI error for ${typeId}, falling back to expired cache`, error)
          results[typeId] = cached
        } else {
          logger.error('MARKET_PRICE', `ESI error for ${typeId} and no cache available`, error)
          results[typeId] = { buy: 0, sell: 0, updatedAt: 0 }
        }
      }
    })
  )

  return results
}

const MARKET_DEPTH_TTL = 20 * 60 * 1000 // 20 min — order books move faster than reference prices
const MARKET_DEPTH_KEY_PREFIX = 'pi_market_depth_'
const MAX_DEPTH_LEVELS = 100
// Same rationale as STRUCT_DEPTH_MAX_FALLBACK_AGE_MS in pi/structure-market.ts: don't
// serve an expired-cache fallback forever if ESI keeps failing — past this bound, drop
// the entry rather than trust a snapshot that may no longer reflect reality.
const MARKET_DEPTH_MAX_FALLBACK_AGE_MS = 24 * 60 * 60 * 1000 // 24h

export interface MarketDepthLevel {
  price: number
  volume: number
  locationId: number
}

export interface MarketDepth {
  /** Sell orders (asks) ascending by price — walk these to BUY inputs. */
  sell: MarketDepthLevel[]
  /** Buy orders (bids) descending by price — walk these to SELL outputs. */
  buy: MarketDepthLevel[]
  updatedAt: number
}

function toSortedDepth(orders: MarketOrderQuote[], side: 'buy' | 'sell'): MarketDepthLevel[] {
  return orders
    .map((o) => ({ price: o.price, volume: o.volume, locationId: o.location_id }))
    .filter((l) => l.volume > 0 && l.price > 0)
    .sort((a, b) => (side === 'sell' ? a.price - b.price : b.price - a.price))
    .slice(0, MAX_DEPTH_LEVELS)
}

/**
 * Real per-region order-book depth (price + volume, best-first) for a set of
 * types, cached in Postgres with fallback to the last known depth on ESI error.
 * Feed the levels to fillFromOrders to price a specific quantity — this is what
 * replaces single top-of-book reference pricing.
 */
export async function getRegionalMarketDepth(
  regionId: number,
  typeIds: number[]
): Promise<Record<number, MarketDepth>> {
  const now = Date.now()
  const uniqueIds = Array.from(new Set(typeIds))
  const results: Record<number, MarketDepth> = {}
  if (uniqueIds.length === 0) return results

  const keyFor = (id: number) => `${MARKET_DEPTH_KEY_PREFIX}${regionId}_${id}`
  const cachedEntries = await prisma.sdeCache.findMany({
    where: { key: { in: uniqueIds.map(keyFor) } },
  })
  const cacheMap = new Map<number, MarketDepth>()
  for (const entry of cachedEntries) {
    const typeId = parseInt(entry.key.replace(`${MARKET_DEPTH_KEY_PREFIX}${regionId}_`, ''), 10)
    if (Number.isFinite(typeId)) cacheMap.set(typeId, entry.value as unknown as MarketDepth)
  }

  const missing: number[] = []
  for (const id of uniqueIds) {
    const cached = cacheMap.get(id)
    if (cached && now - cached.updatedAt < MARKET_DEPTH_TTL) results[id] = cached
    else missing.push(id)
  }
  if (missing.length === 0) return results

  await Promise.all(
    missing.map(async (typeId) => {
      try {
        const [buyOrders, sellOrders] = await Promise.all([
          fetchAllMarketOrders(regionId, typeId, 'buy'),
          fetchAllMarketOrders(regionId, typeId, 'sell'),
        ])
        const depth: MarketDepth = {
          sell: toSortedDepth(sellOrders, 'sell'),
          buy: toSortedDepth(buyOrders, 'buy'),
          updatedAt: now,
        }
        await prisma.sdeCache.upsert({
          where: { key: keyFor(typeId) },
          create: { key: keyFor(typeId), value: depth as any, expiresAt: new Date(now + MARKET_DEPTH_TTL) },
          update: { value: depth as any, expiresAt: new Date(now + MARKET_DEPTH_TTL) },
        })
        results[typeId] = depth
      } catch (error) {
        const cached = cacheMap.get(typeId)
        if (cached && now - cached.updatedAt <= MARKET_DEPTH_MAX_FALLBACK_AGE_MS) {
          logger.warn('MARKET_DEPTH', `ESI error for ${typeId} @ region ${regionId}, using expired cache`, error)
          results[typeId] = cached
        } else {
          logger.error('MARKET_DEPTH', `ESI error for ${typeId} @ region ${regionId}, no cache`, error)
          results[typeId] = { sell: [], buy: [], updatedAt: 0 }
        }
      }
    })
  )

  return results
}
