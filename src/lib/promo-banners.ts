import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { ACTIVATION_CODE_TYPES } from '@/lib/activation-codes'
import { z } from 'zod'

export const PROMO_BANNER_PLACEMENTS = {
  DASHBOARD_HOME: 'dashboard_home',
} as const

export type PromoBannerPlacement =
  (typeof PROMO_BANNER_PLACEMENTS)[keyof typeof PROMO_BANNER_PLACEMENTS]

export const PROMO_BANNER_SEGMENTS = {
  ALL_USERS: 'ALL_USERS',
  NEW_USERS: 'NEW_USERS',
  NON_PREMIUM_USERS: 'NON_PREMIUM_USERS',
  NEW_NON_PREMIUM_USERS: 'NEW_NON_PREMIUM_USERS',
} as const

export type PromoBannerSegment =
  (typeof PROMO_BANNER_SEGMENTS)[keyof typeof PROMO_BANNER_SEGMENTS]

export const CAMPAIGN_TYPES = {
  BANNER: 'BANNER',
  POPUP: 'POPUP',
  TOAST: 'TOAST',
} as const

export type CampaignType = (typeof CAMPAIGN_TYPES)[keyof typeof CAMPAIGN_TYPES]

export const CAMPAIGN_ACTIONS = {
  CLAIM_CODE: 'CLAIM_CODE',
  REDIRECT: 'REDIRECT',
  EXTERNAL_LINK: 'EXTERNAL_LINK',
} as const

export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[keyof typeof CAMPAIGN_ACTIONS]

export const DEFAULT_PROMO_BANNER_ACCOUNT_AGE_DAYS = 7

const nullableTrimmedStringSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value && value.length > 0 ? value : null)

const nullableDateInputSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value && value.length > 0 ? value : null)

const nullablePositiveIntegerSchema = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return Number(value)
}, z.number().int().positive().max(365).nullable())

export const promoBannerInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().min(1, 'Description is required').max(1200),
  badgeText: nullableTrimmedStringSchema,
  buttonText: z.string().trim().min(1, 'Button text is required').max(80),
  imageUrl: nullableTrimmedStringSchema,
  type: z.nativeEnum(CAMPAIGN_TYPES).default(CAMPAIGN_TYPES.BANNER),
  actionType: z.nativeEnum(CAMPAIGN_ACTIONS).default(CAMPAIGN_ACTIONS.CLAIM_CODE),
  actionConfig: z.record(z.string(), z.any()).optional().nullable().default({}),
  targetingRules: z.record(z.string(), z.any()).optional().nullable().default({}),
  targetSegment: z
    .string()
    .refine(isPromoBannerSegment, 'Invalid promo banner target segment'),
  maxAccountAgeDays: nullablePositiveIntegerSchema,
  priority: z.coerce.number().int().min(0).max(999),
  dismissible: z.boolean(),
  isActive: z.boolean(),
  startsAt: nullableDateInputSchema,
  endsAt: nullableDateInputSchema,
})

export type PromoBannerInput = z.infer<typeof promoBannerInputSchema>

