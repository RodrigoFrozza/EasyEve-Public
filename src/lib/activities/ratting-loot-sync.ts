import type { Activity } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCharacterAssets, getCharacterAssetNames, getTypeName } from '@/lib/esi'
import { getMarketAppraisalDetailed } from '@/lib/market'
import { logger } from '@/lib/server-logger'

const component = 'Activity:LootSync'

interface ContainerContent {
  typeId: number
  typeName: string
  quantity: number
}

interface LootSnapshot {
  [typeId: number]: number
}

interface LootDelta {
  typeId: number
  typeName: string
  quantity: number
  unitPrice: number
  totalValue: number
}

export async function syncRattingLootForActivity(activity: Activity): Promise<Activity> {
  const activityId = activity.id

  if (activity.type !== 'ratting') {
    throw new Error('Loot sync only supported for ratting activities')
  }

  const activityData = (activity.data as any) || {}
  const autoLootTrackingEnabled = activityData.autoLootTrackingEnabled

  if (!autoLootTrackingEnabled) {
    logger.debug(component, `Activity ${activityId}: Auto loot tracking disabled, skipping`)
    return activity
  }

  const autoLootCharacterId = activityData.autoLootCharacterId
  const autoLootContainerId = activityData.autoLootContainerId

  if (!autoLootCharacterId || !autoLootContainerId) {
    logger.debug(component, `Activity ${activityId}: Missing character or container ID`)
    return activity
  }

  logger.info(component, `START LOOT SYNC for Activity ID: ${activityId}`)
  logger.info(component, `Container: ${autoLootContainerId} | Character: ${autoLootCharacterId}`)

  try {
    const assets = await getCharacterAssets(autoLootCharacterId)

    const containerContents = (assets as any[]).filter(
      (asset) => asset.location_id === autoLootContainerId
    )

    if (containerContents.length === 0) {
      logger.info(component, `Activity ${activityId}: No items in container`)
      return activity
    }

    const itemIds = containerContents.map((c) => c.item_id)
    const customNames = await getCharacterAssetNames(autoLootCharacterId, itemIds.slice(0, 500))
    const nameMap = new Map(customNames.map((n) => [n.item_id, n.name]))

    const currentContents: ContainerContent[] = await Promise.all(
      containerContents.map(async (asset) => {
        const typeName = nameMap.get(asset.item_id) || (await getTypeName(asset.type_id))
        return {
          typeId: asset.type_id,
          typeName,
          quantity: asset.quantity || 1,
        }
      })
    )

    const currentSnapshot: LootSnapshot = {}
    currentContents.forEach((item) => {
      currentSnapshot[item.typeId] = item.quantity
    })

    const storedSnapshot = (activityData.lootSnapshot || {}) as LootSnapshot
    const delta = calculateDelta(storedSnapshot, currentSnapshot)

    if (delta.length === 0) {
      logger.info(component, `Activity ${activityId}: No new loot detected`)
      return activity
    }

    logger.info(component, `Activity ${activityId}: Found ${delta.length} new item types`)

    const itemNames = delta.map((d) => d.typeName)
    const prices = await getMarketAppraisalDetailed(itemNames)

    let totalValue = 0
    const valuedItems = delta.map((item) => {
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

    const existingLogs = activityData.logs || []
    const newLogEntry = {
      refId: `loot-auto-${Date.now()}`,
      date: new Date().toISOString(),
      amount: totalValue,
      type: 'loot-auto' as const,
      charName: 'Auto Loot',
      charId: autoLootCharacterId,
      items: valuedItems,
    }

    const updatedLogs = [newLogEntry, ...existingLogs]

    const updatedData = {
      ...activityData,
      lootSnapshot: currentSnapshot,
      logs: updatedLogs,
      estimatedLootValue: (activityData.estimatedLootValue || 0) + totalValue,
      lastLootSyncAt: new Date().toISOString(),
    }

    logger.info(component, `Activity ${activityId}: Adding ${totalValue.toLocaleString()} ISK to loot history`)
    logger.info(component, `END LOOT SYNC: ${delta.length} new items | ${totalValue.toLocaleString()} ISK`)

    return prisma.activity.update({
      where: { id: activityId },
      data: { data: updatedData },
    })
  } catch (error) {
    logger.error(component, `Activity ${activityId}: Loot sync failed`, error)
    throw error
  }
}

function calculateDelta(oldSnapshot: LootSnapshot, newSnapshot: LootSnapshot): LootDelta[] {
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

export async function fetchContainerContents(
  characterId: number,
  containerId: number
): Promise<ContainerContent[]> {
  const assets = await getCharacterAssets(characterId)

  const containerContents = (assets as any[]).filter(
    (asset) => asset.location_id === containerId
  )

  if (containerContents.length === 0) {
    return []
  }

  const itemIds = containerContents.map((c) => c.item_id)
  const customNames = await getCharacterAssetNames(characterId, itemIds.slice(0, 500))
  const nameMap = new Map(customNames.map((n) => [n.item_id, n.name]))

  const contents: ContainerContent[] = await Promise.all(
    containerContents.map(async (asset) => {
      const typeName = nameMap.get(asset.item_id) || (await getTypeName(asset.type_id))
      return {
        typeId: asset.type_id,
        typeName,
        quantity: asset.quantity || 1,
      }
    })
  )

  return contents
}