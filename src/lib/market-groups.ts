import { prisma } from '@/lib/prisma'
import { MarketGroupNode } from '@/lib/constants/market'

/**
 * Thrown when EveMarketGroup has no rows, i.e. the SDE import hasn't run
 * (or ran incompletely) against this database. Per CLAUDE.md rule #3 ("falha
 * nunca pode ser invisivel" - failure can never be silent), the Market
 * Browser must never silently render an empty tree; the caller (route)
 * surfaces this as a clear error instead.
 */
export class MarketGroupsEmptyError extends Error {
  constructor() {
    super(
      'EveMarketGroup table is empty - run the SDE import (see docs/SDE_DOGMA_SYNC_ENTRYPOINTS.md) before serving the Market Browser.'
    )
    this.name = 'MarketGroupsEmptyError'
  }
}

/**
 * Builds the full Market Browser tree entirely from the local SDE-derived
 * tables (EveMarketGroup + EveType). No ESI calls, no id cutoff - every
 * market group in the database is included. Only published types are
 * attached as leaf items. Branches (at any depth) that end up with no items
 * anywhere in their subtree are pruned so the UI never shows empty folders.
 */
export async function buildLocalMarketGroupTree(): Promise<{
  tree: MarketGroupNode[]
  itemCount: number
}> {
  const [marketGroups, types] = await Promise.all([
    prisma.eveMarketGroup.findMany(),
    prisma.eveType.findMany({
      where: { published: true, marketGroupId: { not: null } },
      select: {
        id: true,
        name: true,
        groupId: true,
        volume: true,
        marketGroupId: true,
        group: { select: { name: true } },
      },
    }),
  ])

  if (marketGroups.length === 0) {
    throw new MarketGroupsEmptyError()
  }

  const nodeMap = new Map<number, MarketGroupNode>()
  for (const mg of marketGroups) {
    nodeMap.set(mg.id, {
      id: mg.id,
      name: mg.name,
      description: mg.description ?? undefined,
      parentId: mg.parentGroupId,
      children: [],
      items: [],
    })
  }

  for (const t of types) {
    if (t.marketGroupId == null) continue
    const node = nodeMap.get(t.marketGroupId)
    if (!node) continue
    node.items.push({
      typeId: t.id,
      name: t.name,
      groupId: t.groupId,
      groupName: t.group?.name ?? '',
      volume: t.volume ?? undefined,
    })
  }

  const roots: MarketGroupNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId !== null && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  let itemCount = 0
  function prune(nodes: MarketGroupNode[]): MarketGroupNode[] {
    const kept: MarketGroupNode[] = []
    for (const node of nodes) {
      node.children = prune(node.children)
      const hasContent = node.items.length > 0 || node.children.length > 0
      if (hasContent) {
        itemCount += node.items.length
        kept.push(node)
      }
    }
    return kept
  }

  function sortTree(nodes: MarketGroupNode[]): MarketGroupNode[] {
    const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name))
    for (const node of sorted) {
      node.children = sortTree(node.children)
      node.items = [...node.items].sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }

  const tree = sortTree(prune(roots))

  return { tree, itemCount }
}
