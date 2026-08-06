import type { Activity } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mergeRattingLogs } from '@/lib/activities/ratting-logs-merge'
import type { RattingLogLike } from '@/lib/activities/ratting-log-dedup'
import { getCharacterAssets, getCharacterAssetNames, getTypeName } from '@/lib/esi'
import { getMarketAppraisalDetailed } from '@/lib/market'
import { logger } from '@/lib/server-logger'

const component = 'Activity:LootSync'

export interface ContainerContent {
  typeId: number
  typeName: string
  quantity: number
}

export interface LootSnapshot {
  [typeId: number]: number
}

export interface LootDelta {
  typeId: number
  typeName: string
  quantity: number
  unitPrice: number
  totalValue: number
}

export interface ValuedLootItem extends LootDelta {
  source?: string
}

type ContainerLootProfile = {
  allowedTypes: string[]
  logType: string
  valueField: 'estimatedLootValue' | 'totalLootValue'
  buildLogEntry: (params: {
    totalValue: number
    charId: number
    items: ValuedLootItem[]
    activity: Activity
    activityData: Record<string, unknown>
  }) => Record<string, unknown>
}

const LOOT_PROFILES: Record<string, ContainerLootProfile> = {
  ratting: {
    allowedTypes: ['ratting'],
    logType: 'loot-auto',
    valueField: 'estimatedLootValue',
    buildLogEntry: ({ totalValue, charId, items }) => ({
      refId: `loot-auto-${Date.now()}`,
      date: new Date().toISOString(),
      amount: totalValue,
      type: 'loot-auto',
      charName: 'Auto Loot',
      charId,
      items,
    }),
  },
  exploration: {
    allowedTypes: ['exploration'],
    logType: 'loot',
    valueField: 'totalLootValue',
    buildLogEntry: ({ totalValue, charId, items, activity, activityData }) => ({
      refId: `loot-auto-${Date.now()}`,
      date: new Date().toISOString(),
      amount: totalValue,
      value: totalValue,
      type: 'loot',
      siteName: 'Auto Container',
      spaceType: activity.space || String(activityData.currentSpaceType || 'Unknown'),
      charName: 'Auto Loot',
      charId,
      items: items.map((item) => ({
        name: item.typeName,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.totalValue,
        typeId: item.typeId,
      })),
    }),
  },
  salvaging: {
    allowedTypes: ['salvaging'],
    logType: 'loot-auto',
    valueField: 'totalLootValue',
    buildLogEntry: ({ totalValue, charId, items, activity }) => ({
      refId: `loot-auto-${Date.now()}`,
      date: new Date().toISOString(),
      amount: totalValue,
      value: totalValue,
      type: 'loot-auto',
      label: 'Auto Container',
      spaceType: activity.space || 'Highsec',
      charName: 'Auto Loot',
      charId,
      items: items.map((item) => ({
        name: item.typeName,
        quantity: item.quantity,
        price: item.unitPrice,
        total: item.totalValue,
        typeId: item.typeId,
      })),
    }),
  },
}

export const AUTO_LOOT_SUPPORTED_TYPES = Object.keys(LOOT_PROFILES)

export function buildLootSnapshotFromContents(contents: ContainerContent[]): LootSnapshot {
  const snapshot: LootSnapshot = {}
  for (const item of contents) {
    snapshot[item.typeId] = (snapshot[item.typeId] || 0) + item.quantity
  }
  return snapshot
}

export function calculateDelta(oldSnapshot: LootSnapshot, newSnapshot: LootSnapshot): LootDelta[] {
  const delta: LootDelta[] = []

  for (const [typeIdStr, newQty] of Object.entries(newSnapshot)) {
    const typeId = Number(typeIdStr)
    const oldQty = oldSnapshot[typeId] || 0
    const diff = newQty - oldQty

    if (diff > 0) {
      delta.push({
        typeId,
        typeName: '',
        quantity: diff,
        unitPrice: 0,
        totalValue: 0,
      })
    }
  }

  return delta
}

/**
 * Rolls a fresh container reading into the stored baseline used by calculateDelta.
 *
 * A typeId's baseline only ever increases while it's still present in the
 * container. A plain quantity drop (partial sale/reprocessing) is indistinguishable
 * from "already-counted loot leaving" using a single before/after reading, so the
 * baseline is deliberately left untouched in that case — lowering it would double-count
 * the remaining items the next time the container is re-read. The baseline only resets
 * to 0 once the type is confirmed fully removed (absent from the new reading), which is
 * how MTU/container withdrawals actually work in EVE (a type is cleared out entirely, not
 * partially drained), so any amount that reappears afterward is genuinely new loot.
 */
