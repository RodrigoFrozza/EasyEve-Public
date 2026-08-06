import { prisma } from '@/lib/prisma'
import {
  LOOT_INTEL_ALL_SPACES,
  MIN_GLOBAL_SAMPLE_EVENTS,
  buildDimensionRows,
  buildItemRows,
  decimalToNumber,
  computeDropRatePct,
  rollupSpaceKey,
  type LootIntelResponse,
} from '@/lib/analytics/loot-intel-shared'

export type RattingLootIntelQuery = {
  scope: 'global' | 'me'
  userId?: string
  faction?: string
  space?: string
  days?: number
}

async function getDistinctFilters() {
  const [factions, spaces] = await Promise.all([
    prisma.rattingLootDimensionRollup.findMany({
      where: { spaceType: LOOT_INTEL_ALL_SPACES },
      select: { npcFaction: true },
      orderBy: { totalEvents: 'desc' },
    }),
    prisma.rattingLootEventFact.findMany({
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

export async function queryRattingLootIntel(
  query: RattingLootIntelQuery
): Promise<LootIntelResponse> {
  const factionFilter = query.faction?.trim()
  const spaceFilter = query.space?.trim()
  const filters = await getDistinctFilters()

  if (query.scope === 'me') {
    if (!query.userId) throw new Error('userId required for scope=me')
    const since = query.days
      ? new Date(Date.now() - query.days * 24 * 60 * 60 * 1000)
      : undefined

    const events = await prisma.rattingLootEventFact.findMany({
      where: {
        userId: query.userId,
        ...(factionFilter ? { npcFaction: factionFilter } : {}),
        ...(spaceFilter ? { spaceType: spaceFilter } : {}),
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      include: { items: true },
    })

    const totalEvents = events.length
    const factionMap = new Map<string, { totalEvents: number; totalValue: number }>()
    const itemMap = new Map<
      string,
      { typeId: number; itemName: string; eventsWithItem: number; totalQuantity: number; totalValue: number }
    >()

    for (const ev of events) {
      const prev = factionMap.get(ev.npcFaction) || { totalEvents: 0, totalValue: 0 }
      prev.totalEvents += 1
      prev.totalValue += decimalToNumber(ev.eventValue)
      factionMap.set(ev.npcFaction, prev)

      const seen = new Set<number>()
      for (const item of ev.items) {
        if (seen.has(item.typeId)) continue
        seen.add(item.typeId)
        const key = `${ev.npcFaction}:${item.typeId}`
        const ip = itemMap.get(key) || {
          typeId: item.typeId,
          itemName: item.itemName,
          eventsWithItem: 0,
          totalQuantity: 0,
          totalValue: 0,
        }
        ip.eventsWithItem += 1
        ip.totalQuantity += item.quantity
        ip.totalValue += decimalToNumber(item.totalValue)
        itemMap.set(key, ip)
      }
    }

    const targetFaction = factionFilter || events[0]?.npcFaction || ''
    const factionTotalEvents = targetFaction
      ? events.filter((e) => e.npcFaction === targetFaction).length
      : totalEvents

    const dimensionRanking = Array.from(factionMap.entries())
      .map(([npcFaction, stats]) => ({
        key: npcFaction,
        label: npcFaction,
        totalEvents: stats.totalEvents,
        totalValue: stats.totalValue,
        avgValuePerEvent: stats.totalEvents > 0 ? stats.totalValue / stats.totalEvents : 0,
        avgIskPerHour: null,
        sampleSufficient: stats.totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      }))
      .sort((a, b) => b.avgValuePerEvent - a.avgValuePerEvent)

    const items = Array.from(itemMap.values())
      .map((row) => ({
        typeId: row.typeId,
        itemName: row.itemName,
        dropRatePct: computeDropRatePct(row.eventsWithItem, factionTotalEvents || totalEvents),
        eventsWithItem: row.eventsWithItem,
        totalQuantity: row.totalQuantity,
        avgValuePerAppearance:
          row.eventsWithItem > 0 ? row.totalValue / row.eventsWithItem : 0,
        totalValue: row.totalValue,
      }))
      .sort((a, b) => b.dropRatePct - a.dropRatePct)

    return {
      meta: {
        minSampleEvents: MIN_GLOBAL_SAMPLE_EVENTS,
        generatedAt: new Date().toISOString(),
        scope: 'me',
        sampleSufficient: totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
        totalEvents,
      },
      dimensionRanking,
      items: factionFilter ? items : items.slice(0, 50),
      filters,
    }
  }

  const rollups = await prisma.rattingLootDimensionRollup.findMany({
    where: factionFilter ? { npcFaction: factionFilter } : {},
    orderBy: { totalValue: 'desc' },
  })

  const spaceKey = rollupSpaceKey(spaceFilter)
  const dimensionRanking = buildDimensionRows(
    rollups.filter((r) => (spaceFilter ? r.spaceType === spaceKey : r.spaceType === LOOT_INTEL_ALL_SPACES)),
    (r) => ({
      key: r.npcFaction,
      label: r.npcFaction,
      subLabel: spaceFilter ? r.spaceType : undefined,
    }),
    { minSample: MIN_GLOBAL_SAMPLE_EVENTS, sortBy: 'iskPerHour' }
  )

  const factionForItems =
    factionFilter || dimensionRanking[0]?.key || rollups[0]?.npcFaction
  const factionRollup = rollups.find(
    (r) => r.npcFaction === factionForItems && r.spaceType === spaceKey
  )
  const totalEvents = factionRollup?.totalEvents ?? 0

  const itemRollups = await prisma.rattingLootItemRollup.findMany({
    where: {
      ...(factionForItems ? { npcFaction: factionForItems } : {}),
      spaceType: spaceKey,
    },
    orderBy: { totalValue: 'desc' },
    take: 100,
  })

  const items = buildItemRows(itemRollups, totalEvents)

  return {
    meta: {
      minSampleEvents: MIN_GLOBAL_SAMPLE_EVENTS,
      generatedAt: new Date().toISOString(),
      scope: 'global',
      sampleSufficient: totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      totalEvents,
    },
    dimensionRanking,
    items,
    filters,
  }
}
