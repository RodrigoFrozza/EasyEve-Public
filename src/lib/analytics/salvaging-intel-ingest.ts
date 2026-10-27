import { prisma } from '@/lib/prisma'
import { getSalvagingNpcFaction } from '@/lib/constants/activity-data'
import { logger } from '@/lib/server-logger'
import { SALVAGE_INTEL_ALL_SPACES, rollupSpaceKey } from '@/lib/analytics/salvaging-intel'
import { splitDurationByValue, decimalToNumber, resolveIngestedDurationMs } from '@/lib/analytics/loot-intel-shared'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { Prisma } from '@prisma/client'

type SalvageLogItem = {
  name?: string
  quantity?: number
  typeId?: number
  price?: number
  total?: number
}

type SalvageLog = {
  type?: string
  spaceType?: string
  value?: number
  items?: SalvageLogItem[]
  date?: string
}

type ActivityForIngest = {
  id: string
  userId: string
  type: string
  status: string
  region?: string | null
  space?: string | null
  startTime: Date
  endTime?: Date | null
  data: unknown
  isPaused?: boolean
  accumulatedPausedTime?: number | null
  pausedAt?: Date | null
}

function sessionDurationMs(activity: ActivityForIngest): number {
  return getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    accumulatedPausedTime: activity.accumulatedPausedTime ?? undefined,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })
}

async function incrementFactionRollup(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  batchValue: number,
  extraDurationMs = 0,
  extraBatches = 1
) {
  await tx.salvageFactionRollup.upsert({
    where: {
      npcFaction_spaceType: { npcFaction, spaceType },
    },
    create: {
      npcFaction,
      spaceType,
      totalBatches: extraBatches,
      totalValue: batchValue,
      totalDurationMs: BigInt(extraDurationMs),
    },
    update: {
      totalBatches: { increment: extraBatches },
      totalValue: { increment: batchValue },
      ...(extraDurationMs > 0
        ? { totalDurationMs: { increment: BigInt(extraDurationMs) } }
        : {}),
    },
  })
}