export function mergeLootSnapshotPeak(
  oldSnapshot: LootSnapshot,
  newSnapshot: LootSnapshot
): LootSnapshot {
  const merged: LootSnapshot = {}
  const typeIds = new Set(
    [...Object.keys(oldSnapshot), ...Object.keys(newSnapshot)].map(Number)
  )

  for (const typeId of typeIds) {
    const newQty = newSnapshot[typeId]
    if (newQty === undefined || newQty <= 0) {
      // Absent from the container now — confirmed removal, reset the baseline.
      continue
    }
    merged[typeId] = Math.max(oldSnapshot[typeId] || 0, newQty)
  }

  return merged
}

export function enrichDeltaWithTypeNames(
  delta: LootDelta[],
  contents: ContainerContent[]
): LootDelta[] {
  const typeNameById = new Map(contents.map((item) => [item.typeId, item.typeName]))
  return delta.map((item) => ({
    ...item,
    typeName: typeNameById.get(item.typeId) || `Type ${item.typeId}`,
  }))
}

export interface LootSyncError {
  message: string
  timestamp: string
}

const MAX_STORED_LOOT_SYNC_ERRORS = 5

/** Best-effort — never throws, so a failure here can't mask the original sync error. */
async function recordLootSyncError(activityId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const fresh = await prisma.activity.findUnique({ where: { id: activityId } })
    if (!fresh) return

    const freshData = (fresh.data as Record<string, unknown>) || {}
    const existingErrors = Array.isArray(freshData.lootSyncErrors)
      ? (freshData.lootSyncErrors as LootSyncError[])
      : []
    const nextErrors: LootSyncError[] = [
      { message, timestamp: new Date().toISOString() },
      ...existingErrors,
    ].slice(0, MAX_STORED_LOOT_SYNC_ERRORS)

    await prisma.activity.update({
      where: { id: activityId },
      data: { data: { ...freshData, lootSyncErrors: nextErrors } as unknown as Prisma.InputJsonValue },
    })
  } catch (persistError) {
    logger.error(component, `Activity ${activityId}: Failed to persist loot sync error`, persistError)
  }
}

export async function fetchContainerContents(
  characterId: number,
  containerId: number
): Promise<ContainerContent[]> {
  // Must throw on ESI failure rather than fall back to `[]` — an empty read would
  // be indistinguishable from "container is actually empty" and would wipe the
  // stored loot baseline (see mergeLootSnapshotPeak), causing every item still in
  // the container to be double-counted as new loot on the next successful sync.
  const assets = await getCharacterAssets(characterId, { throwOnError: true })

  const containerContents = (assets as Array<{ location_id: number; item_id: number; type_id: number; quantity?: number }>).filter(
    (asset) => asset.location_id === containerId
  )

  if (containerContents.length === 0) {
    return []
  }

  const itemIds = containerContents.map((c) => c.item_id)
  const customNames = await getCharacterAssetNames(characterId, itemIds.slice(0, 500))
  const nameMap = new Map(customNames.map((n) => [n.item_id, n.name]))

  return Promise.all(
    containerContents.map(async (asset) => {
      const typeName = nameMap.get(asset.item_id) || (await getTypeName(asset.type_id))
      return {
        typeId: asset.type_id,
        typeName,
        quantity: asset.quantity || 1,
      }
    })
  )
}

function getLootProfile(activityType: string): ContainerLootProfile | null {
  return LOOT_PROFILES[activityType] ?? null
}

