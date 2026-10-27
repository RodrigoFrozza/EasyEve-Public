import {
  ActivityEnhanced,
  type ActivityData,
  isAbyssalActivity,
  isExplorationActivity,
  isMiningActivity,
  isRattingActivity,
  isSalvagingActivity,
  isEscalationsActivity,
} from '@/types/domain'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { getAbyssalSessionMetrics } from '@/lib/activities/abyssal-metrics'

export type SessionKpiIconId =
  | 'dollar'
  | 'trending'
  | 'box'
  | 'target'
  | 'mapPin'
  | 'sparkles'
  | 'crosshair'
  | 'gem'
  | 'gauge'
  | 'wallet'
  | 'clock'

export type SessionKpiVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent'

export interface SessionKpi {
  id: string
  labelKey: string
  value: number | string
  iconId: SessionKpiIconId
  variant: SessionKpiVariant
  formatAsISK?: boolean
  formatAsNumber?: boolean
  formatAsCompactISK?: boolean
  subValue?: string
}

type ExplorationLog = { type?: string; amount?: number; value?: number }

export function getExplorationDiscoveryCount(logs: ExplorationLog[] = []): number {
  return logs.filter((l) => l.type === 'site' || l.type === 'loot').length
}

export function getExplorationSiteCount(logs: ExplorationLog[] = []): number {
  return logs.filter((l) => l.type === 'site').length
}

type SalvagingLog = {
  type?: string
  value?: number
  items?: Array<{ quantity?: number }>
}

function isSalvagingLootLog(log: SalvagingLog): boolean {
  return log.type === 'salvage' || log.type === 'loot-auto'
}

export function getSalvagingBatchCount(
  logs: SalvagingLog[] = [],
  data?: { totalLootValue?: number; batchesCompleted?: number }
): number {
  const fromLogs = logs.filter((l) => isSalvagingLootLog(l)).length
  if (fromLogs > 0) return fromLogs
  const stored = Number(data?.batchesCompleted)
  if (Number.isFinite(stored) && stored > 0) return stored
  return Number(data?.totalLootValue) > 0 ? 1 : 0
}

export function getSalvagingItemCount(
  logs: SalvagingLog[] = [],
  data?: { totalItems?: number }
): number {
  const fromLogs = logs
    .filter((l) => isSalvagingLootLog(l))
    .reduce((sum, log) => {
      const items = log.items || []
      return sum + items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
    }, 0)
  if (fromLogs > 0) return fromLogs
  const stored = Number(data?.totalItems)
  if (Number.isFinite(stored) && stored > 0) return stored
  return 0
}

/** Elapsed session hours (respects pause when session is completed). */
export function getSessionHours(activity: ActivityEnhanced): number {
  const durationMs = getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    updatedAt: activity.updatedAt,
    accumulatedPausedTime: activity.accumulatedPausedTime,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })

  return Math.max(0.01, durationMs / (1000 * 60 * 60))
}

