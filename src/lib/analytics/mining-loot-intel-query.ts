import { prisma } from '@/lib/prisma'
import {
  LOOT_INTEL_ALL_SPACES,
  MIN_GLOBAL_SAMPLE_EVENTS,
  buildDimensionRows,
  buildItemRows,
  decimalToNumber,
  computeDropRatePct,
  rollupSpaceKey,
  type LootIntelRegionRow,
  type LootIntelResponse,
} from '@/lib/analytics/loot-intel-shared'
import { MINING_TYPES } from '@/lib/constants/activity-data'

export type MiningLootIntelQuery = {
  scope: 'global' | 'me'
  userId?: string
  category?: string
  space?: string
  days?: number
}

async function getDistinctFilters() {
  const categories = await prisma.miningLootDimensionRollup.findMany({
    where: { spaceType: LOOT_INTEL_ALL_SPACES },
    select: { miningCategory: true },
    orderBy: { totalEvents: 'desc' },
  })
  const spaces = await prisma.miningLootEventFact.findMany({
    distinct: ['spaceType'],
    select: { spaceType: true },
    orderBy: { spaceType: 'asc' },
  })
  return {
    categories: [
      ...new Set([
        ...MINING_TYPES,
        ...categories.map((c) => c.miningCategory),
      ]),
    ],
    spaces: spaces.map((s) => s.spaceType).filter(Boolean),
  }
}

function buildRegionRanking(
  rollups: Array<{
    regionId: number
    regionName: string
    totalEvents: number
    totalValue: { toNumber?: () => number } | number | bigint
    totalDurationMs: bigint | number
  }>
): LootIntelRegionRow[] {
  return rollups
    .map((r) => {
      const totalEvents = r.totalEvents
      const totalValue = decimalToNumber(r.totalValue)
      const durationMs = decimalToNumber(r.totalDurationMs)
      const hours = durationMs > 0 ? durationMs / 3_600_000 : 0
      return {
        regionId: r.regionId,
        regionName: r.regionName,
        totalEvents,
        totalValue,
        avgValuePerEvent: totalEvents > 0 ? totalValue / totalEvents : 0,
        avgIskPerHour: hours > 0 ? totalValue / hours : null,
        sampleSufficient: totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      }
    })
    .sort((a, b) => (b.avgIskPerHour ?? b.avgValuePerEvent) - (a.avgIskPerHour ?? a.avgValuePerEvent))
}

