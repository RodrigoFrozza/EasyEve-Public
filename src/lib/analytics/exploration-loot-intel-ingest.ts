import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import type { ActivityForLootIntel } from '@/lib/analytics/loot-intel-dispatch'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { decimalToNumber, clampLootIntelValue } from '@/lib/analytics/loot-intel-shared'
import { Prisma } from '@prisma/client'

const GLOBAL_BUCKET = 'global'

type LootItem = {
  name?: string
  typeName?: string
  typeId?: number
  quantity?: number
  value?: number
  price?: number
  total?: number
}

type ExplorationIntelActivity = ActivityForLootIntel & {
  accumulatedPausedTime?: number | null
  isPaused?: boolean
  pausedAt?: Date | null
}

type ExplorationLootEvent = {
  occurredAt: Date
  eventValue: number
  items: Array<{ typeId: number; itemName: string; quantity: number; totalValue: number }>
}

function sessionDurationMs(activity: ExplorationIntelActivity): number {
  return getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    accumulatedPausedTime: activity.accumulatedPausedTime ?? undefined,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })
}

function mapLogItems(items: LootItem[]) {
  return items.map((i) => {
    const qty = Math.max(1, Number(i.quantity) || 1)
    const total = Number(i.value) || Number(i.total) || (Number(i.price) || 0) * qty
    return {
      typeId: Number(i.typeId) || 0,
      itemName: String(i.name || i.typeName || 'Unknown'),
      quantity: qty,
      totalValue: clampLootIntelValue(total),
    }
  })
}

export function collectExplorationLootEvents(
  data: Record<string, unknown>,
  fallbackOccurredAt: Date
): ExplorationLootEvent[] {
  const events: ExplorationLootEvent[] = []
  const logs =
    (data.logs as Array<{
      type?: string
      date?: string
      amount?: number
      value?: number
      items?: LootItem[]
    }>) || []

  const incomeLogs = logs.filter(
    (log) =>
      (log.type === 'loot' || log.type === 'site') &&
      Array.isArray(log.items) &&
      log.items.length > 0
  )

  if (incomeLogs.length > 0) {
    for (const log of incomeLogs) {
      const items = mapLogItems(log.items || [])
      const eventValue = clampLootIntelValue(
        Number(log.amount) || Number(log.value) || items.reduce((s, i) => s + i.totalValue, 0)
      )
      events.push({
        occurredAt: log.date ? new Date(log.date) : fallbackOccurredAt,
        eventValue,
        items,
      })
    }
    return events
  }

  const lootContents = (data.lootContents as LootItem[]) || []
  if (lootContents.length > 0) {
    const items = mapLogItems(lootContents)
    const eventValue = clampLootIntelValue(items.reduce((s, i) => s + i.totalValue, 0))
    events.push({
      occurredAt: fallbackOccurredAt,
      eventValue,
      items,
    })
  }

  return events
}

async function decGlobalDimension(
  tx: Prisma.TransactionClient,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  const row = await tx.explorationLootDimensionRollup.findUnique({
    where: { bucketKey: GLOBAL_BUCKET },
  })
  if (!row) return

  await tx.explorationLootDimensionRollup.update({
    where: { bucketKey: GLOBAL_BUCKET },
    data: {
      totalEvents: Math.max(0, row.totalEvents - extraEvents),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - eventValue),
      ...(extraDurationMs > 0
        ? {
            totalDurationMs: BigInt(
              Math.max(0, Number(row.totalDurationMs) - extraDurationMs)
            ),
          }
        : {}),
    },
  })
}

async function decGlobalItem(
  tx: Prisma.TransactionClient,
  typeId: number,
  quantity: number,
  totalValue: number
) {
  const row = await tx.explorationLootItemRollup.findUnique({
    where: { bucketKey_typeId: { bucketKey: GLOBAL_BUCKET, typeId } },
  })
  if (!row) return

  await tx.explorationLootItemRollup.update({
    where: { bucketKey_typeId: { bucketKey: GLOBAL_BUCKET, typeId } },
    data: {
      eventsWithItem: Math.max(0, row.eventsWithItem - 1),
      totalQuantity: Math.max(0, row.totalQuantity - quantity),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - totalValue),
    },
  })
}

async function incGlobalDimension(
  tx: Prisma.TransactionClient,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  await tx.explorationLootDimensionRollup.upsert({
    where: { bucketKey: GLOBAL_BUCKET },
    create: {
      bucketKey: GLOBAL_BUCKET,
      totalEvents: extraEvents,
      totalValue: eventValue,
      totalDurationMs: BigInt(extraDurationMs),
    },
    update: {
      totalEvents: { increment: extraEvents },
      totalValue: { increment: eventValue },
      ...(extraDurationMs > 0
        ? { totalDurationMs: { increment: BigInt(extraDurationMs) } }
        : {}),
    },
  })
}

async function incGlobalItem(
  tx: Prisma.TransactionClient,
  typeId: number,
  itemName: string,
  quantity: number,
  totalValue: number
) {
  await tx.explorationLootItemRollup.upsert({
    where: { bucketKey_typeId: { bucketKey: GLOBAL_BUCKET, typeId } },
    create: {
      bucketKey: GLOBAL_BUCKET,
      typeId,
      itemName,
      eventsWithItem: 1,
      totalQuantity: quantity,
      totalValue,
    },
    update: {
      itemName,
      eventsWithItem: { increment: 1 },
      totalQuantity: { increment: quantity },
      totalValue: { increment: totalValue },
    },
  })
}

