import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import type { ActivityForLootIntel } from '@/lib/analytics/loot-intel-dispatch'
import { Prisma } from '@prisma/client'
import { decimalToNumber, clampLootIntelValue } from '@/lib/analytics/loot-intel-shared'

type AbyssalRun = {
  status?: string
  startTime?: string
  endTime?: string
  tier?: string
  weather?: string
  lootValue?: number
  lootItems?: Array<{
    name?: string
    quantity?: number
    value?: number
    typeId?: number
    id?: number
  }>
}

function normTier(tier?: string) {
  return tier?.trim() || 'unknown'
}

function normWeather(weather?: string) {
  return weather?.trim() || 'unknown'
}

function isIngestibleRun(run: AbyssalRun): boolean {
  return (
    (run.status === 'completed' || run.status === 'success') &&
    Boolean(run.lootItems?.length || run.lootValue)
  )
}

function resolveTypeId(item: { typeId?: number; id?: number }): number {
  return Number(item.typeId ?? item.id) || 0
}

function runDurationMs(run: AbyssalRun): number {
  if (!run.startTime || !run.endTime) return 0
  return Math.max(
    0,
    new Date(run.endTime).getTime() - new Date(run.startTime).getTime()
  )
}

async function incDimension(
  tx: Prisma.TransactionClient,
  tier: string,
  weather: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  await tx.abyssalLootDimensionRollup.upsert({
    where: { tier_weather: { tier, weather } },
    create: {
      tier,
      weather,
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
  tier: string,
  weather: string,
  eventValue: number,
  extraDurationMs = 0,
  extraEvents = 1
) {
  const existing = await tx.abyssalLootDimensionRollup.findUnique({
    where: { tier_weather: { tier, weather } },
  })
  if (!existing) return

  await tx.abyssalLootDimensionRollup.update({
    where: { tier_weather: { tier, weather } },
    data: {
      totalEvents: Math.max(0, existing.totalEvents - extraEvents),
      totalValue: Math.max(0, decimalToNumber(existing.totalValue) - eventValue),
      totalDurationMs: BigInt(
        Math.max(0, Number(existing.totalDurationMs) - extraDurationMs)
      ),
    },
  })
}

async function incItem(
  tx: Prisma.TransactionClient,
  tier: string,
  weather: string,
  typeId: number,
  itemName: string,
  quantity: number,
  totalValue: number
) {
  await tx.abyssalLootItemRollup.upsert({
    where: { tier_weather_typeId: { tier, weather, typeId } },
    create: {
      tier,
      weather,
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
  tier: string,
  weather: string,
  typeId: number,
  quantity: number,
  totalValue: number
) {
  const existing = await tx.abyssalLootItemRollup.findUnique({
    where: { tier_weather_typeId: { tier, weather, typeId } },
  })
  if (!existing) return

  await tx.abyssalLootItemRollup.update({
    where: { tier_weather_typeId: { tier, weather, typeId } },
    data: {
      eventsWithItem: Math.max(0, existing.eventsWithItem - 1),
      totalQuantity: Math.max(0, existing.totalQuantity - quantity),
      totalValue: Math.max(0, decimalToNumber(existing.totalValue) - totalValue),
    },
  })
}

async function retractAbyssalLootInTx(
  tx: Prisma.TransactionClient,
  activity: ActivityForLootIntel
) {
  const existing = await tx.abyssalLootAnalyticsIngestion.findUnique({
    where: { activityId: activity.id },
  })
  if (!existing) return

  const events = await tx.abyssalLootEventFact.findMany({
    where: { activityId: activity.id },
    include: { items: true },
  })

  for (const ev of events) {
    const eventValue = decimalToNumber(ev.eventValue)
    const durationMs = Number(ev.durationMs) || 0
    await decDimension(tx, ev.tier, ev.weather, eventValue, durationMs, 1)

    const seen = new Set<string>()
    for (const item of ev.items) {
      const dedupeKey = `${item.typeId}:${item.itemName}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      await decItem(
        tx,
        ev.tier,
        ev.weather,
        item.typeId,
        item.quantity,
        decimalToNumber(item.totalValue)
      )
    }
  }

  await tx.abyssalLootEventFact.deleteMany({ where: { activityId: activity.id } })
  await tx.abyssalLootAnalyticsIngestion.delete({ where: { activityId: activity.id } })
}

export async function retractAbyssalLootForActivity(activityId: string) {
  const activity = await prisma.activity.findUnique({ where: { id: activityId } })
  if (!activity) return

  await prisma.$transaction(async (tx) => {
    await retractAbyssalLootInTx(tx, activity)
  })
}

export async function ingestAbyssalLootActivity(
  activity: ActivityForLootIntel,
  options?: { reconcile?: boolean }
) {
  if (activity.type !== 'abyssal' || activity.status !== 'completed') {
    return { ok: false as const, reason: 'invalid' }
  }

  const data = (activity.data as Record<string, unknown>) || {}
  const defaultTier = normTier(
    (data.lastRunDefaults as { tier?: string })?.tier || (data.tier as string)
  )
  const defaultWeather = normWeather(
    (data.lastRunDefaults as { weather?: string })?.weather || (data.weather as string)
  )

  const runs = ((data.runs as AbyssalRun[]) || []).filter(isIngestibleRun)

  if (runs.length === 0) {
    if (options?.reconcile) {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.abyssalLootAnalyticsIngestion.findUnique({
          where: { activityId: activity.id },
        })
        if (existing) {
          await retractAbyssalLootInTx(tx, activity)
        }
      })
      return { ok: true as const, eventsIngested: 0 }
    }
    return { ok: false as const, reason: 'no_runs' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.abyssalLootAnalyticsIngestion.findUnique({
        where: { activityId: activity.id },
      })

      if (existing && !options?.reconcile) {
        throw new Error('already_ingested')
      }

      if (existing && options?.reconcile) {
        await retractAbyssalLootInTx(tx, activity)
      }

      for (const run of runs) {
        const tier = normTier(run.tier || defaultTier)
        const weather = normWeather(run.weather || defaultWeather)
        const durationMs = runDurationMs(run)

        const items = (run.lootItems || []).map((i) => {
          const qty = Math.max(1, Number(i.quantity) || 1)
          const total = clampLootIntelValue(Number(i.value) || 0)
          return {
            typeId: resolveTypeId(i),
            itemName: String(i.name || 'Unknown'),
            quantity: qty,
            totalValue: total,
          }
        })

        let eventValue = clampLootIntelValue(Number(run.lootValue) || 0)
        if (!eventValue) eventValue = clampLootIntelValue(items.reduce((s, i) => s + i.totalValue, 0))
        const occurredAt = run.startTime ? new Date(run.startTime) : new Date()

        await tx.abyssalLootEventFact.create({
          data: {
            activityId: activity.id,
            userId: activity.userId,
            tier,
            weather,
            eventValue,
            itemCount: items.length,
            occurredAt,
            durationMs: BigInt(durationMs),
            items: {
              create: items.map((item) => ({
                typeId: item.typeId,
                itemName: item.itemName,
                quantity: item.quantity,
                unitPrice: item.quantity > 0 ? item.totalValue / item.quantity : 0,
                totalValue: item.totalValue,
              })),
            },
          },
        })

        await incDimension(tx, tier, weather, eventValue, durationMs, 1)

        const seen = new Set<string>()
        for (const item of items) {
          const dedupeKey = `${item.typeId}:${item.itemName}`
          if (seen.has(dedupeKey)) continue
          seen.add(dedupeKey)
          await incItem(
            tx,
            tier,
            weather,
            item.typeId,
            item.itemName,
            item.quantity,
            item.totalValue
          )
        }
      }

      await tx.abyssalLootAnalyticsIngestion.create({ data: { activityId: activity.id } })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'already_ingested') {
      return { ok: false as const, reason: 'already_ingested' }
    }
    throw err
  }

  return { ok: true as const, eventsIngested: runs.length }
}

export async function backfillAbyssalLootIntel(options?: {
  limit?: number
  reconcile?: boolean
}) {
  const limit = options?.limit ?? 500

  const candidates = await prisma.activity.findMany({
    where: {
      type: 'abyssal',
      status: 'completed',
      isDeleted: false,
    },
    take: limit,
    orderBy: { endTime: 'desc' },
  })

  let ingestedCount = 0
  let skipped = 0
  let errors = 0
  for (const activity of candidates) {
    try {
      const r = await ingestAbyssalLootActivity(activity, { reconcile: options?.reconcile })
      if (r.ok) ingestedCount++
      else skipped++
    } catch (e) {
      errors++
      logger.error('abyssal-loot-intel', 'Backfill error', e, { activityId: activity.id })
    }
  }
  return { processed: candidates.length, ingested: ingestedCount, skipped, errors, reconcile: !!options?.reconcile }
}