function buildMeRegionRanking(
  events: Array<{
    regionId: number | null
    regionName: string | null
    eventValue: { toNumber?: () => number } | number | bigint
  }>
): LootIntelRegionRow[] {
  const map = new Map<
    number,
    { regionName: string; totalEvents: number; totalValue: number }
  >()

  for (const ev of events) {
    if (!ev.regionId || ev.regionId <= 0) continue
    const value = decimalToNumber(ev.eventValue)
    const row = map.get(ev.regionId) ?? {
      regionName: ev.regionName || `Region ${ev.regionId}`,
      totalEvents: 0,
      totalValue: 0,
    }
    row.totalEvents += 1
    row.totalValue += value
    if (ev.regionName) row.regionName = ev.regionName
    map.set(ev.regionId, row)
  }

  return [...map.entries()]
    .map(([regionId, row]) => ({
      regionId,
      regionName: row.regionName,
      totalEvents: row.totalEvents,
      totalValue: row.totalValue,
      avgValuePerEvent:
        row.totalEvents > 0 ? row.totalValue / row.totalEvents : 0,
      avgIskPerHour: null,
      sampleSufficient: row.totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
}

export async function queryMiningLootIntel(
  query: MiningLootIntelQuery
): Promise<LootIntelResponse> {
  const categoryFilter = query.category?.trim()
  const spaceFilter = query.space?.trim()
  const filters = await getDistinctFilters()

  if (query.scope === 'me') {
    if (!query.userId) throw new Error('userId required for scope=me')
    const since = query.days
      ? new Date(Date.now() - query.days * 24 * 60 * 60 * 1000)
      : undefined

    const events = await prisma.miningLootEventFact.findMany({
      where: {
        userId: query.userId,
        ...(categoryFilter ? { miningCategory: categoryFilter } : {}),
        ...(spaceFilter ? { spaceType: spaceFilter } : {}),
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      include: { items: true },
    })

    const totalEvents = events.length
    const catMap = new Map<string, { totalEvents: number; totalValue: number }>()
    const itemMap = new Map<
      string,
      { typeId: number; itemName: string; eventsWithItem: number; totalQuantity: number; totalValue: number }
    >()

    for (const ev of events) {
      const prev = catMap.get(ev.miningCategory) || { totalEvents: 0, totalValue: 0 }
      prev.totalEvents += 1
      prev.totalValue += decimalToNumber(ev.eventValue)
      catMap.set(ev.miningCategory, prev)

      for (const item of ev.items) {
        const key = `${ev.miningCategory}:${item.typeId}`
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

    const targetCat = categoryFilter || events[0]?.miningCategory || ''
    const catTotal = targetCat
      ? events.filter((e) => e.miningCategory === targetCat).length
      : totalEvents

    const dimensionRanking = Array.from(catMap.entries())
      .map(([miningCategory, stats]) => ({
        key: miningCategory,
        label: miningCategory,
        totalEvents: stats.totalEvents,
        totalValue: stats.totalValue,
        avgValuePerEvent: stats.totalEvents > 0 ? stats.totalValue / stats.totalEvents : 0,
        avgIskPerHour: null,
        sampleSufficient: stats.totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      }))
      .sort((a, b) => b.avgValuePerEvent - a.avgValuePerEvent)

    const items = Array.from(itemMap.values())
      .filter((row) => !categoryFilter || itemMap.size > 0)
      .map((row) => ({
        typeId: row.typeId,
        itemName: row.itemName,
        dropRatePct: computeDropRatePct(row.eventsWithItem, catTotal || totalEvents),
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
      items: categoryFilter ? items : items.slice(0, 50),
      regionRanking: buildMeRegionRanking(events),
      filters,
    }
  }

  const rollups = await prisma.miningLootDimensionRollup.findMany({
    where: categoryFilter ? { miningCategory: categoryFilter } : {},
    orderBy: { totalValue: 'desc' },
  })

  const spaceKey = rollupSpaceKey(spaceFilter)
  const dimensionRanking = buildDimensionRows(
    rollups.filter((r) =>
      spaceFilter ? r.spaceType === spaceKey : r.spaceType === LOOT_INTEL_ALL_SPACES
    ),
    (r) => ({
      key: r.miningCategory,
      label: r.miningCategory,
      subLabel: spaceFilter ? r.spaceType : undefined,
    }),
    { minSample: MIN_GLOBAL_SAMPLE_EVENTS, sortBy: 'avgPerEvent' }
  )

  const categoryForItems =
    categoryFilter || dimensionRanking[0]?.key || rollups[0]?.miningCategory
  const catRollup = rollups.find(
    (r) => r.miningCategory === categoryForItems && r.spaceType === spaceKey
  )
  const totalEvents = catRollup?.totalEvents ?? 0

  const itemRollups = await prisma.miningLootItemRollup.findMany({
    where: {
      ...(categoryForItems ? { miningCategory: categoryForItems } : {}),
      spaceType: spaceKey,
    },
    orderBy: { totalValue: 'desc' },
    take: 100,
  })

  const items = buildItemRows(itemRollups, totalEvents)

  const regionRollups = spaceFilter
    ? undefined
    : await prisma.miningLootRegionRollup.findMany({
        where: categoryForItems ? { miningCategory: categoryForItems } : {},
        orderBy: { totalValue: 'desc' },
        take: 25,
      })

  const spaceFilteredEvents = spaceFilter
    ? await prisma.miningLootEventFact.findMany({
        where: {
          ...(categoryForItems ? { miningCategory: categoryForItems } : {}),
          spaceType: spaceFilter,
        },
        select: {
          regionId: true,
          regionName: true,
          eventValue: true,
        },
      })
    : null

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
    regionRanking: spaceFilteredEvents
      ? buildMeRegionRanking(spaceFilteredEvents)
      : buildRegionRanking(regionRollups ?? []),
    filters,
  }
}
