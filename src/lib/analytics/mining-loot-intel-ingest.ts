import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { LOOT_INTEL_ALL_SPACES, rollupSpaceKey, splitDurationByValue, decimalToNumber, resolveIngestedDurationMs, clampLootIntelValue } from '@/lib/analytics/loot-intel-shared'
import type { ActivityForLootIntel } from '@/lib/analytics/loot-intel-dispatch'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { Prisma } from '@prisma/client'

type MiningLog = {
  date?: string
  oreName?: string
  typeId?: number
  quantity?: number
  estimatedValue?: number
  value?: number
  regionId?: number
  regionName?: string
}

function sessionDurationMs(activity: ActivityForLootIntel): number {
  return getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    accumulatedPausedTime: activity.accumulatedPausedTime ?? undefined,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })
}

async function incDimension(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  spaceType: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  await tx.miningLootDimensionRollup.upsert({
    where: { miningCategory_spaceType: { miningCategory, spaceType } },
    create: {
      miningCategory,
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

async function decDimension(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  spaceType: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  const row = await tx.miningLootDimensionRollup.findUnique({
    where: { miningCategory_spaceType: { miningCategory, spaceType } },
  })
  if (!row) return

  await tx.miningLootDimensionRollup.update({
    where: { miningCategory_spaceType: { miningCategory, spaceType } },
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

async function incRegion(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  regionId: number,
  regionName: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  await tx.miningLootRegionRollup.upsert({
    where: { miningCategory_regionId: { miningCategory, regionId } },
    create: {
      miningCategory,
      regionId,
      regionName,
      totalEvents: extraEvents,
      totalValue: eventValue,
      totalDurationMs: BigInt(extraDurationMs),
    },
    update: {
      regionName,
      totalEvents: { increment: extraEvents },
      totalValue: { increment: eventValue },
      ...(extraDurationMs > 0
        ? { totalDurationMs: { increment: BigInt(extraDurationMs) } }
        : {}),
    },
  })
}

async function decRegion(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  regionId: number,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  const row = await tx.miningLootRegionRollup.findUnique({
    where: { miningCategory_regionId: { miningCategory, regionId } },
  })
  if (!row) return

  await tx.miningLootRegionRollup.update({
    where: { miningCategory_regionId: { miningCategory, regionId } },
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

async function incItem(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  spaceType: string,
  typeId: number,
  itemName: string,
  quantity: number,
  totalValue: number
) {
  await tx.miningLootItemRollup.upsert({
    where: {
      miningCategory_spaceType_typeId: { miningCategory, spaceType, typeId },
    },
    create: {
      miningCategory,
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

async function decItem(
  tx: Prisma.TransactionClient,
  miningCategory: string,
  spaceType: string,
  typeId: number,
  quantity: number,
  totalValue: number
) {
  const row = await tx.miningLootItemRollup.findUnique({
    where: { miningCategory_spaceType_typeId: { miningCategory, spaceType, typeId } },
  })
  if (!row) return

  await tx.miningLootItemRollup.update({
    where: { miningCategory_spaceType_typeId: { miningCategory, spaceType, typeId } },
    data: {
      eventsWithItem: Math.max(0, row.eventsWithItem - 1),
      totalQuantity: Math.max(0, row.totalQuantity - quantity),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - totalValue),
    },
  })
}

function buildRegionTotals(logs: MiningLog[]) {
  const regionTotals = new Map<number, { name: string; value: number; events: number }>()
  for (const log of logs) {
    const regionId = Number(log.regionId) || 0
    if (regionId <= 0) continue
    const total = clampLootIntelValue(Number(log.estimatedValue) || Number(log.value) || 0)
    const existing = regionTotals.get(regionId)
    if (existing) {
      existing.value += total
      existing.events += 1
      if (log.regionName) existing.name = log.regionName
    } else {
      regionTotals.set(regionId, {
        name: String(log.regionName || `Region ${regionId}`),
        value: total,
        events: 1,
      })
    }
  }
  return regionTotals
}

async function ingestMiningLootInTx(
  tx: Prisma.TransactionClient,
  activity: ActivityForLootIntel,
  logs: MiningLog[],
  miningCategory: string,
  durationMs: number,
  spaceType: string
) {
  const regionTotals = buildRegionTotals(logs)

  for (const log of logs) {
    const qty = Math.max(1, Number(log.quantity) || 1)
    const total = clampLootIntelValue(Number(log.estimatedValue) || Number(log.value) || 0)
    const typeId = Number(log.typeId) || 0
    const itemName = String(log.oreName || 'Unknown')
    const occurredAt = log.date ? new Date(log.date) : new Date()
    const regionId = Number(log.regionId) || null
    const regionName = log.regionName ? String(log.regionName) : null

    await tx.miningLootEventFact.create({
      data: {
        activityId: activity.id,
        userId: activity.userId,
        miningCategory,
        spaceType,
        regionId,
        regionName,
        eventValue: total,
        itemCount: 1,
        occurredAt,
        items: {
          create: [{ typeId, itemName, quantity: qty, unitPrice: total / qty, totalValue: total }],
        },
      },
    })

    await incDimension(tx, miningCategory, spaceType, total)
    await incDimension(tx, miningCategory, LOOT_INTEL_ALL_SPACES, total)
    await incItem(tx, miningCategory, spaceType, typeId, itemName, qty, total)
    await incItem(tx, miningCategory, LOOT_INTEL_ALL_SPACES, typeId, itemName, qty, total)
  }

  await incDimension(tx, miningCategory, spaceType, 0, durationMs, 0)
  await incDimension(tx, miningCategory, LOOT_INTEL_ALL_SPACES, 0, durationMs, 0)

  for (const [regionId, meta] of regionTotals) {
    await incRegion(tx, miningCategory, regionId, meta.name, meta.value, 0, meta.events)
  }

  if (regionTotals.size > 0 && durationMs > 0) {
    const regionDurationSplit = splitDurationByValue(
      durationMs,
      [...regionTotals.entries()].map(([regionId, meta]) => ({
        key: regionId,
        value: meta.value,
      }))
    )
    for (const [regionId, meta] of regionTotals) {
      const regionDuration = regionDurationSplit.get(regionId) ?? 0
      if (regionDuration > 0) {
        await incRegion(tx, miningCategory, regionId, meta.name, 0, regionDuration, 0)
      }
    }
  }

  await tx.miningLootAnalyticsIngestion.create({
    data: {
      activityId: activity.id,
      ingestedDurationMs: BigInt(durationMs),
      ingestedSpaceType: spaceType,
      ingestedMiningCategory: miningCategory,
    },
  })
}

async function retractMiningLootInTx(
  tx: Prisma.TransactionClient,
  activity: ActivityForLootIntel
) {
  const existing = await tx.miningLootAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })
  if (!existing) return

  const events = await tx.miningLootEventFact.findMany({
    where: { activityId: activity.id },
    include: { items: true },
  })

  if (events.length === 0) {
    await tx.miningLootAnalyticsIngestion.delete({ where: { activityId: activity.id } })
    return
  }

  const miningCategory =
    existing.ingestedMiningCategory ?? events[0].miningCategory
  const spaceType = existing.ingestedSpaceType ?? events[0].spaceType
  const durationMs = resolveIngestedDurationMs(
    existing.ingestedDurationMs,
    sessionDurationMs(activity)
  )

  for (const ev of events) {
    const eventValue = Number(ev.eventValue) || 0
    await decDimension(tx, ev.miningCategory, ev.spaceType, eventValue, 0, 1)
    await decDimension(tx, ev.miningCategory, LOOT_INTEL_ALL_SPACES, eventValue, 0, 1)

    for (const item of ev.items) {
      await decItem(
        tx,
        ev.miningCategory,
        ev.spaceType,
        item.typeId,
        item.quantity,
        Number(item.totalValue) || 0
      )
      await decItem(
        tx,
        ev.miningCategory,
        LOOT_INTEL_ALL_SPACES,
        item.typeId,
        item.quantity,
        Number(item.totalValue) || 0
      )
    }
  }

  await decDimension(tx, miningCategory, spaceType, 0, durationMs, 0)
  await decDimension(tx, miningCategory, LOOT_INTEL_ALL_SPACES, 0, durationMs, 0)

  const regionTotals = new Map<number, { value: number; events: number }>()
  for (const ev of events) {
    const regionId = ev.regionId
    if (!regionId || regionId <= 0) continue
    const total = Number(ev.eventValue) || 0
    const existingRegion = regionTotals.get(regionId)
    if (existingRegion) {
      existingRegion.value += total
      existingRegion.events += 1
    } else {
      regionTotals.set(regionId, { value: total, events: 1 })
    }
  }

  for (const [regionId, meta] of regionTotals) {
    await decRegion(tx, miningCategory, regionId, meta.value, 0, meta.events)
  }

  if (regionTotals.size > 0 && durationMs > 0) {
    const regionDurationSplit = splitDurationByValue(
      durationMs,
      [...regionTotals.entries()].map(([regionId, meta]) => ({
        key: regionId,
        value: meta.value,
      }))
    )
    for (const [regionId, meta] of regionTotals) {
      const regionDuration = regionDurationSplit.get(regionId) ?? 0
      if (regionDuration > 0) {
        await decRegion(tx, miningCategory, regionId, 0, regionDuration, 0)
      }
    }
  }

  await tx.miningLootEventFact.deleteMany({ where: { activityId: activity.id } })
  await tx.miningLootAnalyticsIngestion.delete({ where: { activityId: activity.id } })
}

export async function retractMiningLootForActivity(activityId: string): Promise<void> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) return

  await prisma.$transaction(async (tx) => {
    await retractMiningLootInTx(tx, activity)
  })
}

export type IngestMiningLootResult =
  | { ok: true; eventsIngested: number }
  | { ok: false; reason: 'invalid' | 'already_ingested' | 'no_logs' }

export async function ingestMiningLootActivity(
  activity: ActivityForLootIntel,
  options?: { reconcile?: boolean }
): Promise<IngestMiningLootResult> {
  if (activity.type !== 'mining' || activity.status !== 'completed') {
    return { ok: false, reason: 'invalid' }
  }

  const data = (activity.data as Record<string, unknown>) || {}
  const miningCategory = String(data.miningType || 'Ore').trim()
  const logs = (data.logs as MiningLog[]) || []

  const existing = await prisma.miningLootAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })
  if (existing && !options?.reconcile) {
    return { ok: false, reason: 'already_ingested' }
  }
  if (logs.length === 0 && !(existing && options?.reconcile)) {
    return { ok: false, reason: 'no_logs' }
  }

  const durationMs = sessionDurationMs(activity)
  const spaceType = rollupSpaceKey(activity.space)

  try {
    await prisma.$transaction(async (tx) => {
      const ingested = await tx.miningLootAnalyticsIngestion.findUnique({
        where: { activityId: activity.id },
      })

      if (ingested && options?.reconcile) {
        await retractMiningLootInTx(tx, activity)
      }

      if (logs.length === 0) {
        return
      }

      await ingestMiningLootInTx(tx, activity, logs, miningCategory, durationMs, spaceType)
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'no_logs') {
      return { ok: false, reason: 'no_logs' }
    }
    throw err
  }

  return { ok: true, eventsIngested: logs.length }
}

export async function backfillMiningLootIntel(options?: {
  limit?: number
  reconcile?: boolean
}) {
  const limit = options?.limit ?? 500
  const candidates = await prisma.activity.findMany({
    where: { type: 'mining', status: 'completed', isDeleted: false },
    take: limit,
    orderBy: { endTime: 'desc' },
  })
  let ingested = 0
  let skipped = 0
  let errors = 0
  for (const activity of candidates) {
    try {
      const r = await ingestMiningLootActivity(activity, { reconcile: options?.reconcile })
      if (r.ok) ingested++
      else skipped++
    } catch (e) {
      errors++
      logger.error('mining-loot-intel', 'Backfill error', e, { activityId: activity.id })
    }
  }
  return { processed: candidates.length, ingested, skipped, errors, reconcile: !!options?.reconcile }
}
