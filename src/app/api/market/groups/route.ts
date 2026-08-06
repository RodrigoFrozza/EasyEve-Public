import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { MarketGroupNode } from '@/lib/constants/market'
import { buildLocalMarketGroupTree, MarketGroupsEmptyError } from '@/lib/market-groups'

export const dynamic = 'force-dynamic'

// In-memory versioned cache, same pattern as /api/ships/tree: rebuild only
// when the underlying SDE tables actually changed (or the TTL expires),
// never stale-serve past that, and never depend on ESI availability.
const TREE_CACHE_TTL_MS = 10 * 60 * 1000

type TreeCacheVersion = {
  marketGroupCount: number
  marketGroupUpdatedAt: string | null
  eveTypeUpdatedAt: string | null
}

let treeCache:
  | { data: { groups: MarketGroupNode[]; total: number }; expiresAt: number; version: TreeCacheVersion }
  | null = null

async function getTreeVersion(): Promise<TreeCacheVersion> {
  const [marketGroupCount, marketGroupAgg, eveTypeAgg] = await Promise.all([
    prisma.eveMarketGroup.count(),
    prisma.eveMarketGroup.aggregate({ _max: { updatedAt: true } }),
    prisma.eveType.aggregate({ _max: { updatedAt: true } }),
  ])

  return {
    marketGroupCount,
    marketGroupUpdatedAt: marketGroupAgg._max.updatedAt?.toISOString() ?? null,
    eveTypeUpdatedAt: eveTypeAgg._max.updatedAt?.toISOString() ?? null,
  }
}

function isSameVersion(a: TreeCacheVersion, b: TreeCacheVersion): boolean {
  return (
    a.marketGroupCount === b.marketGroupCount &&
    a.marketGroupUpdatedAt === b.marketGroupUpdatedAt &&
    a.eveTypeUpdatedAt === b.eveTypeUpdatedAt
  )
}

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

    const currentVersion = await getTreeVersion()
    if (
      treeCache &&
      treeCache.expiresAt > Date.now() &&
      isSameVersion(treeCache.version, currentVersion)
    ) {
      return NextResponse.json(treeCache.data)
    }

    const { tree, itemCount } = await buildLocalMarketGroupTree()

    const payload = { groups: tree, total: itemCount }

    treeCache = {
      data: payload,
      expiresAt: Date.now() + TREE_CACHE_TTL_MS,
      version: currentVersion,
    }

    return NextResponse.json(payload)
  } catch (error: unknown) {
    logger.error('MarketGroups', 'GET /api/market/groups error', { error })

    if (error instanceof MarketGroupsEmptyError) {
      // Never fall back to an empty tree silently - tell the caller exactly
      // why there is nothing to show (CLAUDE.md rule #3).
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    return NextResponse.json(
      { error: 'Failed to load market groups from the local database' },
      { status: 500 }
    )
  }
}
