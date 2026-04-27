import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getShipFactionLabel,
  normalizeShipFactionId,
  type ShipFactionId,
} from '@/lib/ships/ship-taxonomy'

export const dynamic = 'force-dynamic'

type ShipLeaf = {
  id: number
  name: string
  groupName: string
  groupId?: number | null
  faction?: string | null
  factionId?: ShipFactionId
}

type ShipFactionBucket = {
  id: ShipFactionId
  label: string
  count: number
  ships: ShipLeaf[]
}

type ShipGroupTreeNode = {
  id: number
  label: string
  count: number
  children: ShipGroupTreeNode[]
  factions: ShipFactionBucket[]
}

const TREE_CACHE_TTL_MS = 10 * 60 * 1000

type TreeCacheVersion = {
  shipStatsCount: number
  shipStatsUpdatedAt: string | null
  shipStatsSyncedAt: string | null
  eveTypeUpdatedAt: string | null
  marketGroupUpdatedAt: string | null
}

let treeCache:
  | { data: { groups: ShipGroupTreeNode[]; total: number }; expiresAt: number; version: TreeCacheVersion }
  | null = null

async function getTreeVersion(): Promise<TreeCacheVersion> {
  const [shipStatsCount, shipStatsAgg, eveTypeAgg, marketGroupAgg] = await Promise.all([
    prisma.shipStats.count(),
    prisma.shipStats.aggregate({ _max: { updatedAt: true, syncedAt: true } }),
    prisma.eveType.aggregate({ _max: { updatedAt: true } }),
    prisma.eveMarketGroup.aggregate({ _max: { updatedAt: true } }),
  ])

  return {
    shipStatsCount,
    shipStatsUpdatedAt: shipStatsAgg._max.updatedAt?.toISOString() ?? null,
    shipStatsSyncedAt: shipStatsAgg._max.syncedAt?.toISOString() ?? null,
    eveTypeUpdatedAt: eveTypeAgg._max.updatedAt?.toISOString() ?? null,
    marketGroupUpdatedAt: marketGroupAgg._max.updatedAt?.toISOString() ?? null,
  }
}

function isSameVersion(a: TreeCacheVersion, b: TreeCacheVersion): boolean {
  return (
    a.shipStatsCount === b.shipStatsCount &&
    a.shipStatsUpdatedAt === b.shipStatsUpdatedAt &&
    a.shipStatsSyncedAt === b.shipStatsSyncedAt &&
    a.eveTypeUpdatedAt === b.eveTypeUpdatedAt &&
    a.marketGroupUpdatedAt === b.marketGroupUpdatedAt
  )
}

function sortTree(nodes: ShipGroupTreeNode[]): ShipGroupTreeNode[] {
  // Sort by label alphabetically to match EVE Online (or custom order if needed)
  const sorted = [...nodes].sort((a, b) => a.label.localeCompare(b.label))
  for (const node of sorted) {
    node.children = sortTree(node.children)
    node.factions = [...node.factions].sort((a, b) => a.label.localeCompare(b.label))
    for (const faction of node.factions) {
      faction.ships = [...faction.ships].sort((a, b) => a.name.localeCompare(b.name))
    }
  }
  return sorted
}