/** Human-readable session duration (matches ActivityHistoryItem pause logic). */
export function formatSessionDuration(activity: ActivityEnhanced): string {
  const durationMs = getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    updatedAt: activity.updatedAt,
    accumulatedPausedTime: activity.accumulatedPausedTime,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })

  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function getSessionKpis(activity: ActivityEnhanced): SessionKpi[] {
  const metrics = getActivityFinancialMetrics(activity)
  const hours = getSessionHours(activity)
  const data = activity.data || {}

  if (isRattingActivity(activity)) {
    const totalBounty =
      (data.automatedBounties || 0) + (data.additionalBounties || 0)
    const totalLoot =
      (data.estimatedLootValue || 0) + (data.estimatedSalvageValue || 0)
    const iskPerHour = metrics.net / hours

    return [
      {
        id: 'bounty',
        labelKey: 'activity.ratting.bounty',
        value: totalBounty,
        iconId: 'target',
        variant: 'danger',
        formatAsISK: true,
      },
      {
        id: 'ess',
        labelKey: 'activity.ratting.ess',
        value: data.automatedEss || 0,
        iconId: 'dollar',
        variant: 'warning',
        formatAsISK: true,
      },
      {
        id: 'loot',
        labelKey: 'activity.ratting.loot',
        value: totalLoot,
        iconId: 'box',
        variant: 'accent',
        formatAsISK: true,
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.ratting.efficiency',
        value: iskPerHour,
        iconId: 'trending',
        variant: 'accent',
        formatAsISK: true,
        subValue: iskPerHour === 0 ? undefined : 'isk/h',
      },
    ]
  }

  if (isEscalationsActivity(activity)) {
    const totalBounty =
      (data.automatedBounties || 0) + (data.additionalBounties || 0)
    const escLoot = data.estimatedEscalationLootValue || 0
    const iskPerHour = metrics.net / hours

    return [
      {
        id: 'bounty',
        labelKey: 'activity.escalations.bounty',
        value: totalBounty,
        iconId: 'target',
        variant: 'warning',
        formatAsISK: true,
      },
      {
        id: 'ess',
        labelKey: 'activity.escalations.ess',
        value: data.automatedEss || 0,
        iconId: 'dollar',
        variant: 'warning',
        formatAsISK: true,
      },
      {
        id: 'loot',
        labelKey: 'activity.escalations.loot',
        value: escLoot,
        iconId: 'box',
        variant: 'accent',
        formatAsISK: true,
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.escalations.efficiency',
        value: iskPerHour,
        iconId: 'trending',
        variant: 'accent',
        formatAsISK: true,
        subValue: iskPerHour === 0 ? undefined : 'isk/h',
      },
    ]
  }

  if (isMiningActivity(activity)) {
    const totalQuantity = data.totalQuantity || 0
    const miningValue = metrics.miningValue

    return [
      {
        id: 'yield',
        labelKey: 'activity.mining.yield',
        value: Math.round(totalQuantity),
        iconId: 'gem',
        variant: 'accent',
        formatAsNumber: true,
        subValue: 'm³',
      },
      {
        id: 'yieldPerHour',
        labelKey: 'activity.mining.yieldPerHour',
        value: Math.round(totalQuantity / hours),
        iconId: 'box',
        variant: 'default',
        formatAsNumber: true,
        subValue: 'm³/h',
      },
      {
        id: 'loot',
        labelKey: 'activity.mining.loot',
        value: miningValue,
        iconId: 'trending',
        variant: 'success',
        formatAsISK: true,
        subValue: 'isk',
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.mining.efficiency',
        value: metrics.net / hours,
        iconId: 'clock',
        variant: 'accent',
        formatAsISK: true,
        subValue: 'isk/h',
      },
    ]
  }

  if (isExplorationActivity(activity)) {
    const logs = (data.logs || []) as ExplorationLog[]
    const discoveryCount = getExplorationDiscoveryCount(logs)
    const siteCount = getExplorationSiteCount(logs)
    const totalLoot = metrics.totalLootValue
    const iskPerHour = metrics.net / hours

    return [
      {
        id: 'sites',
        labelKey: 'activity.exploration.sitesCompleted',
        value: siteCount,
        iconId: 'mapPin',
        variant: 'accent',
        formatAsNumber: true,
      },
      {
        id: 'itemsFound',
        labelKey: 'activity.exploration.itemsFound',
        value: discoveryCount,
        iconId: 'box',
        variant: 'default',
        formatAsNumber: true,
      },
      {
        id: 'lootValue',
        labelKey: 'activity.exploration.lootValue',
        value: totalLoot,
        iconId: 'trending',
        variant: 'success',
        formatAsCompactISK: true,
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.exploration.efficiency',
        value: iskPerHour,
        iconId: 'clock',
        variant: 'accent',
        formatAsCompactISK: true,
        subValue: iskPerHour === 0 ? undefined : 'isk/h',
      },
    ]
  }

  if (isSalvagingActivity(activity)) {
    const logs = (data.logs || []) as SalvagingLog[]
    const batchCount = getSalvagingBatchCount(
      logs,
      data as { totalLootValue?: number; batchesCompleted?: number }
    )
    const itemCount = getSalvagingItemCount(logs, data as { totalItems?: number })
    const totalLoot = metrics.totalLootValue
    const iskPerHour = metrics.net / hours

    return [
      {
        id: 'batches',
        labelKey: 'activity.salvaging.batchesCompleted',
        value: batchCount,
        iconId: 'mapPin',
        variant: 'accent',
        formatAsNumber: true,
      },
      {
        id: 'itemsFound',
        labelKey: 'activity.salvaging.itemsSalvaged',
        value: itemCount,
        iconId: 'box',
        variant: 'default',
        formatAsNumber: true,
      },
      {
        id: 'lootValue',
        labelKey: 'activity.salvaging.lootValue',
        value: totalLoot,
        iconId: 'trending',
        variant: 'success',
        formatAsCompactISK: true,
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.salvaging.efficiency',
        value: iskPerHour,
        iconId: 'clock',
        variant: 'accent',
        formatAsCompactISK: true,
        subValue: iskPerHour === 0 ? undefined : 'isk/h',
      },
    ]
  }

  if (isAbyssalActivity(activity)) {
    const runs = (data.runs || []) as Array<{
      status?: string
      lootValue?: number
      startTime?: string
      endTime?: string
      registrationStatus?: string
    }>
    const abyssalMetrics = getAbyssalSessionMetrics(runs, hours)
    const deaths = runs.filter((r) => r.status === 'death').length
    const totalFilaments = abyssalMetrics.totalFilaments
    const totalIsk = abyssalMetrics.totalIsk
    const bestRun = abyssalMetrics.bestRunValue
    const iskPerHour = abyssalMetrics.iskPerHour

    return [
      {
        id: 'filaments',
        labelKey: 'activity.abyssal.filament',
        value: totalFilaments,
        iconId: 'gauge',
        variant: 'accent',
        formatAsNumber: true,
        subValue: deaths > 0 ? `${deaths} 💀` : undefined,
      },
      {
        id: 'totalIsk',
        labelKey: 'activity.abyssal.totalIsk',
        value: totalIsk,
        iconId: 'wallet',
        variant: 'success',
        formatAsISK: true,
        subValue: totalIsk === 0 ? undefined : 'isk',
      },
      {
        id: 'bestRun',
        labelKey: 'activity.abyssal.bestRun',
        value: bestRun,
        iconId: 'crosshair',
        variant: 'warning',
        formatAsISK: true,
        subValue: bestRun === 0 ? undefined : 'isk',
      },
      {
        id: 'iskPerHour',
        labelKey: 'activity.abyssal.iskPerHour',
        value: iskPerHour,
        iconId: 'clock',
        variant: 'accent',
        formatAsISK: true,
        subValue: iskPerHour === 0 ? undefined : 'isk/h',
      },
    ]
  }

  return [
    {
      id: 'net',
      labelKey: 'common.session.netIsk',
      value: metrics.net,
      iconId: 'dollar',
      variant: 'success',
      formatAsISK: true,
    },
    {
      id: 'iskPerHour',
      labelKey: 'common.session.iskPerHour',
      value: metrics.net / hours,
      iconId: 'trending',
      variant: 'accent',
      formatAsISK: true,
    },
  ]
}

