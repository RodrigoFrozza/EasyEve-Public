import { Activity as PrismaActivity } from '@prisma/client'
import type { RattingLogEntry, RattingLootItem } from '@/lib/activities/ratting-manual-entries'

/**
 * Activity Data Structures
 */

export interface MiningLogEntry {
  date: string
  charId?: number
  characterId?: number
  charName?: string
  characterName?: string
  oreName: string
  typeId: number
  quantity: number
  value?: number
  estimatedValue?: number
  m3?: number
  volumeValue?: number
  solarSystemId?: number
  regionId?: number
  regionName?: string
  constellationId?: number
  constellationName?: string
  security?: number
  securityBand?: string
  /** Resolved Jita unit price (ISK per raw unit) after fallback chain */
  unitPrice?: number
  priceBasis?: 'jita_buy_raw' | 'jita_buy_compressed' | 'jita_sell_raw' | 'jita_sell_compressed' | 'none'
  priceConfidence?: 'high' | 'fallback' | 'none'
}

export interface MiningOreBreakdownEntry {
  typeId?: number
  name?: string
  icon?: string
  quantity: number
  volumeValue: number
  estimatedValue: number
  buy?: number
  sell?: number
  compressedBuy?: number
  compressedSell?: number
  priceBasis?: MiningLogEntry['priceBasis']
  priceConfidence?: MiningLogEntry['priceConfidence']
}

export interface MiningParticipantBreakdownEntry {
  characterId: number
  characterName?: string
  quantity: number
  volumeValue: number
  estimatedValue: number
}

export interface MiningSystemBreakdownEntry {
  solarSystemId: number
  name: string
  regionId: number
  regionName: string
  constellationId?: number
  constellationName?: string
  isk: number
  m3: number
  quantity: number
}

export interface MiningRegionBreakdownEntry {
  regionId: number
  regionName: string
  isk: number
  m3: number
  quantity: number
  systemCount: number
}

export type { RattingLogEntry, RattingLootItem } from '@/lib/activities/ratting-manual-entries'

export interface MTUSummary {
  id: string
  name: string
  value: number
  items: Array<{ typeId: number; name: string; count: number; value: number }>
}

export interface ActivityParticipant {
  characterId: number
  characterName: string
  fitName?: string
  fit?: string
}

export interface MiningActivityData {
  siteName?: string
  /** Selected mining category at activity creation */
  miningType?: 'Ore' | 'Ice' | 'Gas' | 'Moon'
  totalQuantity: number
  totalEstimatedValue: number
  logs: MiningLogEntry[]
  oreBreakdown?: Record<string, MiningOreBreakdownEntry>
  participantBreakdown?: Record<string, MiningParticipantBreakdownEntry>
  baselines?: Record<string, number>
  hasInitialBaseline?: boolean
  systemBreakdown?: Record<string, MiningSystemBreakdownEntry>
  regionBreakdown?: Record<string, MiningRegionBreakdownEntry>
  dominantSystemId?: number | null
  dominantRegionId?: number | null
  miningValue?: number
  currentM3PerHour?: number
  m3Trend?: string
  lastSyncAt?: string
  lastDataAt?: string
  participantEarnings?: Record<number, number>
  isAutoTracked?: boolean
  autoTrackingStartedAt?: string
  detectedCharacters?: number
  iskTrend?: string
  [key: string]: unknown
}

export interface RattingActivityData {
  siteName?: string
  siteType?: string
  npcFaction?: string
  automatedBounties: number
  automatedEss: number
  automatedTaxes: number
  additionalBounties: number
  estimatedLootValue: number
  estimatedSalvageValue: number
  grossBounties?: number
  participantEarnings?: Record<number, number>
  lastSyncAt?: string
  lastDataAt?: string
  lastSyncWithChangesAt?: string
  lastSyncChangeCount?: number
  syncCount?: number
  lastEssPaymentAt?: string
  autoLootTrackingEnabled?: boolean
  autoLootCharacterId?: number
  autoLootContainerId?: number
  autoLootContainerName?: string
  autoLootContainerStatus?: 'idle' | 'valid' | 'invalid'
  lootSnapshot?: Record<number, number>
  lastLootSyncAt?: string
  syncErrors?: Array<{ characterId: number; characterName: string; error: string }>
  mtuContents?: RattingLootItem[][]
  salvageContents?: RattingLootItem[][]
  logs: RattingLogEntry[]
  /** @deprecated Use mtuContents + loot history modal */
  mtuSummaries?: MTUSummary[]
  [key: string]: unknown
}

export interface ExplorationLootItem {
  name: string
  quantity: number
  value: number
  typeId?: number
}