async function decrementFactionRollup(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  batchValue: number,
  extraDurationMs = 0,
  extraBatches = 1
) {
  const row = await tx.salvageFactionRollup.findUnique({
    where: {
      npcFaction_spaceType: { npcFaction, spaceType },
    },
  })
  if (!row) return

  await tx.salvageFactionRollup.update({
    where: {
      npcFaction_spaceType: { npcFaction, spaceType },
    },
    data: {
      totalBatches: Math.max(0, row.totalBatches - extraBatches),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - batchValue),
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

async function incrementItemRollup(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  typeId: number,
  itemName: string,
  quantity: number,
  totalValue: number
) {
  await tx.salvageItemRollup.upsert({
    where: {
      npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId },
    },
    create: {
      npcFaction,
      spaceType,
      typeId,
      itemName,
      batchesWithItem: 1,
      totalQuantity: quantity,
      totalValue,
    },
    update: {
      itemName,
      batchesWithItem: { increment: 1 },
      totalQuantity: { increment: quantity },
      totalValue: { increment: totalValue },
    },
  })
}

async function decrementItemRollup(
  tx: Prisma.TransactionClient,
  npcFaction: string,
  spaceType: string,
  typeId: number,
  quantity: number,
  totalValue: number
) {
  const row = await tx.salvageItemRollup.findUnique({
    where: {
      npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId },
    },
  })
  if (!row) return

  await tx.salvageItemRollup.update({
    where: {
      npcFaction_spaceType_typeId: { npcFaction, spaceType, typeId },
    },
    data: {
      batchesWithItem: Math.max(0, row.batchesWithItem - 1),
      totalQuantity: Math.max(0, row.totalQuantity - quantity),
      totalValue: Math.max(0, decimalToNumber(row.totalValue) - totalValue),
    },
  })
}

async function ingestSalvagingInTx(
  tx: Prisma.TransactionClient,
  activity: ActivityForIngest,
  npcFaction: string,
  salvageLogs: SalvageLog[],
  durationMs: number
): Promise<number> {
  const spacesSeen = new Set<string>()
  const spaceValues = new Map<string, number>()
  let batchCount = 0

  for (const log of salvageLogs) {
    const spaceType = rollupSpaceKey(log.spaceType || activity.space)
    const items = log.items || []
    const batchValue = Number(log.value) || 0
    const occurredAt = log.date ? new Date(log.date) : new Date()

    await tx.salvageBatchFact.create({
      data: {
        activityId: activity.id,
        userId: activity.userId,
        npcFaction,
        spaceType,
        batchValue,
        itemCount: items.length,
        occurredAt,
        items: {
          create: items.map((item) => {
            const qty = Math.max(1, Number(item.quantity) || 1)
            const unitPrice = Number(item.price) || 0
            const total = Number(item.total) || unitPrice * qty
            return {
              typeId: Number(item.typeId) || 0,
              itemName: String(item.name || 'Unknown'),
              quantity: qty,
              unitPrice,
              totalValue: total,
            }
          }),
        },
      },
    })

    batchCount += 1
    spacesSeen.add(spaceType)
    spaceValues.set(spaceType, (spaceValues.get(spaceType) ?? 0) + batchValue)

    await incrementFactionRollup(tx, npcFaction, spaceType, batchValue)
    await incrementFactionRollup(tx, npcFaction, SALVAGE_INTEL_ALL_SPACES, batchValue)

    const seenTypeIds = new Set<number>()
    for (const item of items) {
      const typeId = Number(item.typeId) || 0
      const qty = Math.max(1, Number(item.quantity) || 1)
      const total = Number(item.total) || (Number(item.price) || 0) * qty
      const itemName = String(item.name || 'Unknown')

      if (!seenTypeIds.has(typeId)) {
        seenTypeIds.add(typeId)
        await incrementItemRollup(tx, npcFaction, spaceType, typeId, itemName, qty, total)
        await incrementItemRollup(
          tx,
          npcFaction,
          SALVAGE_INTEL_ALL_SPACES,
          typeId,
          itemName,
          qty,
          total
        )
      }
    }
  }

  const spaceDurationSplit = splitDurationByValue(
    durationMs,
    [...spacesSeen].map((spaceType) => ({
      key: spaceType,
      value: spaceValues.get(spaceType) ?? 0,
    }))
  )
  for (const spaceType of spacesSeen) {
    const spaceDuration = spaceDurationSplit.get(spaceType) ?? 0
    if (spaceDuration > 0) {
      await incrementFactionRollup(tx, npcFaction, spaceType, 0, spaceDuration, 0)
    }
  }
  if (durationMs > 0) {
    await incrementFactionRollup(tx, npcFaction, SALVAGE_INTEL_ALL_SPACES, 0, durationMs, 0)
  }

  await tx.salvageAnalyticsIngestion.create({
    data: {
      activityId: activity.id,
      ingestedDurationMs: BigInt(durationMs),
      ingestedNpcFaction: npcFaction,
    },
  })

  logger.info('salvaging-intel', 'Ingested salvaging session', {
    activityId: activity.id,
    batches: batchCount,
    npcFaction,
  })

  return batchCount
}

export async function retractSalvagingInTx(
  tx: Prisma.TransactionClient,
  activity: ActivityForIngest
): Promise<void> {
  const ingestion = await tx.salvageAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })

  const batches = await tx.salvageBatchFact.findMany({
    where: { activityId: activity.id },
    include: { items: true },
  })

  if (batches.length === 0) {
    if (ingestion) {
      await tx.salvageAnalyticsIngestion.delete({ where: { activityId: activity.id } })
    }
    return
  }

  const npcFaction = ingestion?.ingestedNpcFaction ?? batches[0].npcFaction
  const spacesSeen = new Set<string>()
  const spaceValues = new Map<string, number>()
  const durationMs = resolveIngestedDurationMs(
    ingestion?.ingestedDurationMs,
    sessionDurationMs(activity)
  )

  for (const batch of batches) {
    const spaceType = batch.spaceType
    const batchValue = Number(batch.batchValue) || 0
    spacesSeen.add(spaceType)
    spaceValues.set(spaceType, (spaceValues.get(spaceType) ?? 0) + batchValue)

    await decrementFactionRollup(tx, npcFaction, spaceType, batchValue)
    await decrementFactionRollup(tx, npcFaction, SALVAGE_INTEL_ALL_SPACES, batchValue)

    const seenTypeIds = new Set<number>()
    for (const item of batch.items) {
      const typeId = item.typeId
      if (seenTypeIds.has(typeId)) continue
      seenTypeIds.add(typeId)

      const qty = item.quantity
      const total = Number(item.totalValue) || 0
      await decrementItemRollup(tx, npcFaction, spaceType, typeId, qty, total)
      await decrementItemRollup(tx, npcFaction, SALVAGE_INTEL_ALL_SPACES, typeId, qty, total)
    }
  }

  const spaceDurationSplit = splitDurationByValue(
    durationMs,
    [...spacesSeen].map((spaceType) => ({
      key: spaceType,
      value: spaceValues.get(spaceType) ?? 0,
    }))
  )
  for (const spaceType of spacesSeen) {
    const spaceDuration = spaceDurationSplit.get(spaceType) ?? 0
    if (spaceDuration > 0) {
      await decrementFactionRollup(tx, npcFaction, spaceType, 0, spaceDuration, 0)
    }
  }
  if (durationMs > 0) {
    await decrementFactionRollup(tx, npcFaction, SALVAGE_INTEL_ALL_SPACES, 0, durationMs, 0)
  }

  await tx.salvageBatchFact.deleteMany({ where: { activityId: activity.id } })
  await tx.salvageAnalyticsIngestion.deleteMany({ where: { activityId: activity.id } })
}