export async function initializeLootSnapshot(activity: Activity): Promise<Activity> {
  const activityData = (activity.data as Record<string, unknown>) || {}

  if (!activityData.autoLootTrackingEnabled) {
    return activity
  }

  if (activityData.lootSnapshot !== undefined && activityData.lootSnapshot !== null) {
    return activity
  }

  const autoLootCharacterId = activityData.autoLootCharacterId as number | undefined
  const autoLootContainerId = activityData.autoLootContainerId as number | undefined

  if (!autoLootCharacterId || !autoLootContainerId) {
    return activity
  }

  logger.info(component, `Initializing loot snapshot for Activity ID: ${activity.id} (${activity.type})`)

  const contents = await fetchContainerContents(autoLootCharacterId, autoLootContainerId)
  const snapshot = buildLootSnapshotFromContents(contents)

  return prisma.activity.update({
    where: { id: activity.id },
    data: {
      data: {
        ...activityData,
        lootSnapshot: snapshot,
        lastLootSyncAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function syncContainerLootForActivity(activity: Activity): Promise<Activity> {
  const profile = getLootProfile(activity.type)
  if (!profile) {
    throw new Error(`Loot sync not supported for ${activity.type} activities`)
  }

  const activityId = activity.id
  const activityData = (activity.data as Record<string, unknown>) || {}

  if (!activityData.autoLootTrackingEnabled) {
    logger.debug(component, `Activity ${activityId}: Auto loot tracking disabled, skipping`)
    return activity
  }

  const autoLootCharacterId = activityData.autoLootCharacterId as number | undefined
  const autoLootContainerId = activityData.autoLootContainerId as number | undefined

  if (!autoLootCharacterId || !autoLootContainerId) {
    logger.debug(component, `Activity ${activityId}: Missing character or container ID`)
    return activity
  }

  logger.info(component, `START LOOT SYNC for Activity ID: ${activityId} (${activity.type})`)
  logger.info(component, `Container: ${autoLootContainerId} | Character: ${autoLootCharacterId}`)

  try {
    const currentContents = await fetchContainerContents(autoLootCharacterId, autoLootContainerId)
    const currentSnapshot = buildLootSnapshotFromContents(currentContents)
    const storedSnapshot = (activityData.lootSnapshot || {}) as LootSnapshot
    const rawDelta = calculateDelta(storedSnapshot, currentSnapshot)
    const nextSnapshot = mergeLootSnapshotPeak(storedSnapshot, currentSnapshot)

    const progressAt = new Date().toISOString()
    const expectedUpdatedAt = activity.updatedAt

    if (rawDelta.length === 0) {
      logger.info(component, `Activity ${activityId}: No new loot detected`)
      const updated = await prisma.$transaction(async (tx) => {
        const fresh = await tx.activity.findFirst({
          where: { id: activityId, updatedAt: expectedUpdatedAt },
        })
        if (!fresh) return tx.activity.findUnique({ where: { id: activityId } })

        const freshData = (fresh.data as Record<string, unknown>) || {}
        const nextData = {
          ...freshData,
          lootSnapshot: nextSnapshot,
          lastLootSyncAt: progressAt,
          lootSyncErrors: undefined,
        }

        const result = await tx.activity.updateMany({
          where: { id: activityId, updatedAt: expectedUpdatedAt },
          data: { data: nextData as unknown as Prisma.InputJsonValue },
        })
        if (result.count === 0) return null
        return tx.activity.findUnique({ where: { id: activityId } })
      })

      return updated ?? activity
    }

    const delta = enrichDeltaWithTypeNames(rawDelta, currentContents)
    logger.info(component, `Activity ${activityId}: Found ${delta.length} new item types`)

    const itemNames = delta.map((d) => d.typeName)
    const prices = await getMarketAppraisalDetailed(itemNames)

    let totalValue = 0
    const valuedItems: ValuedLootItem[] = delta.map((item) => {
      const priceData = prices[item.typeName.toLowerCase()] || prices[item.typeName] || { unitPrice: 0 }
      const unitPrice = priceData.unitPrice || 0
      const itemValue = unitPrice * item.quantity
      totalValue += itemValue
      return {
        ...item,
        unitPrice,
        totalValue: itemValue,
        source: priceData.source || 'not_found',
      }
    })

    const newLogEntry = profile.buildLogEntry({
      totalValue,
      charId: autoLootCharacterId,
      items: valuedItems,
      activity,
      activityData,
    })

    const updated = await prisma.$transaction(async (tx) => {
      const fresh = await tx.activity.findFirst({
        where: { id: activityId, updatedAt: expectedUpdatedAt },
      })
      if (!fresh) return null

      const freshData = (fresh.data as Record<string, unknown>) || {}
      const existingLogs = (freshData.logs as RattingLogLike[]) || []
      const mergedLogs =
        activity.type === 'ratting'
          ? mergeRattingLogs(existingLogs, [newLogEntry as RattingLogLike])
          : [newLogEntry, ...existingLogs]

      const previousValue = Number(freshData[profile.valueField]) || 0
      const nextData: Record<string, unknown> = {
        ...freshData,
        lootSnapshot: nextSnapshot,
        logs: mergedLogs,
        [profile.valueField]: previousValue + totalValue,
        lastLootSyncAt: progressAt,
        lastDataAt: progressAt,
        lootSyncErrors: undefined,
      }

      if (profile.valueField === 'totalLootValue') {
        nextData.currentCargoValue = (Number(freshData.currentCargoValue) || 0) + totalValue
      }

      const result = await tx.activity.updateMany({
        where: { id: activityId, updatedAt: expectedUpdatedAt },
        data: { data: nextData as unknown as Prisma.InputJsonValue },
      })
      if (result.count === 0) return null
      return tx.activity.findUnique({ where: { id: activityId } })
    })

    logger.info(component, `Activity ${activityId}: Adding ${totalValue.toLocaleString()} ISK to loot history`)
    logger.info(component, `END LOOT SYNC: ${delta.length} new items | ${totalValue.toLocaleString()} ISK`)

    if (!updated) {
      const latest = await prisma.activity.findUnique({ where: { id: activityId } })
      return latest ?? activity
    }

    return updated
  } catch (error) {
    logger.error(component, `Activity ${activityId}: Loot sync failed`, error)
    await recordLootSyncError(activityId, error)
    throw error
  }
}

export async function syncLootForActivity(activity: Activity): Promise<Activity> {
  if (!getLootProfile(activity.type)) {
    throw new Error(`Loot sync not supported for ${activity.type} activities`)
  }
  return syncContainerLootForActivity(activity)
}

// Backwards-compatible aliases used by ratting code paths
export const initializeRattingLootSnapshot = initializeLootSnapshot
export const syncRattingLootForActivity = syncContainerLootForActivity
