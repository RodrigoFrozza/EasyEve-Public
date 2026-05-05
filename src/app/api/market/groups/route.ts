import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ESI_BASE_URL, USER_AGENT, MarketGroupNode } from '@/lib/constants/market'
import { batchPromiseAll } from '@/lib/utils'
import { logger } from '@/lib/server-logger'
import { esiClient } from '@/lib/esi-client'

export const dynamic = 'force-dynamic'

import { buildMarketGroupTree } from '@/lib/market-groups'

export async function GET() {
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

    const cacheKey = 'market_groups_tree'
    const now = new Date()
    
    const cached = await prisma.sdeCache.findUnique({
      where: { key: cacheKey }
    })

    if (cached && cached.expiresAt && cached.expiresAt > now) {
      return NextResponse.json(cached.value as any)
    }

    const groupIdsRes = await esiClient.get('/markets/groups/')
    const groupIds: number[] = groupIdsRes.data

    const filteredIds = groupIds.filter(id => id < 3000)

    logger.info('MarketGroups', `Fetching ${filteredIds.length} groups...`)

    const tree = await buildMarketGroupTree(filteredIds)

    const cacheValue = { groups: tree, total: groupIds.length }
    
    await prisma.sdeCache.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        value: cacheValue as any,
        expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24)
      },
      update: {
        value: cacheValue as any,
        expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24)
      }
    })

    return NextResponse.json(cacheValue)
  } catch (error: unknown) {
    logger.error('MarketGroups', 'GET /api/market/groups error', { error })
    return NextResponse.json(
      { error: 'Failed to fetch market groups' },
      { status: 500 }
    )
  }
}