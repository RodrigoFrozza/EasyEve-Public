import { prisma } from '@/lib/prisma'
import {
  MIN_GLOBAL_SAMPLE_EVENTS,
  buildDimensionRows,
  buildItemRows,
  decimalToNumber,
  computeDropRatePct,
  type LootIntelResponse,
} from '@/lib/analytics/loot-intel-shared'

export type AbyssalLootIntelQuery = {
  scope: 'global' | 'me'
  userId?: string
  tier?: string
  weather?: string
  days?: number
}

async function getDistinctFilters() {
  const rollups = await prisma.abyssalLootDimensionRollup.findMany({
    select: { tier: true, weather: true },
    orderBy: [{ tier: 'asc' }, { weather: 'asc' }],
  })
  return {
    tiers: [...new Set(rollups.map((r) => r.tier))],
    weathers: [...new Set(rollups.map((r) => r.weather))],
  }
}

export async function queryAbyssalLootIntel(
  query: AbyssalLootIntelQuery
): Promise<LootIntelResponse> {
  const tierFilter = query.tier?.trim()
  const weatherFilter = query.weather?.trim()
  const filters = await getDistinctFilters()

  if (query.scope === 'me') {
    if (!query.userId) throw new Error('userId required for scope=me')
    const since = query.days
      ? new Date(Date.now() - query.days * 24 * 60 * 60 * 1000)
      : undefined

    const events = await prisma.abyssalLootEventFact.findMany({
      where: {
        userId: query.userId,
        ...(tierFilter ? { tier: tierFilter } : {}),
        ...(weatherFilter ? { weather: weatherFilter } : {}),
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      include: { items: true },
    })

    const totalEvents = events.length
    const dimMap = new Map<string, { totalEvents: number; totalValue: number; tier: string; weather: string }>()
    const itemMap = new Map<
      string,
      { typeId: number; itemName: string; eventsWithItem: number; totalQuantity: number; totalValue: number }
    >()

    for (const ev of events) {
      const dimKey = `${ev.tier}|${ev.weather}`
      const prev = dimMap.get(dimKey) || {
        totalEvents: 0,
        totalValue: 0,
        tier: ev.tier,
        weather: ev.weather,
      }
      prev.totalEvents += 1
      prev.totalValue += decimalToNumber(ev.eventValue)
      dimMap.set(dimKey, prev)

      const seen = new Set<number>()
      for (const item of ev.items) {
        if (seen.has(item.typeId)) continue
        seen.add(item.typeId)
        const iKey = `${dimKey}:${item.typeId}`
        const ip = itemMap.get(iKey) || {
          typeId: item.typeId,
          itemName: item.itemName,
          eventsWithItem: 0,
          totalQuantity: 0,
          totalValue: 0,
        }
        ip.eventsWithItem += 1
        ip.totalQuantity += item.quantity
        ip.totalValue += decimalToNumber(item.totalValue)
        itemMap.set(iKey, ip)
      }
    }

    const dimensionRanking = Array.from(dimMap.entries())
      .map(([, stats]) => ({
        key: `${stats.tier}|${stats.weather}`,
        label: stats.tier,
        subLabel: stats.weather,
        totalEvents: stats.totalEvents,
        totalValue: stats.totalValue,
        avgValuePerEvent: stats.totalEvents > 0 ? stats.totalValue / stats.totalEvents : 0,
        avgIskPerHour: null,
        sampleSufficient: stats.totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      }))
      .sort((a, b) => b.avgValuePerEvent - a.avgValuePerEvent)

    const items = Array.from(itemMap.entries())
      .map(([itemKey, row]) => {
        const colonIdx = itemKey.lastIndexOf(':')
        const dimKey = colonIdx >= 0 ? itemKey.slice(0, colonIdx) : itemKey
        const dimStats = dimMap.get(dimKey)
        const dimTotal = dimStats?.totalEvents || totalEvents
        return {
        typeId: row.typeId,
        itemName: row.itemName,
        dropRatePct: computeDropRatePct(row.eventsWithItem, dimTotal),
        eventsWithItem: row.eventsWithItem,
        totalQuantity: row.totalQuantity,
        avgValuePerAppearance:
          row.eventsWithItem > 0 ? row.totalValue / row.eventsWithItem : 0,
        totalValue: row.totalValue,
      }})
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
      items: tierFilter && weatherFilter ? items : items.slice(0, 50),
      filters,
    }
  }

  const rollups = await prisma.abyssalLootDimensionRollup.findMany({
    where: {
      ...(tierFilter ? { tier: tierFilter } : {}),
      ...(weatherFilter ? { weather: weatherFilter } : {}),
    },
    orderBy: { totalValue: 'desc' },
  })

  const dimensionRanking = buildDimensionRows(
    rollups,
    (r) => ({
      key: `${r.tier}|${r.weather}`,
      label: r.tier,
      subLabel: r.weather,
    }),
    { minSample: MIN_GLOBAL_SAMPLE_EVENTS, sortBy: 'avgPerEvent' }
  )

  const tierForItems = tierFilter || rollups[0]?.tier
  const weatherForItems = weatherFilter || rollups[0]?.weather
  const dimRollup = rollups.find(
    (r) => r.tier === tierForItems && r.weather === weatherForItems
  )
  const totalEvents = dimRollup?.totalEvents ?? 0

  const itemRollups = await prisma.abyssalLootItemRollup.findMany({
    where: {
      ...(tierForItems ? { tier: tierForItems } : {}),
      ...(weatherForItems ? { weather: weatherForItems } : {}),
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
