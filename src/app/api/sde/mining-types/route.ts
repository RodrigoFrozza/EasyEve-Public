import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { esiClient, getMiningTypes } from '@/lib/sde'
import { withErrorHandling } from '@/lib/api-handler'
import { logger } from '@/lib/server-logger'
import { filterMiningTypesBySpace } from '@/lib/mining-ore-space-filter'
import { resolveMiningUnitPrice, calculateRefinedUnitPrice } from '@/lib/mining-price-resolution'
import { getJitaPricesPersistent } from '@/lib/market-prices'

const JITA_REGION_ID = 10000002 // The Forge

import { getReprocessingYield, MINERALS, ICE_PRODUCTS } from '@/lib/mining-reprocessing-yields'

interface MarketOrder {
  is_buy_order: boolean
  price: number
  volume_remain: number
  type_id: number
}

// Using persistent prices from @/lib/market-prices

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const miningType = searchParams.get('type') as 'Ore' | 'Ice' | 'Gas' | 'Moon' | null
  const space = searchParams.get('space') || undefined

  if (!miningType) {
    return NextResponse.json({ error: 'Mining type is required' }, { status: 400 })
  }

  let types = await getMiningTypes(miningType)
  
  // Filter by space (Highsec, Lowsec, etc.)
  types = filterMiningTypesBySpace(types, miningType, space)

  if (types.length === 0) {
    return NextResponse.json([])
  }

  // 1. Prepare mineral/product IDs to fetch
  const mineralIds = Object.values(MINERALS)
  const iceProductIds = Object.values(ICE_PRODUCTS)
  const supportItemIds = Array.from(new Set([...mineralIds, ...iceProductIds]))

  // 2. Prepare compressed variants
  const isIce = miningType === 'Ice'
  let compressedMap: Record<number, number> = {}
  let compressedTypeIds: number[] = []

  if (!isIce) {
    const compressedOres = await prisma.eveType.findMany({
      where: {
        OR: [
          { name: { in: types.map((t) => `Compressed ${t.name}`) } },
          { name: { in: types.map((t) => `Compressed ${t.name.replace('Batch ', '')}`) } }
        ]
      },
      select: { id: true, name: true },
    })

    compressedOres.forEach((co) => {
      // Handle both "Compressed [Name]" and "Compressed [BaseName]"
      const cleanName = co.name.replace('Compressed ', '')
      const original = types.find((t) => t.name === cleanName)
      if (original) {
        compressedMap[original.id] = co.id
        compressedTypeIds.push(co.id)
      }
    })
  }

  // 3. Batch fetch ALL needed prices
  const oreIds = types.map(t => t.id)
  const allIdsToFetch = Array.from(new Set([...oreIds, ...compressedTypeIds, ...supportItemIds]))
  
  let allPrices: Record<number, { buy: number; sell: number }> = {}
  try {
    allPrices = await getJitaPricesPersistent(allIdsToFetch)
  } catch (err) {
    console.error('Failed to fetch Jita prices:', err)
  }

  // 4. Calculate refined values and construct result
  const result = types.map((t) => {
    const rawBuy = allPrices[t.id]?.buy || 0
    const rawSell = allPrices[t.id]?.sell || 0
    
    const compressedTypeId = compressedMap[t.id]
    const compressedBuy = compressedTypeId ? allPrices[compressedTypeId]?.buy || 0 : 0
    const compressedSell = compressedTypeId ? allPrices[compressedTypeId]?.sell || 0 : 0

    // Refined calculation (standardized to unit price)
    const yields = getReprocessingYield(t.name)
    const materialYields = yields.map((y) => ({ materialId: y.mineralId, quantity: y.quantity }))

    const refinedBuy = calculateRefinedUnitPrice(
      materialYields,
      Object.fromEntries(Object.entries(allPrices).map(([id, p]) => [id, p.buy || p.sell || 0])),
      isIce
    )
    const refinedSell = calculateRefinedUnitPrice(
      materialYields,
      Object.fromEntries(Object.entries(allPrices).map(([id, p]) => [id, p.sell || p.buy || 0])),
      isIce
    )

    // Resolve unit prices for all 3 states
    const rawRes = resolveMiningUnitPrice({
      isIceMiningCategory: isIce,
      rawBuy,
      rawSell,
      compressedBuy: 0,
      compressedSell: 0,
    })

    const compRes = resolveMiningUnitPrice({
      isIceMiningCategory: isIce,
      rawBuy: 0,
      rawSell: 0,
      compressedBuy,
      compressedSell,
    })

    const refRes = resolveMiningUnitPrice({
      isIceMiningCategory: isIce,
      rawBuy: refinedBuy,
      rawSell: refinedSell,
      compressedBuy: 0,
      compressedSell: 0,
    })

    return {
      ...t,
      raw: { price: rawRes.unitPrice, basis: rawRes.basis },
      compressed: { price: compRes.unitPrice, basis: compRes.basis, typeId: compressedTypeId || null },
      refined: { price: refRes.unitPrice, basis: refRes.basis },
      
      // Legacy compatibility fields
      buy: rawRes.unitPrice,
      sell: rawSell,
      priceBasis: rawRes.basis,
      priceConfidence: rawRes.confidence,
      unitRatio: isIce ? 1 : 100,
      volume: t.volume || 0,
    }
  })

  // Sort by highest refined value by default
  result.sort((a, b) => (b.refined.price || 0) - (a.refined.price || 0))

  return NextResponse.json(result)
})

