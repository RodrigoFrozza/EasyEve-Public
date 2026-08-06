import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { esiClient, getMiningTypes } from '@/lib/sde'
import { withErrorHandling } from '@/lib/api-handler'
import { logger } from '@/lib/server-logger'
import { filterMiningTypesBySpace } from '@/lib/mining-ore-space-filter'
import { resolveMiningUnitPrice, calculateRefinedUnitPrice } from '@/lib/mining-price-resolution'
import { resolvePriceSide, buildReprocessingProductPrices } from '@/lib/mining-session-valuation'
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
  const typeIdsParam = searchParams.get('typeIds')

  if (!miningType && !typeIdsParam) {
    return NextResponse.json({ error: 'Mining type is required' }, { status: 400 })
  }

  let types: { id: number; name: string; volume: number; groupId?: number }[] = []
  let resolvedMiningType = miningType || 'Ore'

  if (typeIdsParam) {
    const ids = typeIdsParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)

    if (ids.length > 0) {
      types = (await prisma.eveType.findMany({
        where: { id: { in: ids }, published: true },
        select: { id: true, name: true, volume: true, groupId: true },
        orderBy: { name: 'asc' },
      })).map((t) => ({ ...t, volume: t.volume ?? 0 }))
    }

    if (!miningType && types.length > 0) {
      const hasIce = types.some((t) => t.groupId === 465 || t.groupId === 903)
      if (hasIce) resolvedMiningType = 'Ice'
    }
  }

  if (types.length === 0) {
    if (!miningType) {
      return NextResponse.json([])
    }
    types = await getMiningTypes(miningType)
    types = filterMiningTypesBySpace(types, miningType, space)
    resolvedMiningType = miningType
  } else if (miningType) {
    resolvedMiningType = miningType
  }

  if (types.length === 0) {
    return NextResponse.json([])
  }

  // 1. Prepare mineral/product IDs to fetch
  const mineralIds = Object.values(MINERALS)
  const iceProductIds = Object.values(ICE_PRODUCTS)
  const supportItemIds = Array.from(new Set([...mineralIds, ...iceProductIds]))

  // 2. Prepare compressed variants
  const isIce = resolvedMiningType === 'Ice'
  let compressedMap: Record<number, number> = {}
  let compressedVolumeMap: Record<number, number> = {}
  let compressedTypeIds: number[] = []

  if (!isIce) {
    const compressedOres = await prisma.eveType.findMany({
      where: {
        OR: [
          { name: { in: types.map((t) => `Compressed ${t.name}`) } },
          { name: { in: types.map((t) => `Compressed ${t.name.replace('Batch ', '')}`) } }
        ]
      },
      select: { id: true, name: true, volume: true },
    })

    compressedOres.forEach((co) => {
      // Handle both "Compressed [Name]" and "Compressed [BaseName]"
      const cleanName = co.name.replace('Compressed ', '')
      const original = types.find((t) => t.name === cleanName)
      if (original) {
        compressedMap[original.id] = co.id
        compressedVolumeMap[original.id] = co.volume || 0
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

    const reprocessingProducts = buildReprocessingProductPrices(t.name, allPrices)

    const rawSplit = resolvePriceSide(rawBuy, rawSell, 'split')
    const refinedSplit = resolvePriceSide(refinedBuy, refinedSell, 'split')
    const compBuy = compressedBuy
    const compSell = compressedSell
    const compSplit = resolvePriceSide(compBuy, compSell, 'split')

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
      raw: {
        price: rawRes.unitPrice,
        buy: rawBuy || rawSell,
        sell: rawSell || rawBuy,
        split: rawSplit,
        basis: rawRes.basis,
      },
      compressed: {
        price: compRes.unitPrice,
        buy: compBuy || compSell,
        sell: compSell || compBuy,
        split: compSplit,
        basis: compRes.basis,
        typeId: compressedTypeId || null,
        volume: compressedTypeId ? compressedVolumeMap[t.id] ?? 0 : 0,
      },
      refined: {
        price: refRes.unitPrice,
        buy: refinedBuy,
        sell: refinedSell,
        split: refinedSplit,
        basis: refRes.basis,
      },
      reprocessingProducts,
      
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