export async function retractSalvagingForActivity(activityId: string): Promise<void> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) return

  await prisma.$transaction(async (tx) => {
    await retractSalvagingInTx(tx, activity)
  })
}

export type IngestSalvagingResult =
  | { ok: true; batchesIngested: number }
  | { ok: false; reason: 'already_ingested' | 'not_salvaging' | 'not_completed' | 'no_faction' | 'no_batches' }

export async function ingestSalvagingActivity(
  activity: ActivityForIngest,
  options?: { reconcile?: boolean }
): Promise<IngestSalvagingResult> {
  if (activity.type !== 'salvaging') {
    return { ok: false, reason: 'not_salvaging' }
  }
  if (activity.status !== 'completed') {
    return { ok: false, reason: 'not_completed' }
  }

  const npcFaction = getSalvagingNpcFaction({
    region: activity.region,
    data: activity.data as Record<string, unknown> | null,
  })
  if (!npcFaction) {
    logger.warn('salvaging-intel', 'Skip ingest: missing npcFaction', { activityId: activity.id })
    return { ok: false, reason: 'no_faction' }
  }

  const data = (activity.data as Record<string, unknown>) || {}
  const logs = (data.logs as SalvageLog[]) || []
  const salvageLogs = logs.filter((l) => l.type === 'salvage' || l.type === 'loot-auto')
  if (salvageLogs.length === 0) {
    if (options?.reconcile) {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.salvageAnalyticsIngestion.findUnique({
          where: { activityId: activity.id },
        })
        if (existing) {
          await retractSalvagingInTx(tx, activity)
        }
      })
    }
    return { ok: false, reason: 'no_batches' }
  }

  const durationMs = sessionDurationMs(activity)

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.salvageAnalyticsIngestion.findUnique({
        where: { activityId: activity.id },
      })

      if (existing && !options?.reconcile) {
        throw new Error('already_ingested')
      }

      if (existing && options?.reconcile) {
        await retractSalvagingInTx(tx, activity)
      }

      await ingestSalvagingInTx(tx, activity, npcFaction, salvageLogs, durationMs)
    })

    return { ok: true, batchesIngested: salvageLogs.length }
  } catch (err) {
    if (err instanceof Error && err.message === 'already_ingested') {
      return { ok: false, reason: 'already_ingested' }
    }
    throw err
  }
}

export async function ingestSalvagingActivityById(activityId: string): Promise<IngestSalvagingResult> {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, isDeleted: false },
  })
  if (!activity) {
    return { ok: false, reason: 'not_salvaging' }
  }
  return ingestSalvagingActivity(activity)
}

export async function backfillSalvagingIntel(options?: {
  limit?: number
  reconcile?: boolean
}): Promise<{ processed: number; ingested: number; skipped: number; errors: number; reconcile: boolean }> {
  const limit = options?.limit ?? 500
  const candidates = await prisma.activity.findMany({
    where: {
      type: 'salvaging',
      status: 'completed',
      isDeleted: false,
    },
    take: limit,
    orderBy: { endTime: 'desc' },
  })

  let ingested = 0
  let skipped = 0
  let errors = 0

  for (const activity of candidates) {
    try {
      const result = await ingestSalvagingActivity(activity, { reconcile: options?.reconcile })
      if (result.ok) ingested += 1
      else skipped += 1
    } catch (e) {
      errors += 1
      logger.error('salvaging-intel', 'Backfill error', e, { activityId: activity.id })
    }
  }

  return { processed: candidates.length, ingested, skipped, errors, reconcile: !!options?.reconcile }
}
