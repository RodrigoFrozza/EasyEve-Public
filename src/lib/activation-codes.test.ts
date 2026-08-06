import {
  ACTIVATION_CODE_TYPES,
  isActivationCodeType,
  getActivationCodeDurationDays,
  resolveSubscriptionEndFromCodeType,
  generateActivationCode,
  generatePrefixedActivationCode,
} from './activation-codes'
import { AppError } from './app-error'

describe('activation-codes', () => {
  describe('isActivationCodeType', () => {
    it('should return true for valid types', () => {
      expect(isActivationCodeType('DAYS_7')).toBe(true)
      expect(isActivationCodeType('DAYS_30')).toBe(true)
      expect(isActivationCodeType('LIFETIME')).toBe(true)
      expect(isActivationCodeType('PL8R')).toBe(true)
    })

    it('should return false for invalid types', () => {
      expect(isActivationCodeType('INVALID')).toBe(false)
      expect(isActivationCodeType('')).toBe(false)
    })
  })

  describe('getActivationCodeDurationDays', () => {
    it('returns 7 days for onboarding promo codes', () => {
      expect(getActivationCodeDurationDays(ACTIVATION_CODE_TYPES.DAYS_7)).toBe(7)
    })

    it('returns 30 days for standard codes', () => {
      expect(getActivationCodeDurationDays(ACTIVATION_CODE_TYPES.DAYS_30)).toBe(30)
    })

    it('returns null for lifetime codes', () => {
      expect(getActivationCodeDurationDays(ACTIVATION_CODE_TYPES.LIFETIME)).toBeNull()
    })

    it('returns null for PL8R codes', () => {
      expect(getActivationCodeDurationDays(ACTIVATION_CODE_TYPES.PL8R)).toBeNull()
    })
  })

  describe('generateActivationCode', () => {
    it('generates code of default length', () => {
      const code = generateActivationCode()
      expect(code).toHaveLength(8)
    })

    it('generates code of specified length', () => {
      const code = generateActivationCode(12)
      expect(code).toHaveLength(12)
    })

    it('contains only valid characters', () => {
      const code = generateActivationCode()
      const validChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      for (const char of code) {
        expect(validChars).toContain(char)
      }
    })
  })

  describe('generatePrefixedActivationCode', () => {
    it('generates prefixed code with default length', () => {
      const code = generatePrefixedActivationCode('TEST')
      expect(code).toMatch(/^TEST-[A-Z2-9]{4}$/)
    })

    it('uses custom length', () => {
      const code = generatePrefixedActivationCode('TEST', 6)
      expect(code).toMatch(/^TEST-[A-Z2-9]{6}$/)
    })
  })

  describe('resolveSubscriptionEndFromCodeType', () => {
    it('extends from now when there is no active subscription', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')

      expect(
        resolveSubscriptionEndFromCodeType(ACTIVATION_CODE_TYPES.DAYS_7, null, now).toISOString()
      ).toBe('2026-04-25T12:00:00.000Z')
    })

    it('extends from the current premium end date when the subscription is still active', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')
      const currentEnd = new Date('2026-04-30T12:00:00.000Z')

      expect(
        resolveSubscriptionEndFromCodeType(
          ACTIVATION_CODE_TYPES.DAYS_30,
          currentEnd,
          now
        ).toISOString()
      ).toBe('2026-05-30T12:00:00.000Z')
    })

    it('returns lifetime end date for LIFETIME codes', () => {
      const result = resolveSubscriptionEndFromCodeType(ACTIVATION_CODE_TYPES.LIFETIME, null)
      expect(result.toISOString()).toBe('2099-12-31T23:59:59.000Z')
    })

    it('returns lifetime end date for PL8R codes', () => {
      const result = resolveSubscriptionEndFromCodeType(ACTIVATION_CODE_TYPES.PL8R, null)
      expect(result.toISOString()).toBe('2099-12-31T23:59:59.000Z')
    })

    it('throws for unknown code types', () => {
      expect(() => resolveSubscriptionEndFromCodeType('INVALID_TYPE', null)).toThrow()
    })

    it('handles expired subscription - extends from now', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')
      const expiredEnd = new Date('2026-01-01T12:00:00.000Z')

      const result = resolveSubscriptionEndFromCodeType(
        ACTIVATION_CODE_TYPES.DAYS_7,
        expiredEnd,
        now
      )
      expect(result.toISOString()).toBe('2026-04-25T12:00:00.000Z')
    })
  })
})