export interface ExplorationActivityData {
  siteName?: string
  sitesCompleted?: number
  totalLootValue: number
  lootContents: ExplorationLootItem[]
  autoLootTrackingEnabled?: boolean
  autoLootCharacterId?: number
  autoLootStructureId?: number
  autoLootStructureName?: string
  autoLootContainerId?: number
  autoLootContainerName?: string
  lootSnapshot?: Record<number, number>
  lastLootSyncAt?: string
  logs: Array<{
    refId: string
    date: string
    amount: number
    type: string
    charName: string
    charId: number
  }>
  [key: string]: any
}

export type ExplorationLogEntry = ExplorationActivityData['logs'][number]

export interface SalvagingLootItem {
  name: string
  quantity: number
  value: number
  typeId?: number
}

export interface SalvagingActivityData {
  npcFaction?: string
  /** @deprecated Use npcFaction; kept for older sessions */
  region?: string
  lastCargoState?: string
  totalLootValue: number
  autoLootTrackingEnabled?: boolean
  autoLootCharacterId?: number
  autoLootStructureId?: number
  autoLootStructureName?: string
  autoLootContainerId?: number
  autoLootContainerName?: string
  lootSnapshot?: Record<number, number>
  lastLootSyncAt?: string
  lootContents?: SalvagingLootItem[]
  logs: Array<{
    type: 'salvage' | string
    label?: string
    spaceType?: string
    value: number
    items?: Array<{ name: string; quantity: number; price?: number; total?: number; typeId?: number }>
    date: string
    refId?: string
    amount?: number
    charName?: string
    charId?: number
  }>
  [key: string]: any
}

export type SalvagingLogEntry = SalvagingActivityData['logs'][number]

export interface AbyssalActivityData {
  totalLootValue?: number
  lootValue?: number
  lastDataAt?: string
  /** Session-level tier hint (may mirror last run defaults) */
  tier?: string
  /** Aggregated cargo grid for the session detail view */
  lootContents?: Array<{ typeId?: number; name: string; quantity: number; value?: number }>
  trackingMode?: 'automatic' | 'manual'
  lastCargoState?: string
  lastRunDefaults?: {
    tier?: string
    weather?: string
    ship?: string
  }
  runs?: Array<{
    id: string
    startTime: string
    endTime?: string
    status: 'active' | 'completed' | 'death' | 'success'
    registrationStatus?: 'pending' | 'registered' | 'not_registered'
    tier?: string
    weather?: string
    ship?: string
    lootValue?: number
    note?: string
    autoFallback?: boolean
    editable?: boolean
    beforeCargoState?: string
    afterCargoState?: string
    lootItems?: Array<{ name: string; quantity: number; value?: number; typeId?: number; id?: number }>
    consumedItems?: Array<{ name: string; quantity: number; value?: number; typeId?: number; id?: number }>
  }>
  logs: Array<{
    refId: string
    date: string
    amount: number
    type: string
    charName: string
    charId?: number
    items?: Array<{ name: string; quantity: number; value?: number }>
    consumed?: Array<{ name: string; quantity: number; value?: number }>
    runId?: string
  }>
  [key: string]: any
}

export type AbyssalLogEntry = AbyssalActivityData['logs'][number]

export type {
  EscalationEntry,
  EscalationsActivityData,
  EscalationsLogEntry,
} from '@/lib/activities/escalations-entries'

import type { EscalationsActivityData } from '@/lib/activities/escalations-entries'

export type ActivityData =
  | MiningActivityData
  | RattingActivityData
  | ExplorationActivityData
  | SalvagingActivityData
  | AbyssalActivityData
  | EscalationsActivityData

/**
 * Unified Activity Type
 */
export interface ActivityEnhanced extends Omit<PrismaActivity, 'data' | 'participants'> {
  data: ActivityData
  participants: ActivityParticipant[]
}

/**
 * Type Guards
 */
export function isMiningActivity(activity: ActivityEnhanced): activity is ActivityEnhanced & { data: MiningActivityData } {
  return activity.type === 'mining'
}

export function isRattingActivity(activity: ActivityEnhanced): activity is ActivityEnhanced & { data: RattingActivityData } {
  return activity.type === 'ratting'
}

export function isExplorationActivity(activity: ActivityEnhanced): activity is ActivityEnhanced & { data: ExplorationActivityData } {
  return activity.type === 'exploration'
}

export function isAbyssalActivity(activity: ActivityEnhanced): activity is ActivityEnhanced & { data: AbyssalActivityData } {
  return activity.type === 'abyssal'
}

export function isSalvagingActivity(
  activity: ActivityEnhanced
): activity is ActivityEnhanced & { data: SalvagingActivityData } {
  return activity.type === 'salvaging'
}

export function isEscalationsActivity(
  activity: ActivityEnhanced
): activity is ActivityEnhanced & { data: EscalationsActivityData } {
  return activity.type === 'escalations'
}
