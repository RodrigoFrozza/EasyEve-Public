import { NextResponse } from 'next/server'
import { ESI_BASE_URL, USER_AGENT, MarketOrder } from '@/lib/constants/market'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'
import { resolveStationNames } from '@/lib/market-station-names'
import { getStructureOrdersForType } from '@/lib/pi/structure-market'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

export async function GET(request: Request) {
  try {
    // Check module availability
    const marketModule = await prisma.modulePrice.findUnique({
      where: { module: 'market' }
    })

    if (marketModule && !marketModule.isActive) {
      return NextResponse.json(
        { error: 'Market Browser is currently disabled' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const regionId = searchParams.get('region')
    const typeId = searchParams.get('typeId')
    const structureId = searchParams.get('structureId')
    const page = parseInt(searchParams.get('page') || '1', 10)

    if (!regionId || !typeId) {
      return NextResponse.json(
        { error: 'region and typeId are required' },
        { status: 400 }
      )
    }

    const region = parseInt(regionId, 10)
    const type = parseInt(typeId, 10)

    if (isNaN(region) || isNaN(type)) {
      return NextResponse.json(
        { error: 'Invalid region or typeId' },
        { status: 400 }
      )
    }

    let sellOrders: any[] = []
    let buyOrders: any[] = []
    let structureError: string | null = null

    if (structureId) {
      // Private structure market — requires a logged-in user with a character
      // that has docking/market access. Falls back to the region market below
      // (with an explicit error surfaced to the client) rather than silently
      // showing nothing.
      const user = await getCurrentUser()
      if (!user) {
        structureError = 'Sign in to check a private structure\'s orders.'
      } else {
        const characterIds = user.characters.map((c) => c.id)
        const rows = await getStructureOrdersForType(structureId, characterIds, type)
        if (rows == null) {
          structureError = 'None of your characters have docking access to that structure.'
        } else {
          sellOrders = rows.filter((o) => !o.is_buy_order)
          buyOrders = rows.filter((o) => o.is_buy_order)
        }
      }
    }

    if (!structureId || structureError) {
      const [sellRes, buyRes] = await Promise.all([
        fetch(
          `${ESI_BASE_URL}/markets/${region}/orders/?datasource=tranquility&order_type=sell&type_id=${type}`,
          { headers: { 'User-Agent': USER_AGENT } }
        ),
        fetch(
          `${ESI_BASE_URL}/markets/${region}/orders/?datasource=tranquility&order_type=buy&type_id=${type}`,
          { headers: { 'User-Agent': USER_AGENT } }
        )
      ])

      if (sellRes.ok) {
        const data = await sellRes.json()
        sellOrders = Array.isArray(data) ? data : []
      }

      if (buyRes.ok) {
        const data = await buyRes.json()
        buyOrders = Array.isArray(data) ? data : []
      }
    }

    const allLocationIds = [...sellOrders, ...buyOrders].map((o) => o.location_id)
    const stationNames = await resolveStationNames(allLocationIds)

    const toMarketOrder = (o: any): MarketOrder => ({
      is_buy_order: o.is_buy_order,
      price: o.price,
      volume_remain: o.volume_remain,
      volume_total: o.volume_total,
      location_id: o.location_id,
      location_name: stationNames[o.location_id] || `Station ${o.location_id}`,
      type_id: type,
      order_id: o.order_id,
      duration: o.duration,
      escrow: o.escrow || 0,
      range: o.range || 'region',
      region_id: region,
      created_at: o.created_at ?? o.issued ?? ''
    })

    const sellSorted = sellOrders
      .sort((a, b) => a.price - b.price)
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map(toMarketOrder)

    const buySorted = buyOrders
      .sort((a, b) => b.price - a.price)
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map(toMarketOrder)

    const totalPages = Math.ceil(Math.max(sellOrders.length, buyOrders.length) / PAGE_SIZE)

    return NextResponse.json({
      sell: sellSorted,
      buy: buySorted,
      totals: {
        sell: sellOrders.length,
        buy: buyOrders.length
      },
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        totalPages,
        hasMore: page < totalPages
      },
      structureError
    })
  } catch (error) {
    console.error('GET /api/market/orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market orders' },
      { status: 500 }
    )
  }
}
