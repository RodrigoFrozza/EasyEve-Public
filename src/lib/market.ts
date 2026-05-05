

import { batchPromiseAll } from './utils'
import { esiClient } from './esi-client'
import { logger } from './server-logger'

// Simple In-memory cache for market prices (Jita 4-4 Sell)
const priceCache: Map<string, { price: number, expires: number }> = new Map()
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours
const MAX_CACHE_SIZE = 2000 // Cap memory usage for the cache

const JITA_REGION_ID = 10000002
const JITA_44_STATION_ID = 60003760

interface InventoryItem {
  id: number
  name: string
  category?: string
}

interface MarketOrder {
  order_id: number
  type_id: number
  location_id: number
  volume_total: number
  volume_remain: number
  min_volume: number
  price: number
  is_buy_order: boolean
  duration: number
  issued: string
  range: string
}

interface MarketPrice {
  type_id: number
  average_price?: number
  adjusted_price?: number
}

export interface MarketAppraisalDetail {
  typeId: number
  unitPrice: number
  buyPrice: number
  sellPrice: number
  source: 'jita_buy' | 'jita_sell' | 'not_found'
  liquidity: number
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}


// Internal core function to avoid duplication
async function fetchMarketDataInternal(itemNames: string[]): Promise<Record<string, { price: number, id: number }>> {
  if (!itemNames || itemNames.length === 0) return {}

  const items = Array.from(new Set(itemNames.filter(i => i && i.length > 1).map(i => i.trim().toLowerCase())))
  const results: Record<string, { price: number, id: number }> = {}
  const now = Date.now()
  const missingItems: string[] = []

  // 1. Resolve IDs first (we always need IDs for prices)
  const missingItemChunks = chunkArray(items, 500)
  let inventoryItems: InventoryItem[] = []

  for (const chunk of missingItemChunks) {
    try {
      const idRes = await esiClient.post(`/universe/ids/?datasource=tranquility&language=en`, chunk)
      if (idRes.data.inventory_types) {
        inventoryItems = [...inventoryItems, ...idRes.data.inventory_types]
      }
    } catch (e: unknown) { 
      logger.error('Market', 'ESI ID Resolution Error', { error: e })
    }
  }

  if (inventoryItems.length === 0) return {}

  // 2. Map IDs and identify items that need price lookup
  const itemsToFetchPrices: InventoryItem[] = []
  inventoryItems.forEach(item => {
    const lowerName = item.name.toLowerCase()
    const cached = priceCache.get(lowerName)
    
    if (cached && cached.expires > now) {
      results[lowerName] = { price: cached.price, id: item.id }
    } else {
      results[lowerName] = { price: 0, id: item.id }
      itemsToFetchPrices.push(item)
    }
  })

  if (itemsToFetchPrices.length === 0) return results

  // 3. Fetch Prices with concurrency limit
  const CONCURRENCY_LIMIT = 15
  await batchPromiseAll(itemsToFetchPrices, CONCURRENCY_LIMIT, async (item: InventoryItem) => {
    try {
      const lowerName = item.name.toLowerCase()
      const orderRes = await esiClient.get(`/markets/${JITA_REGION_ID}/orders/?datasource=tranquility&order_type=all&type_id=${item.id}`)
      
      const orders: MarketOrder[] = orderRes.data
      const stationOrders = orders.filter(o => o.location_id === JITA_44_STATION_ID)
      
      let price = 0
      const buyOrders = stationOrders.filter(o => o.is_buy_order)
      const sellOrders = stationOrders.filter(o => !o.is_buy_order)

      if (buyOrders.length > 0) {
        price = Math.max(...buyOrders.map(o => o.price))
      } else if (sellOrders.length > 0) {
        price = Math.min(...sellOrders.map(o => o.price))
      }

      if (price === 0) {
        const priceRes = await esiClient.get(`/markets/prices/`)
        const globalPrices: MarketPrice[] = priceRes.data
        const globalItem = globalPrices.find(p => p.type_id === item.id)
        if (globalItem) {
          price = globalItem.average_price || globalItem.adjusted_price || 0
        }
      }

      if (price > 0) {
        results[lowerName].price = price
        priceCache.set(lowerName, { price, expires: now + CACHE_TTL })
        
        // Simple LRU: remove oldest entry if over size limit
        if (priceCache.size > MAX_CACHE_SIZE) {
          const firstKey = priceCache.keys().next().value
          if (firstKey) priceCache.delete(firstKey)
        }
      }
    } catch (err: unknown) {
      logger.error('Market', `Appraisal error for ${item.name}`, { error: err })
    }
  })

  return results
}

export async function getMarketAppraisal(itemNames: string[]): Promise<Record<string, number>> {
  const data = await fetchMarketDataInternal(itemNames)
  const results: Record<string, number> = {}
  Object.entries(data).forEach(([name, info]) => {
    results[name] = info.price
  })
  return results
}

export async function getMarketAppraisalWithIds(itemNames: string[]): Promise<Record<string, { price: number, id: number }>> {
  return fetchMarketDataInternal(itemNames)
}

export async function getMarketAppraisalDetailed(itemNames: string[]): Promise<Record<string, MarketAppraisalDetail>> {
  if (!itemNames || itemNames.length === 0) return {}

  const idsData = await fetchMarketDataInternal(itemNames)
  const result: Record<string, MarketAppraisalDetail> = {}

  // Fetch all orders in parallel with higher concurrency
  await batchPromiseAll(
    Object.entries(idsData),
    30, // Increased concurrency for faster lookups
    async ([name, info]) => {
      try {
        const orderRes = await esiClient.get(`/markets/${JITA_REGION_ID}/orders/?datasource=tranquility&order_type=all&type_id=${info.id}`)
        const orders: MarketOrder[] = orderRes.data || []
        const stationOrders = orders.filter((o) => o.location_id === JITA_44_STATION_ID)
        const buyOrders = stationOrders.filter((o) => o.is_buy_order)
        const sellOrders = stationOrders.filter((o) => !o.is_buy_order)
        const buyPrice = buyOrders.length > 0 ? Math.max(...buyOrders.map((o) => o.price)) : 0
        const sellPrice = sellOrders.length > 0 ? Math.min(...sellOrders.map((o) => o.price)) : 0
        const source: MarketAppraisalDetail['source'] = buyPrice > 0 ? 'jita_buy' : sellPrice > 0 ? 'jita_sell' : 'not_found'
        const unitPrice = source === 'jita_buy' ? buyPrice : source === 'jita_sell' ? sellPrice : 0
        const liquidity = stationOrders.reduce((sum, o) => sum + (o.volume_remain || 0), 0)

        result[name] = {
          typeId: info.id,
          unitPrice,
          buyPrice,
          sellPrice,
          source,
          liquidity,
        }
      } catch {
        result[name] = {
          typeId: info.id,
          unitPrice: 0,
          buyPrice: 0,
          sellPrice: 0,
          source: 'not_found',
          liquidity: 0,
        }
      }
    }
  )

  return result
}

