import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { esiClient, getMiningTypes } from '@/lib/sde'
import { withErrorHandling } from '@/lib/api-handler'
import { filterMiningTypesBySpace } from '@/lib/mining-ore-space-filter'
import { resolveMiningUnitPrice } from '@/lib/mining-price-resolution'

const JITA_REGION_ID = 10000002 // The Forge

interface MarketOrder {
  is_buy_order: boolean
  price: number
  volume_remain: number
  type_id: number
}

// Simple in-memory cache for Jita prices (15 min)
const priceCache: Map<string, { prices: Record<number, { buy: number; sell: number }>; timestamp: number }> = new Map()
const PRICE_CACHE_TTL = 15 * 60 * 1000

async function getJitaPrices(typeIds: number[]): Promise<Record<number, { buy: number; sell: number }>> {
  const now = Date.now()
  const cacheKey = `jita-${typeIds.sort((a, b) => a - b).join(',')}`

  const cached = priceCache.get(cacheKey)
  if (cached && now - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.prices
  }

  const priceMap: Record<number, { buy: number; sell: number }> = {}

  const BATCH_SIZE = 10
  const BATCH_DELAY_MS = 500
  for (let i = 0; i < typeIds.length; i += BATCH_SIZE) {
    const batch = typeIds.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (typeId) => {
        try {
          const [buyRes, sellRes] = await Promise.all([
            esiClient.get<MarketOrder[]>(`/markets/${JITA_REGION_ID}/orders/?type_id=${typeId}&order_type=buy`),
            esiClient.get<MarketOrder[]>(`/markets/${JITA_REGION_ID}/orders/?type_id=${typeId}&order_type=sell`),
          ])
          const buyOrders = buyRes.data
          const sellOrders = sellRes.data

          const validBuyOrders = (buyOrders || []).filter((o: MarketOrder) => o.volume_remain > 0)
          const validSellOrders = (sellOrders || []).filter((o: MarketOrder) => o.volume_remain > 0)

          const bestBuy = validBuyOrders.length > 0 ? Math.max(...validBuyOrders.map((o: MarketOrder) => o.price)) : 0
          const bestSell = validSellOrders.length > 0 ? Math.min(...validSellOrders.map((o: MarketOrder) => o.price)) : 0

          if (bestBuy > 0 || bestSell > 0) {
            priceMap[typeId] = { buy: bestBuy, sell: bestSell }
          }
        } catch (error) {
          console.error(`Error fetching price for type ${typeId}:`, error)
        }
      })
    )
    
    if (i + BATCH_SIZE < typeIds.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  priceCache.set(cacheKey, { prices: priceMap, timestamp: now })

  return priceMap
}

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const miningType = searchParams.get('type') as 'Ore' | 'Ice' | 'Gas' | 'Moon' | null
  const space = searchParams.get('space') || undefined

  if (!miningType) {
    return NextResponse.json({ error: 'Mining type is required' }, { status: 400 })
  }

  let types = await getMiningTypes(miningType)
  types = filterMiningTypesBySpace(types, miningType, space)

  if (types.length === 0) {
    return NextResponse.json([])
  }

  const typeIds = types.map((t) => t.id)

  const isIce = miningType === 'Ice'
  let compressedMap: Record<number, number> = {}
  let compressedTypeIds: number[] = []

  if (!isIce) {
    const compressedOres = await prisma.eveType.findMany({
      where: {
        name: { in: types.map((t) => `Compressed ${t.name}`) },
      },
      select: { id: true, name: true },
    })

    compressedOres.forEach((co) => {
      const originalName = co.name.replace('Compressed ', '')
      const original = types.find((t) => t.name === originalName)
      if (original) {
        compressedMap[original.id] = co.id
        compressedTypeIds.push(co.id)
      }
    })
  }

  const allIdsToFetch = Array.from(new Set([...typeIds, ...compressedTypeIds]))
  const prices = await getJitaPrices(allIdsToFetch)

  const result = types.map((t) => {
    const rawBuy = prices[t.id]?.buy || 0
    const rawSell = prices[t.id]?.sell || 0
    const compressedTypeId = compressedMap[t.id]
    const compressedBuy = compressedTypeId ? prices[compressedTypeId]?.buy || 0 : 0
    const compressedSell = compressedTypeId ? prices[compressedTypeId]?.sell || 0 : 0

    const { unitPrice, basis, confidence } = resolveMiningUnitPrice({
      isIceMiningCategory: isIce,
      rawBuy,
      rawSell,
      compressedBuy,
      compressedSell,
    })

    return {
      ...t,
      rawBuy,
      rawSell,
      compressedBuy: compressedTypeId ? compressedBuy : 0,
      compressedSell: compressedTypeId ? compressedSell : 0,
      compressedTypeId: compressedTypeId || null,
      /** Legacy field: chosen unit price for sorting / display */
      buy: unitPrice,
      sell: rawSell,
      priceBasis: basis,
      priceConfidence: confidence,
      unitRatio: isIce ? 1 : 100,
    }
  })

  result.sort((a, b) => (b.buy || 0) - (a.buy || 0))

  return NextResponse.json(result)
})
