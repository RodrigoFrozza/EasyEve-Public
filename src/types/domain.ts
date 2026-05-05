import { Activity as PrismaActivity } from '@prisma/client'

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

export interface RattingLogEntry {
  date: string
  charId?: number
  characterId?: number
  charName?: string
  characterName?: string
  type: 'bounty' | 'ess' | 'tax' | string
  amount: number
}

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
  [key: string]: any
}

export interface RattingActivityData {
  siteName?: string
  automatedBounties: number
  automatedEss: number
  automatedTaxes: number
  additionalBounties: number
  estimatedLootValue: number
  estimatedSalvageValue: number
  grossBounties?: number
  lastSyncAt?: string
  lastSyncWithChangesAt?: string
  lastSyncChangeCount?: number
  syncCount?: number
  lastEssPaymentAt?: string
  autoLootTrackingEnabled?: boolean
  autoLootCharacterId?: number
  autoLootContainerName?: string
  autoLootContainerStatus?: 'idle' | 'valid' | 'invalid'
  incomeHistory?: number[]
  logs: RattingLogEntry[]
  mtuSummaries?: MTUSummary[]
  [key: string]: any
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

export interface AbyssalActivityData {
  totalLootValue: number
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
    status: 'active' | 'completed' | 'death'
    registrationStatus?: 'pending' | 'registered' | 'not_registered'
    tier?: string
    weather?: string
    ship?: string
    lootValue?: number
    note?: string
    autoFallback?: boolean
    editable?: boolean
    lootItems?: Array<{ name: string; quantity: number; value?: number }>
    consumedItems?: Array<{ name: string; quantity: number; value?: number }>
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

export type ActivityData = MiningActivityData | RattingActivityData | ExplorationActivityData | AbyssalActivityData

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
