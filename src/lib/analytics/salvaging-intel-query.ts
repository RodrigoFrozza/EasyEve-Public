import { prisma } from '@/lib/prisma'
import {
  SALVAGE_INTEL_ALL_SPACES,
  MIN_GLOBAL_SAMPLE_BATCHES,
  buildFactionRankingFromRollups,
  buildItemRowsFromRollups,
  computeDropRatePct,
  decimalToNumber,
  rollupSpaceKey,
  type SalvageIntelResponse,
} from '@/lib/analytics/salvaging-intel'

export type SalvagingIntelQuery = {
  scope: 'global' | 'me'
  userId?: string
  faction?: string
  space?: string
  days?: number
}

async function getDistinctFilters(): Promise<{ factions: string[]; spaces: string[] }> {
  const [factions, spaces] = await Promise.all([
    prisma.salvageFactionRollup.findMany({
      where: { spaceType: SALVAGE_INTEL_ALL_SPACES },
      select: { npcFaction: true },
      orderBy: { totalBatches: 'desc' },
    }),
    prisma.salvageBatchFact.findMany({
      distinct: ['spaceType'],
      select: { spaceType: true },
      orderBy: { spaceType: 'asc' },
    }),
  ])

  return {
    factions: factions.map((f) => f.npcFaction),
    spaces: spaces.map((s) => s.spaceType).filter(Boolean),
  }
}

export async function querySalvagingIntel(
  query: SalvagingIntelQuery
): Promise<SalvageIntelResponse> {
  const scope = query.scope
  const factionFilter = query.faction?.trim()
  const spaceFilter = query.space?.trim()
  const days = query.days && query.days > 0 ? Math.min(query.days, 365) : undefined

  const filters = await getDistinctFilters()

  if (scope === 'me') {
    if (!query.userId) {
      throw new Error('userId required for scope=me')
    }

    const since = days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : undefined

    const batches = await prisma.salvageBatchFact.findMany({
      where: {
        userId: query.userId,
        ...(factionFilter ? { npcFaction: factionFilter } : {}),
        ...(spaceFilter ? { spaceType: spaceFilter } : {}),
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      include: { items: true },
    })

    const totalBatches = batches.length
    const factionMap = new Map<
      string,
      { totalBatches: number; totalValue: number; spaceType: string }
    >()
    const itemMap = new Map<
      string,
      {
        typeId: number
        itemName: string
        batchesWithItem: number
        totalQuantity: number
        totalValue: number
      }
    >()

    for (const batch of batches) {
      const fKey = batch.npcFaction
      const prev = factionMap.get(fKey) || {
        totalBatches: 0,
        totalValue: 0,
        spaceType: batch.spaceType,
      }
      prev.totalBatches += 1
      prev.totalValue += decimalToNumber(batch.batchValue)
      factionMap.set(fKey, prev)

      const seenInBatch = new Set<number>()
      for (const item of batch.items) {
        if (seenInBatch.has(item.typeId)) continue
        seenInBatch.add(item.typeId)
        const iKey = `${batch.npcFaction}:${item.typeId}`
        const ip = itemMap.get(iKey) || {
          typeId: item.typeId,
          itemName: item.itemName,
          batchesWithItem: 0,
          totalQuantity: 0,
          totalValue: 0,
        }
        ip.batchesWithItem += 1
        ip.totalQuantity += item.quantity
        ip.totalValue += decimalToNumber(item.totalValue)
        itemMap.set(iKey, ip)
      }
    }

    const targetFaction = factionFilter || (batches[0]?.npcFaction ?? '')
    const factionTotalBatches = targetFaction
      ? batches.filter((b) => b.npcFaction === targetFaction).length
      : totalBatches

    const factionRanking = Array.from(factionMap.entries())
      .map(([npcFaction, stats]) => ({
        npcFaction,
        spaceType: spaceFilter || SALVAGE_INTEL_ALL_SPACES,
        totalBatches: stats.totalBatches,
        totalValue: stats.totalValue,
        avgIskPerBatch:
          stats.totalBatches > 0 ? stats.totalValue / stats.totalBatches : 0,
        avgIskPerHour: null,
        sampleSufficient: stats.totalBatches >= MIN_GLOBAL_SAMPLE_BATCHES,
      }))
      .sort((a, b) => b.avgIskPerBatch - a.avgIskPerBatch)

    const items = Array.from(itemMap.values())
      .filter(() => !factionFilter || itemMap.size > 0)
      .map((row) => ({
        typeId: row.typeId,
        itemName: row.itemName,
        dropRatePct: computeDropRatePct(row.batchesWithItem, factionTotalBatches || totalBatches),
        batchesWithItem: row.batchesWithItem,
        totalQuantity: row.totalQuantity,
        avgValuePerAppearance:
          row.batchesWithItem > 0 ? row.totalValue / row.batchesWithItem : 0,
        totalValue: row.totalValue,
      }))
      .sort((a, b) => b.dropRatePct - a.dropRatePct)

    return {
      meta: {
        minSampleBatches: MIN_GLOBAL_SAMPLE_BATCHES,
        generatedAt: new Date().toISOString(),
        scope: 'me',
        sampleSufficient: totalBatches >= MIN_GLOBAL_SAMPLE_BATCHES,
        totalBatches,
      },
      factionRanking,
      items: factionFilter
        ? items
        : items.slice(0, 50),
      filters,
    }
  }

  const rollups = await prisma.salvageFactionRollup.findMany({
    where: {
      ...(factionFilter ? { npcFaction: factionFilter } : {}),
    },
    orderBy: { totalValue: 'desc' },
  })

  const factionRanking = buildFactionRankingFromRollups(rollups, {
    spaceFilter,
    minSample: MIN_GLOBAL_SAMPLE_BATCHES,
  })

  const spaceKey = rollupSpaceKey(spaceFilter)
  const factionForItems =
    factionFilter ||
    (spaceFilter ? factionRanking[0]?.npcFaction : undefined) ||
    factionRanking[0]?.npcFaction
  const factionRollup = rollups.find(
    (r) =>
      r.npcFaction === factionForItems &&
      r.spaceType === spaceKey
  )
  const totalBatches = factionRollup?.totalBatches ?? 0

  const itemRollups = await prisma.salvageItemRollup.findMany({
    where: {
      ...(factionForItems ? { npcFaction: factionForItems } : {}),
      spaceType: spaceKey,
    },
    orderBy: { totalValue: 'desc' },
    take: 100,
  })

  const items = buildItemRowsFromRollups(itemRollups, totalBatches, {
    factionFilter: factionForItems,
    spaceFilter: spaceFilter || undefined,
  })

  return {
    meta: {
      minSampleBatches: MIN_GLOBAL_SAMPLE_BATCHES,
      generatedAt: new Date().toISOString(),
      scope: 'global',
      sampleSufficient: totalBatches >= MIN_GLOBAL_SAMPLE_BATCHES,
      totalBatches,
    },
    factionRanking,
    items,
    filters,
  }
}
