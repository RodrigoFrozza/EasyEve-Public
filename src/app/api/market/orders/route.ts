import { NextResponse } from 'next/server'
import { ESI_BASE_URL, USER_AGENT, MarketOrder } from '@/lib/constants/market'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

const STATION_NAMES: Record<number, string> = {
  60003760: 'Jita IV - Moon 4 - Caldari Navy Assembly Plant',
  60003496: 'Tama IV - Moon 2 - Republic Fleet Assembly Plant',
  60004588: 'Rens VIII - Moon 8 - Brutor Tribe Treasury',
  60005686: 'Hek VIII - Moon 12 - Superiority Shipyard',
  60003459: 'Aldrat III - Lunar Facilities',
  60008452: 'Inamaro III - Astral Trade Center',
  60001521: 'M-OEE8 Tantara - Wiyrkioeskoons Space Center',
  60003754: 'Perimeter II - Perword Finance Course',
  60003755: 'Perimeter III - Perword Reactor',
  60003756: 'Perimeter IV - Perword Logistics',
  60003757: 'Perimeter V - Perword Storage',
  60003758: 'Perimeter VI - Perword Provisioning',
  60003759: 'Perimeter VII - Perword Shipyard',
  60012532: '0. Unrefitted - Neutral Sentry Hub',
  60014816: 'Oursulaert VII - Moon 7 - Federal Navy Academy',
  60014938: 'Cistuvaert V - Center for Advanced Studies School',
  60014842: 'Villasen VII - Lai Dai Protection Service Logistic Support',
}

function getStationName(locationId: number): string {
  return STATION_NAMES[locationId] || `Station ${locationId}`
}

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

    let sellOrders: any[] = []
    let buyOrders: any[] = []

    if (sellRes.ok) {
      const data = await sellRes.json()
      sellOrders = Array.isArray(data) ? data : []
    }

    if (buyRes.ok) {
      const data = await buyRes.json()
      buyOrders = Array.isArray(data) ? data : []
    }

    const toMarketOrder = (o: any): MarketOrder => ({
      is_buy_order: o.is_buy_order,
      price: o.price,
      volume_remain: o.volume_remain,
      volume_total: o.volume_total,
      location_id: o.location_id,
      location_name: getStationName(o.location_id),
      type_id: o.type_id,
      order_id: o.order_id,
      duration: o.duration,
      escrow: o.escrow || 0,
      range: o.range || 'region',
      region_id: region,
      created_at: o.created_at
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
      }
    })
  } catch (error) {
    console.error('GET /api/market/orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market orders' },
      { status: 500 }
    )
  }
}