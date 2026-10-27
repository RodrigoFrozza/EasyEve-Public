import { prisma } from '@/lib/prisma'
import { getRattingNpcFaction } from '@/lib/constants/activity-data'
import { logger } from '@/lib/server-logger'
import { LOOT_INTEL_ALL_SPACES, rollupSpaceKey, decimalToNumber, resolveIngestedDurationMs, clampLootIntelValue } from '@/lib/analytics/loot-intel-shared'
import type { ActivityForLootIntel } from '@/lib/analytics/loot-intel-dispatch'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { Prisma } from '@prisma/client'

type LootLog = {
  type?: string
  date?: string
  amount?: number
  items?: Array<{
    typeId?: number
    typeName?: string
    name?: string
    quantity?: number
    unitPrice?: number
    totalValue?: number
  }>
}

type RattingIntelActivity = ActivityForLootIntel & {
  accumulatedPausedTime?: number | null
  isPaused?: boolean
  pausedAt?: Date | null
}

function sessionDurationMs(activity: RattingIntelActivity): number {
  return getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    accumulatedPausedTime: activity.accumulatedPausedTime ?? undefined,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })
}

function rattingSessionGross(
  data: Record<string, unknown>,
  hasLootAutoEvents: boolean
): number {
  const base =
    (Number(data.automatedBounties) || 0) +
    (Number(data.automatedEss) || 0) +
    (Number(data.additionalBounties) || 0) +
    (Number(data.estimatedSalvageValue) || 0)

  if (hasLootAutoEvents) {
    return clampLootIntelValue(base)
  }

  return clampLootIntelValue(base + (Number(data.estimatedLootValue) || 0))
}

async function decDimension(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  const row = await tx.rattingLootDimensionRollup.findUnique({
    where: { npcFaction_spaceType: { npcFaction, spaceType } },
  })
  if (!row) return

  await tx.rattingLootDimensionRollup.update({
    where: { npcFaction_spaceType: { npcFaction, spaceType } },
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

async function decItem(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  typeId: number,
  quantity: number,
  totalValue: number
) {
  const row = await tx.rattingLootItemRollup.findUnique({
    where: { npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId } },
  })
  if (!row) return

  await tx.rattingLootItemRollup.update({
    where: { npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId } },
    data: {
      eventsWithItem: Math.max(0, row.eventsWithItem - 1),
      totalQuantity: Math.max(0, row.totalQuantity - quantity),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - totalValue),
    },
  })
}

