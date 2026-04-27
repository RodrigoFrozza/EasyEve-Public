import crypto from 'crypto'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const ACTIVATION_CODE_TYPES = {
  DAYS_7: 'DAYS_7',
  DAYS_30: 'DAYS_30',
  LIFETIME: 'LIFETIME',
  PL8R: 'PL8R',
} as const

export type ActivationCodeType =
  (typeof ACTIVATION_CODE_TYPES)[keyof typeof ACTIVATION_CODE_TYPES]

const DEFAULT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const LIFETIME_END_DATE = new Date('2099-12-31T23:59:59Z')

export function isActivationCodeType(value: string): value is ActivationCodeType {
  return Object.values(ACTIVATION_CODE_TYPES).includes(value as ActivationCodeType)
}

export function getActivationCodeDurationDays(type: string): number | null {
  if (type === ACTIVATION_CODE_TYPES.DAYS_7) return 7
  if (type === ACTIVATION_CODE_TYPES.DAYS_30) return 30
  return null
}

export function resolveSubscriptionEndFromCodeType(
  type: string,
  currentSubscriptionEnd: Date | null | undefined,
  now: Date = new Date()
): Date {
  if (type === ACTIVATION_CODE_TYPES.LIFETIME || type === ACTIVATION_CODE_TYPES.PL8R) {
    return LIFETIME_END_DATE
  }

  const durationDays = getActivationCodeDurationDays(type)

  if (!durationDays) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Unknown activation code type', 400)
  }

  const activeEndDate = currentSubscriptionEnd && currentSubscriptionEnd > now
    ? currentSubscriptionEnd
    : now

  return new Date(activeEndDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
}

export function generateActivationCode(length: number = 8): string {
  let result = ''
  const buffer = crypto.randomBytes(length)

  for (let index = 0; index < length; index += 1) {
    result += DEFAULT_CODE_CHARS[buffer[index] % DEFAULT_CODE_CHARS.length]
  }

  return result
}

export function generatePrefixedActivationCode(prefix: string, length: number = 4): string {
  return `${prefix}-${generateActivationCode(length)}`
}