/** Whether the session has timeline chart data. */
export function sessionHasTimelineLogs(activity: ActivityEnhanced): boolean {
  const logs = (activity.data as { logs?: unknown[] })?.logs
  return Array.isArray(logs) && logs.length > 0
}

/** Whether loot manifest section has displayable items. */
export function sessionHasLootManifest(activity: ActivityEnhanced): boolean {
  const data = (activity.data || {}) as Partial<ActivityData>

  if (isMiningActivity(activity)) {
    const breakdown = data.oreBreakdown || {}
    return Object.keys(breakdown).length > 0
  }

  if (isAbyssalActivity(activity)) {
    const sessionLoot = Array.isArray(data.lootContents) ? data.lootContents : []
    const runs = Array.isArray(data.runs) ? data.runs : []
    const runLoot = runs.some(
      (r: { lootItems?: unknown[]; lootValue?: number }) =>
        (r.lootItems?.length || 0) > 0 || (r.lootValue || 0) > 0
    )
    return sessionLoot.length > 0 || runLoot
  }

  if (isExplorationActivity(activity)) {
    const lootContents = Array.isArray(data.lootContents) ? data.lootContents : []
    return lootContents.length > 0 || getExplorationDiscoveryCount(data.logs) > 0
  }

  if (isSalvagingActivity(activity)) {
    const lootContents = Array.isArray(data.lootContents) ? data.lootContents : []
    return lootContents.length > 0 || getSalvagingBatchCount(data.logs) > 0
  }

  if (isRattingActivity(activity)) {
    const mtu = data.mtuContents || []
    const salvage = data.salvageContents || []
    return mtu.length + salvage.length > 0
  }

  return false
}