async function retractExplorationLootInTx(
  tx: Prisma.TransactionClient,
  activity: ExplorationIntelActivity
) {
  const events = await tx.explorationLootEventFact.findMany({
    where: { activityId: activity.id },
    include: { items: true },
  })

  for (const ev of events) {
    const eventValue = Number(ev.eventValue) || 0
    await decGlobalDimension(tx, eventValue, 0, 1)

    const seen = new Set<number>()
    for (const item of ev.items) {
      const typeId = item.typeId
      if (seen.has(typeId)) continue
      seen.add(typeId)
      await decGlobalItem(tx, typeId, item.quantity, Number(item.totalValue) || 0)
    }
  }

  const durationMs = sessionDurationMs(activity)
  if (durationMs > 0) {
    await decGlobalDimension(tx, 0, durationMs, 0)
  }

  await tx.explorationLootEventFact.deleteMany({ where: { activityId: activity.id } })
  await tx.explorationLootAnalyticsIngestion.delete({ where: { activityId: activity.id } })
}

/**
 * Undoes ingestExplorationLootActivity's rollup contributions for this
 * activity. Call this on (soft-)delete of a previously-ingested completed
 * session — without it, the loot-intel dashboards keep counting a session
 * that no longer exists to the user.
 */
export async function retractExplorationLootForActivity(activityId: string): Promise<void> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) return

  await prisma.$transaction(async (tx) => {
    const existing = await tx.explorationLootAnalyticsIngestion.findUnique({
      where: { activityId },
    })
    if (!existing) return
    await retractExplorationLootInTx(tx, activity as ExplorationIntelActivity)
  })
}

export async function ingestExplorationLootActivity(
  activity: ActivityForLootIntel,
  options?: { reconcile?: boolean }
) {
  if (activity.type !== 'exploration' || activity.status !== 'completed') {
    return { ok: false as const, reason: 'invalid' }
  }

  const intelActivity = activity as ExplorationIntelActivity
  const data = (activity.data as Record<string, unknown>) || {}
  const fallbackOccurredAt = activity.endTime ?? activity.startTime
  const lootEvents = collectExplorationLootEvents(data, fallbackOccurredAt)

  const existing = await prisma.explorationLootAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })

  if (lootEvents.length === 0) {
    if (existing && options?.reconcile) {
      await prisma.$transaction(async (tx) => {
        await retractExplorationLootInTx(tx, intelActivity)
      })
      return { ok: true as const, eventsIngested: 0 }
    }
    return { ok: false as const, reason: 'no_loot' }
  }

  const durationMs = sessionDurationMs(intelActivity)

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.explorationLootAnalyticsIngestion.findUnique({
        where: { activityId: activity.id },
      })

      if (existing && !options?.reconcile) {
        throw new Error('already_ingested')
      }

      if (existing && options?.reconcile) {
        await retractExplorationLootInTx(tx, intelActivity)
      }

      for (const ev of lootEvents) {
        await tx.explorationLootEventFact.create({
          data: {
            activityId: activity.id,
            userId: activity.userId,
            eventValue: ev.eventValue,
            itemCount: ev.items.length,
            occurredAt: ev.occurredAt,
            items: {
              create: ev.items.map((item) => ({
                typeId: item.typeId,
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.quantity > 0 ? item.totalValue / item.quantity : 0,
                totalValue: item.totalValue,
              })),
            },
          },
        })

        await incGlobalDimension(tx, ev.eventValue)

        const seen = new Set<number>()
        for (const item of ev.items) {
          if (seen.has(item.typeId)) continue
          seen.add(item.typeId)
          await incGlobalItem(tx, item.typeId, item.itemName, item.quantity, item.totalValue)
        }
      }

      await incGlobalDimension(tx, 0, durationMs, 0)
      await tx.explorationLootAnalyticsIngestion.create({ data: { activityId: activity.id } })
    })

    return { ok: true as const, eventsIngested: lootEvents.length }
  } catch (err) {
    if (err instanceof Error && err.message === 'already_ingested') {
      return { ok: false as const, reason: 'already_ingested' }
    }
    throw err
  }
}

export async function backfillExplorationLootIntel(options?: {
  limit?: number
  reconcile?: boolean
}) {
  const limit = options?.limit ?? 500
  const candidates = await prisma.activity.findMany({
    where: { type: 'exploration', status: 'completed', isDeleted: false },
    take: limit,
    orderBy: { endTime: 'desc' },
  })
  let ingested = 0
  let skipped = 0
  let errors = 0
  for (const activity of candidates) {
    try {
      const r = await ingestExplorationLootActivity(activity, { reconcile: options?.reconcile })
      if (r.ok) ingested++
      else skipped++
    } catch (e) {
      errors++
      logger.error('exploration-loot-intel', 'Backfill error', e, { activityId: activity.id })
    }
  }
  return { processed: candidates.length, ingested, skipped, errors, reconcile: !!options?.reconcile }
}