export async function GET() {
  try {
    const currentVersion = await getTreeVersion()
    if (
      treeCache &&
      treeCache.expiresAt > Date.now() &&
      isSameVersion(treeCache.version, currentVersion)
    ) {
      return NextResponse.json(treeCache.data)
    }

    // 1. Fetch all market groups
    const marketGroups = await prisma.eveMarketGroup.findMany()
    
    // 2. Fetch all ships with their market group ID
    const ships = await prisma.shipStats.findMany({
      include: {
        eveType: {
          select: {
            marketGroupId: true
          }
        }
      }
    })

    const nodeMap = new Map<number, ShipGroupTreeNode>()
    const leafShipsMap = new Map<number, ShipLeaf[]>()
    const unresolvedShips: ShipLeaf[] = []

    // Initialize market group nodes
    for (const mg of marketGroups) {
      nodeMap.set(mg.id, {
        id: mg.id,
        label: mg.name,
        count: 0,
        children: [],
        factions: [],
      })
    }

    // Map ships to their market groups
    for (const ship of ships) {
      const shipLeaf: ShipLeaf = {
        id: ship.typeId,
        name: ship.name,
        groupName: ship.groupName ?? 'Unknown',
        groupId: ship.groupId ?? null,
        faction: ship.factionName ?? null,
        factionId: normalizeShipFactionId(ship.factionName),
      }

      const mgId = ship.eveType?.marketGroupId
      if (mgId && nodeMap.has(mgId)) {
        const bucket = leafShipsMap.get(mgId) ?? []
        bucket.push(shipLeaf)
        leafShipsMap.set(mgId, bucket)
      } else {
        unresolvedShips.push(shipLeaf)
      }
    }

    // Link parents and children
    const rootIds = new Set<number>()
    for (const mg of marketGroups) {
      if (mg.parentGroupId && nodeMap.has(mg.parentGroupId)) {
        const parent = nodeMap.get(mg.parentGroupId)!
        const child = nodeMap.get(mg.id)!
        if (!parent.children.includes(child)) {
          parent.children.push(child)
        }
      } else {
        rootIds.add(mg.id)
      }
    }

    // Process nodes to calculate counts and group by faction
    function finalizeNode(node: ShipGroupTreeNode): number {
      const ownShips = leafShipsMap.get(node.id) ?? []
      const byFaction = new Map<ShipFactionId, ShipFactionBucket>()
      
      for (const ship of ownShips) {
        const factionId = ship.factionId ?? normalizeShipFactionId(ship.faction)
        const bucket = byFaction.get(factionId)
        if (bucket) {
          bucket.count++
          bucket.ships.push(ship)
        } else {
          byFaction.set(factionId, {
            id: factionId,
            label: getShipFactionLabel(factionId),
            count: 1,
            ships: [ship],
          })
        }
      }
      
      node.factions = Array.from(byFaction.values())
      
      let totalCount = ownShips.length
      // Process children and calculate total count
      // We don't filter here yet because we need the full structure to find sub-ships
      for (const child of node.children) {
        totalCount += finalizeNode(child)
      }
      
      node.count = totalCount
      return totalCount
    }

    // Recursive filter to remove empty branches
    function filterEmptyNodes(nodes: ShipGroupTreeNode[]): ShipGroupTreeNode[] {
      return nodes
        .filter(node => node.count > 0)
        .map(node => ({
          ...node,
          children: filterEmptyNodes(node.children)
        }))
    }

    let roots = Array.from(rootIds).map(id => nodeMap.get(id)!)
    
    // Finalize all nodes starting from roots
    for (const root of roots) {
      finalizeNode(root)
    }

    // Filter out roots and branches with no ships
    roots = filterEmptyNodes(roots)

    if (unresolvedShips.length > 0) {
      const unresolvedNode: ShipGroupTreeNode = {
        id: -1,
        label: 'Uncategorized Ships',
        count: unresolvedShips.length,
        children: [],
        factions: [],
      }
      
      const byFaction = new Map<ShipFactionId, ShipFactionBucket>()
      for (const ship of unresolvedShips) {
        const factionId = ship.factionId ?? normalizeShipFactionId(ship.faction)
        const bucket = byFaction.get(factionId)
        if (bucket) {
          bucket.count++
          bucket.ships.push(ship)
        } else {
          byFaction.set(factionId, {
            id: factionId,
            label: getShipFactionLabel(factionId),
            count: 1,
            ships: [ship],
          })
        }
      }
      unresolvedNode.factions = Array.from(byFaction.values())
      roots.push(unresolvedNode)
    }

    const payload = { 
      groups: sortTree(roots), 
      total: ships.length 
    }

    treeCache = {
      data: payload,
      expiresAt: Date.now() + TREE_CACHE_TTL_MS,
      version: currentVersion,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('GET /api/ships/tree error:', error)
    return NextResponse.json({ error: 'Failed to fetch ship tree' }, { status: 500 })
  }
}
