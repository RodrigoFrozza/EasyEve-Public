import { z } from 'zod'

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type MedalType = 'instant' | 'daily' | 'weekly' | 'monthly'
export type MedalCriteriaType = 'first_activity' | 'hours' | 'count' | 'ranking' | 'custom'

export const TIER_COLORS: Record<MedalTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export const CRITERIA_TYPE_OPTIONS = [
  { value: 'first_activity', label: 'First Activity (One-time)', activityRequired: false },
  { value: 'hours', label: 'Total Hours Spent', activityRequired: false },
  { value: 'count', label: 'Activity Count', activityRequired: true },
  { value: 'ranking', label: 'Leaderboard Ranking', activityRequired: true },
  { value: 'custom', label: 'Custom Criteria (JSON)', activityRequired: false },
] as const

export const ACTIVITY_OPTIONS = [
  { value: 'mining', label: 'Mining' },
  { value: 'ratting', label: 'Ratting (PVE)' },
  { value: 'exploration', label: 'Exploration' },
] as const

export const TIER_OPTIONS = [
  { value: 'bronze', label: 'Bronze', color: TIER_COLORS.bronze },
  { value: 'silver', label: 'Silver', color: TIER_COLORS.silver },
  { value: 'gold', label: 'Gold', color: TIER_COLORS.gold },
  { value: 'platinum', label: 'Platinum', color: TIER_COLORS.platinum },
] as const

export const TYPE_OPTIONS = [
  { value: 'instant', label: 'Instant (One-time)', stackable: false },
  { value: 'daily', label: 'Daily (Resets daily)', stackable: true },
  { value: 'weekly', label: 'Weekly (Resets weekly)', stackable: true },
  { value: 'monthly', label: 'Monthly (Resets monthly)', stackable: true },
] as const

export const MedalCriteriaSchema = z.object({
  type: z.enum(['first_activity', 'hours', 'count', 'ranking', 'custom']),
  value: z.number().min(1),
  activity: z.enum(['mining', 'ratting', 'exploration']).optional(),
})

export const CreateMedalSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(10).optional(),
  tier: z.enum(['bronze', 'silver', 'gold', 'platinum']),
  type: z.enum(['instant', 'daily', 'weekly', 'monthly']),
  criteria: z.union([MedalCriteriaSchema, z.record(z.string(), z.unknown())]),
  isActive: z.boolean().default(true),
})

export const UpdateMedalSchema = CreateMedalSchema.partial()

export interface Medal {
  id: string
  name: string
  description: string | null
  icon: string | null
  criteria: string // JSON string
  tier: MedalTier
  type: MedalType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  awardCount?: number // number of times awarded (computed)
}

export interface MedalWithStats extends Medal {
  awardCount: number
  uniqueRecipients: number
}

export interface Criteria {
  type: MedalCriteriaType
  value: number
  activity?: 'mining' | 'ratting' | 'exploration'
  [key: string]: unknown
}

export function parseCriteria(criteriaStr: string): Criteria {
  try {
    return JSON.parse(criteriaStr) as Criteria
  } catch {
    return { type: 'custom', value: 0 }
  }
}

export function buildCriteria(params: {
  type: MedalCriteriaType
  value: number
  activity?: 'mining' | 'ratting' | 'exploration'
  customJson?: string
}): string {
  if (params.type === 'custom' && params.customJson) {
    return params.customJson
  }

  const criteria: Criteria = {
    type: params.type,
    value: params.value,
  }

  if (params.activity && ['mining', 'ratting', 'exploration'].includes(params.activity)) {
    criteria.activity = params.activity
  }

  return JSON.stringify(criteria)
}

export function isStackable(type: MedalType): boolean {
  return type !== 'instant'
}