async function incDimension(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  await tx.rattingLootDimensionRollup.upsert({
    where: { npcFaction_spaceType: { npcFaction, spaceType } },
    create: {
      npcFaction,
      spaceType,
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

async function incItem(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  typeId: number,
  itemName: string,
  quantity: number,
  totalValue: number
) {
  await tx.rattingLootItemRollup.upsert({
    where: { npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId } },
    create: {
      npcFaction,
      spaceType,
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

async function retractRattingLootInTx(
  tx: Prisma.TransactionClient,
  activity: RattingIntelActivity
) {
  const existing = await tx.rattingLootAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })
  if (!existing) return

  const events = await tx.rattingLootEventFact.findMany({
    where: { activityId: activity.id },
    include: { items: true },
  })

  for (const ev of events) {
    const eventValue = Number(ev.eventValue) || 0
    await decDimension(tx, ev.npcFaction, ev.spaceType, eventValue, 0, 1)
    await decDimension(tx, ev.npcFaction, LOOT_INTEL_ALL_SPACES, eventValue, 0, 1)

    const seen = new Set<number>()
    for (const item of ev.items) {
      const typeId = item.typeId
      if (seen.has(typeId)) continue
      seen.add(typeId)
      await decItem(
        tx,
        ev.npcFaction,
        ev.spaceType,
        typeId,
        item.quantity,
        Number(item.totalValue) || 0
      )
      await decItem(
        tx,
        ev.npcFaction,
        LOOT_INTEL_ALL_SPACES,
        typeId,
        item.quantity,
        Number(item.totalValue) || 0
      )
    }
  }

  const data = (activity.data as Record<string, unknown>) || {}
  const lootLogs = ((data.logs as LootLog[]) || []).filter((l) => l.type === 'loot-auto')
  const durationMs = resolveIngestedDurationMs(
    existing.ingestedDurationMs,
    sessionDurationMs(activity)
  )
  const sessionGross = rattingSessionGross(data, lootLogs.length > 0)
  const npcFaction =
    existing.ingestedNpcFaction ??
    getRattingNpcFaction({
      data: activity.data as Record<string, unknown> | null,
    })

  if (npcFaction && (sessionGross > 0 || durationMs > 0)) {
    const spaceType = rollupSpaceKey(activity.space)
    const sessionEvents = 1
    await decDimension(tx, npcFaction, spaceType, sessionGross, durationMs, sessionEvents)
    await decDimension(tx, npcFaction, LOOT_INTEL_ALL_SPACES, sessionGross, durationMs, sessionEvents)
  }

  await tx.rattingLootEventFact.deleteMany({ where: { activityId: activity.id } })
  await tx.rattingLootAnalyticsIngestion.delete({ where: { activityId: activity.id } })
}

/**
 * Undoes ingestRattingLootActivity's rollup contributions for this activity.
 * Call this on (soft-)delete of a previously-ingested completed session —
 * without it, the loot-intel dashboards keep counting a session that no
 * longer exists to the user.
 */
export async function retractRattingLootForActivity(activityId: string): Promise<void> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) return

  await prisma.$transaction(async (tx) => {
    await retractRattingLootInTx(tx, activity as RattingIntelActivity)
  })
}

export type IngestRattingResult =
  | { ok: true; eventsIngested: number }
  | { ok: false; reason: string }

export async function ingestRattingLootActivity(
  activity: RattingIntelActivity,
  options?: { reconcile?: boolean }
): Promise<IngestRattingResult> {
  if (activity.type !== 'ratting' || activity.status !== 'completed') {
    return { ok: false, reason: 'invalid' }
  }

  const npcFaction = getRattingNpcFaction({
    data: activity.data as Record<string, unknown> | null,
  })
  if (!npcFaction) {
    logger.warn('ratting-loot-intel', 'Skip: missing npcFaction', { activityId: activity.id })
    return { ok: false, reason: 'no_faction' }
  }

  const data = (activity.data as Record<string, unknown>) || {}
  const logs = (data.logs as LootLog[]) || []
  const lootLogs = logs.filter(
    (l) => l.type === 'loot-auto' && Array.isArray(l.items) && l.items.length > 0
  )

  const durationMs = sessionDurationMs(activity)
  const sessionGross = rattingSessionGross(data, lootLogs.length > 0)
  const defaultSpace = rollupSpaceKey(activity.space)
  const spacesSeen = new Set<string>([defaultSpace])

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.rattingLootAnalyticsIngestion.findUnique({
        where: { activityId: activity.id },
      })

      if (existing && !options?.reconcile) {
        throw new Error('already_ingested')
      }

      if (existing && options?.reconcile) {
        await retractRattingLootInTx(tx, activity)
      }

      for (const log of lootLogs) {
        const spaceType = rollupSpaceKey(activity.space)
        spacesSeen.add(spaceType)
        const items = log.items || []
        let eventValue = Number(log.amount) || 0
        if (!eventValue) {
          eventValue = items.reduce(
            (s, i) =>
              s + (Number(i.totalValue) || (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1)),
            0
          )
        }
        eventValue = clampLootIntelValue(eventValue)
        const occurredAt = log.date ? new Date(log.date) : new Date()

        await tx.rattingLootEventFact.create({
          data: {
            activityId: activity.id,
            userId: activity.userId,
            npcFaction,
            spaceType,
            eventValue,
            itemCount: items.length,
            occurredAt,
            items: {
              create: items.map((item) => {
                const qty = Math.max(1, Number(item.quantity) || 1)
                const unitPrice = Number(item.unitPrice) || 0
                const total = clampLootIntelValue(Number(item.totalValue) || unitPrice * qty)
                const name = String(item.typeName || item.name || 'Unknown')
                return {
                  typeId: Number(item.typeId) || 0,
                  itemName: name,
                  quantity: qty,
                  unitPrice,
                  totalValue: total,
                }
              }),
            },
          },
        })

        await incDimension(tx, npcFaction, spaceType, eventValue)
        await incDimension(tx, npcFaction, LOOT_INTEL_ALL_SPACES, eventValue)

        const seen = new Set<number>()
        for (const item of items) {
          const typeId = Number(item.typeId) || 0
          if (seen.has(typeId)) continue
          seen.add(typeId)
          const qty = Math.max(1, Number(item.quantity) || 1)
          const total = clampLootIntelValue(
            Number(item.totalValue) || (Number(item.unitPrice) || 0) * qty
          )
          const name = String(item.typeName || item.name || 'Unknown')
          await incItem(tx, npcFaction, spaceType, typeId, name, qty, total)
          await incItem(tx, npcFaction, LOOT_INTEL_ALL_SPACES, typeId, name, qty, total)
        }
      }

      if (sessionGross > 0 || durationMs > 0) {
        const sessionEvents = 1
        for (const spaceType of spacesSeen) {
          await incDimension(tx, npcFaction, spaceType, sessionGross, durationMs, sessionEvents)
        }
        await incDimension(tx, npcFaction, LOOT_INTEL_ALL_SPACES, sessionGross, durationMs, sessionEvents)
      }

      await tx.rattingLootAnalyticsIngestion.create({
        data: {
          activityId: activity.id,
          ingestedDurationMs: BigInt(durationMs),
          ingestedNpcFaction: npcFaction,
        },
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'already_ingested') {
      return { ok: false, reason: 'already_ingested' }
    }
    throw err
  }

  return { ok: true, eventsIngested: lootLogs.length }
}

export async function backfillRattingLootIntel(options?: {
  limit?: number
  reconcile?: boolean
}) {
  const limit = options?.limit ?? 500
  const candidates = await prisma.activity.findMany({
    where: { type: 'ratting', status: 'completed', isDeleted: false },
    take: limit,
    orderBy: { endTime: 'desc' },
  })
  let ingested = 0
  let skipped = 0
  let errors = 0
  for (const activity of candidates) {
    try {
      const r = await ingestRattingLootActivity(activity, { reconcile: options?.reconcile })
      if (r.ok) ingested++
      else skipped++
    } catch (e) {
      errors++
      logger.error('ratting-loot-intel', 'Backfill error', e, { activityId: activity.id })
    }
  }
  return { processed: candidates.length, ingested, skipped, errors, reconcile: !!options?.reconcile }
}
