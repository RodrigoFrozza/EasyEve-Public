import { prisma } from '@/lib/prisma'
import {
  MIN_GLOBAL_SAMPLE_EVENTS,
  buildItemRows,
  decimalToNumber,
  computeDropRatePct,
  type LootIntelResponse,
} from '@/lib/analytics/loot-intel-shared'

const GLOBAL_BUCKET = 'global'

export type ExplorationLootIntelQuery = {
  scope: 'global' | 'me'
  userId?: string
  days?: number
}

export async function queryExplorationLootIntel(
  query: ExplorationLootIntelQuery
): Promise<LootIntelResponse> {
  const filters = { global: [GLOBAL_BUCKET] }

  if (query.scope === 'me') {
    if (!query.userId) throw new Error('userId required for scope=me')
    const since = query.days
      ? new Date(Date.now() - query.days * 24 * 60 * 60 * 1000)
      : undefined

    const events = await prisma.explorationLootEventFact.findMany({
      where: {
        userId: query.userId,
        ...(since ? { occurredAt: { gte: since } } : {}),
      },
      include: { items: true },
    })

    const totalEvents = events.length
    const itemMap = new Map<
      number,
      { typeId: number; itemName: string; eventsWithItem: number; totalQuantity: number; totalValue: number }
    >()

    for (const ev of events) {
      const seen = new Set<number>()
      for (const item of ev.items) {
        if (seen.has(item.typeId)) continue
        seen.add(item.typeId)
        const ip = itemMap.get(item.typeId) || {
          typeId: item.typeId,
          itemName: item.itemName,
          eventsWithItem: 0,
          totalQuantity: 0,
          totalValue: 0,
        }
        ip.eventsWithItem += 1
        ip.totalQuantity += item.quantity
        ip.totalValue += decimalToNumber(item.totalValue)
        itemMap.set(item.typeId, ip)
      }
    }

    const totalValue = events.reduce((s, e) => s + decimalToNumber(e.eventValue), 0)

    const dimensionRanking = [
      {
        key: GLOBAL_BUCKET,
        label: GLOBAL_BUCKET,
        totalEvents,
        totalValue,
        avgValuePerEvent: totalEvents > 0 ? totalValue / totalEvents : 0,
        avgIskPerHour: null,
        sampleSufficient: totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      },
    ]

    const items = Array.from(itemMap.values())
      .map((row) => ({
        typeId: row.typeId,
        itemName: row.itemName,
        dropRatePct: computeDropRatePct(row.eventsWithItem, totalEvents),
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
      items,
      filters,
    }
  }

  const globalRollup = await prisma.explorationLootDimensionRollup.findUnique({
    where: { bucketKey: GLOBAL_BUCKET },
  })
  const totalEvents = globalRollup?.totalEvents ?? 0
  const totalValue = globalRollup ? decimalToNumber(globalRollup.totalValue) : 0
  const durationMs = globalRollup ? decimalToNumber(globalRollup.totalDurationMs) : 0
  const hours = durationMs > 0 ? durationMs / 3_600_000 : 0

  const itemRollups = await prisma.explorationLootItemRollup.findMany({
    where: { bucketKey: GLOBAL_BUCKET },
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
    dimensionRanking: [
      {
        key: GLOBAL_BUCKET,
        label: 'Global',
        totalEvents,
        totalValue,
        avgValuePerEvent: totalEvents > 0 ? totalValue / totalEvents : 0,
        avgIskPerHour: hours > 0 ? totalValue / hours : null,
        sampleSufficient: totalEvents >= MIN_GLOBAL_SAMPLE_EVENTS,
      },
    ],
    items,
    filters,
  }
}