interface PromoBannerRecord {
  id: string
  title: string
  description: string
  badgeText: string | null
  buttonText: string
  imageUrl: string | null
  type: string
  actionType: string
  actionConfig: any
  targetingRules: any
  placement: string
  targetSegment: string
  maxAccountAgeDays: number | null
  priority: number
  dismissible: boolean
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

interface ActivationCodeRecord {
  id: string
  code: string
  type: string
  createdBy: string | null
  isUsed: boolean
  usedAt: Date | null
  usedById: string | null
  createdAt: Date
}

interface PromoBannerInteractionRecord {
  id: string
  bannerId: string
  userId: string
  activationCodeId: string | null
  claimedAt: Date | null
  dismissedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface PromoBannerUser {
  id: string
  createdAt: Date
  subscriptionEnd: Date | null
}

type PromoBannerWithInteraction = PromoBannerRecord & {
  interactions: Array<
    PromoBannerInteractionRecord & {
      activationCode: ActivationCodeRecord | null
    }
  >
}

export interface PromoBannerWriteData {
  title: string
  description: string
  badgeText: string | null
  buttonText: string
  imageUrl: string | null
  type: string
  actionType: string
  actionConfig: any
  targetingRules: any
  targetSegment: string
  maxAccountAgeDays: number | null
  priority: number
  dismissible: boolean
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  placement: string
}

export interface PromoBannerViewModel {
  id: string
  title: string
  description: string
  badgeText: string | null
  buttonText: string
  imageUrl: string | null
  type: CampaignType
  actionType: CampaignAction
  actionConfig: any
  targetingRules: any
  dismissible: boolean
  priority: number
  targetSegment: PromoBannerSegment
  maxAccountAgeDays: number | null
  startsAt: string | null
  endsAt: string | null
  status: 'available' | 'generated' | 'completed'
  code: string | null
  redeemPath: string | null
  externalUrl: string | null
}

export function isPromoBannerSegment(value: string): value is PromoBannerSegment {
  return Object.values(PROMO_BANNER_SEGMENTS).includes(value as PromoBannerSegment)
}

export function isPromoBannerPlacement(value: string): value is PromoBannerPlacement {
  return Object.values(PROMO_BANNER_PLACEMENTS).includes(value as PromoBannerPlacement)
}

export function isUserWithinAccountAgeWindow(
  createdAt: Date,
  maxAccountAgeDays: number = DEFAULT_PROMO_BANNER_ACCOUNT_AGE_DAYS,
  now: Date = new Date()
): boolean {
  const elapsedMs = now.getTime() - createdAt.getTime()
  return elapsedMs <= maxAccountAgeDays * 24 * 60 * 60 * 1000
}

export function isUserEligibleForPromoBanner(
  banner: Pick<PromoBannerRecord, 'isActive' | 'startsAt' | 'endsAt' | 'targetSegment' | 'maxAccountAgeDays'>,
  user: PromoBannerUser,
  interaction?: (PromoBannerInteractionRecord & { activationCode?: ActivationCodeRecord | null }) | null,
  now: Date = new Date()
): boolean {
  if (!banner.isActive) return false
  if (banner.startsAt && banner.startsAt > now) return false
  if (banner.endsAt && banner.endsAt < now) return false
  if (interaction?.dismissedAt) return false
  if (interaction?.activationCode?.isUsed) return false

  const requiresNewUser =
    banner.targetSegment === PROMO_BANNER_SEGMENTS.NEW_USERS ||
    banner.targetSegment === PROMO_BANNER_SEGMENTS.NEW_NON_PREMIUM_USERS
  const requiresNoPremium =
    banner.targetSegment === PROMO_BANNER_SEGMENTS.NON_PREMIUM_USERS ||
    banner.targetSegment === PROMO_BANNER_SEGMENTS.NEW_NON_PREMIUM_USERS

  if (requiresNewUser) {
    const maxAccountAgeDays = banner.maxAccountAgeDays ?? DEFAULT_PROMO_BANNER_ACCOUNT_AGE_DAYS
    if (!isUserWithinAccountAgeWindow(user.createdAt, maxAccountAgeDays, now)) {
      return false
    }
  }

  if (requiresNoPremium && user.subscriptionEnd && user.subscriptionEnd > now) {
    return false
  }

  return true
}

export function parsePromoBannerDateTime(value: string | null): Date | null {
  if (!value) return null

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid date provided for promo banner scheduling', 400)
  }

  return parsed
}

export function buildPromoBannerWriteData(input: PromoBannerInput): PromoBannerWriteData {
  const startsAt = parsePromoBannerDateTime(input.startsAt)
  const endsAt = parsePromoBannerDateTime(input.endsAt)

  if (startsAt && endsAt && endsAt < startsAt) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Promo banner end date must be after the start date', 400)
  }

  return {
    title: input.title,
    description: input.description,
    badgeText: input.badgeText,
    buttonText: input.buttonText,
    imageUrl: input.imageUrl,
    type: input.type,
    actionType: input.actionType,
    actionConfig: input.actionConfig ?? {},
    targetingRules: input.targetingRules ?? {},
    targetSegment: input.targetSegment,
    maxAccountAgeDays: input.maxAccountAgeDays ?? null,
    priority: input.priority,
    dismissible: input.dismissible,
    isActive: input.isActive,
    startsAt,
    endsAt,
    placement: PROMO_BANNER_PLACEMENTS.DASHBOARD_HOME,
  }
}

export function toPromoBannerViewModel(banner: PromoBannerWithInteraction): PromoBannerViewModel {
  const interaction = banner.interactions[0]
  const code = interaction?.activationCode?.isUsed ? null : interaction?.activationCode?.code ?? null

  let status: PromoBannerViewModel['status'] = code ? 'generated' : 'available'
  if (interaction?.claimedAt && !code && banner.actionType === CAMPAIGN_ACTIONS.CLAIM_CODE) {
    status = 'completed'
  }

  return {
    id: banner.id,
    title: banner.title,
    description: banner.description,
    badgeText: banner.badgeText,
    buttonText: banner.buttonText,
    imageUrl: banner.imageUrl,
    type: banner.type as CampaignType,
    actionType: banner.actionType as CampaignAction,
    actionConfig: banner.actionConfig,
    targetingRules: banner.targetingRules,
    dismissible: banner.dismissible,
    priority: banner.priority,
    targetSegment: banner.targetSegment as PromoBannerSegment,
    maxAccountAgeDays: banner.maxAccountAgeDays,
    startsAt: banner.startsAt?.toISOString() ?? null,
    endsAt: banner.endsAt?.toISOString() ?? null,
    status,
    code,
    redeemPath: code ? `/dashboard/subscription?promoCode=${encodeURIComponent(code)}` : null,
    externalUrl: banner.actionType === CAMPAIGN_ACTIONS.EXTERNAL_LINK ? (banner.actionConfig as any)?.url ?? null : null,
  }
}

export function getPromoBannerCodeType(): string {
  return ACTIVATION_CODE_TYPES.DAYS_7
}
