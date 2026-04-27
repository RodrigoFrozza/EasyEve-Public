import {
  DEFAULT_PROMO_BANNER_ACCOUNT_AGE_DAYS,
  PROMO_BANNER_SEGMENTS,
  PROMO_BANNER_PLACEMENTS,
  isUserEligibleForPromoBanner,
  isPromoBannerSegment,
  isPromoBannerPlacement,
  isUserWithinAccountAgeWindow,
  parsePromoBannerDateTime,
  buildPromoBannerWriteData,
  toPromoBannerViewModel,
  PromoBannerInput,
} from './promo-banners'
import { AppError } from './app-error'

describe('promo-banners', () => {
  describe('isPromoBannerSegment', () => {
    it('should return true for valid segments', () => {
      expect(isPromoBannerSegment('ALL_USERS')).toBe(true)
      expect(isPromoBannerSegment('NEW_USERS')).toBe(true)
      expect(isPromoBannerSegment('NON_PREMIUM_USERS')).toBe(true)
      expect(isPromoBannerSegment('NEW_NON_PREMIUM_USERS')).toBe(true)
    })

    it('should return false for invalid segments', () => {
      expect(isPromoBannerSegment('INVALID')).toBe(false)
      expect(isPromoBannerSegment('')).toBe(false)
    })
  })

  describe('isPromoBannerPlacement', () => {
    it('should return true for valid placements', () => {
      expect(isPromoBannerPlacement('dashboard_home')).toBe(true)
    })

    it('should return false for invalid placements', () => {
      expect(isPromoBannerPlacement('invalid')).toBe(false)
    })
  })

  describe('isUserWithinAccountAgeWindow', () => {
    it('should return true when user is within age window', () => {
      const createdAt = new Date()
      const now = new Date()
      now.setDate(now.getDate() - 3)
      expect(isUserWithinAccountAgeWindow(createdAt, 7, now)).toBe(true)
    })

    it('should return false when user is outside age window', () => {
      const createdAt = new Date()
      const now = new Date()
      createdAt.setDate(createdAt.getDate() - 10)
      expect(isUserWithinAccountAgeWindow(createdAt, 7, now)).toBe(false)
    })

    it('should use default age window', () => {
      const recentDate = new Date()
      expect(isUserWithinAccountAgeWindow(recentDate)).toBe(true)
    })
  })

  describe('parsePromoBannerDateTime', () => {
    it('should parse valid date strings', () => {
      const result = parsePromoBannerDateTime('2026-12-31T23:59:59.000Z')
      expect(result).toBeInstanceOf(Date)
    })

    it('should return null for null input', () => {
      expect(parsePromoBannerDateTime(null)).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parsePromoBannerDateTime('')).toBeNull()
    })

    it('should throw for invalid date', () => {
      expect(() => parsePromoBannerDateTime('invalid')).toThrow()
    })
  })

  describe('buildPromoBannerWriteData', () => {
    it('should build valid write data', () => {
      const input: PromoBannerInput = {
        title: 'Test Banner',
        description: 'Test Description',
        badgeText: 'NEW',
        buttonText: 'Click Me',
        targetSegment: 'ALL_USERS',
        maxAccountAgeDays: 7,
        priority: 100,
        dismissible: true,
        isActive: true,
        startsAt: null,
        endsAt: null,
      }
      const result = buildPromoBannerWriteData(input)
      expect(result.title).toBe('Test Banner')
      expect(result.placement).toBe('dashboard_home')
    })

    it('should throw if end date is before start date', () => {
      const input: PromoBannerInput = {
        title: 'Test',
        description: 'Test',
        badgeText: null,
        buttonText: 'Click',
        targetSegment: 'ALL_USERS',
        maxAccountAgeDays: null,
        priority: 0,
        dismissible: false,
        isActive: false,
        startsAt: '2026-12-31',
        endsAt: '2026-01-01',
      }
      expect(() => buildPromoBannerWriteData(input)).toThrow()
    })
  })

  describe('isUserEligibleForPromoBanner', () => {
    it('shows new account banners to recent non-premium users', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')

      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.NEW_NON_PREMIUM_USERS,
            maxAccountAgeDays: DEFAULT_PROMO_BANNER_ACCOUNT_AGE_DAYS,
          },
          {
            id: 'user-1',
            createdAt: new Date('2026-04-15T12:00:00.000Z'),
            subscriptionEnd: null,
          },
          null,
          now
        )
      ).toBe(true)
    })

    it('hides onboarding banners from older accounts', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')

      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.NEW_USERS,
            maxAccountAgeDays: 7,
          },
          {
            id: 'user-1',
            createdAt: new Date('2026-04-01T12:00:00.000Z'),
            subscriptionEnd: null,
          },
          null,
          now
        )
      ).toBe(false)
    })

    it('hides banners after the generated promo code has already been redeemed', () => {
      const now = new Date('2026-04-18T12:00:00.000Z')

      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.ALL_USERS,
            maxAccountAgeDays: null,
          },
          {
            id: 'user-1',
            createdAt: new Date('2026-04-15T12:00:00.000Z'),
            subscriptionEnd: null,
          },
          {
            id: 'interaction-1',
            bannerId: 'banner-1',
            userId: 'user-1',
            activationCodeId: 'code-1',
            claimedAt: new Date('2026-04-16T12:00:00.000Z'),
            dismissedAt: null,
            createdAt: new Date('2026-04-16T12:00:00.000Z'),
            updatedAt: new Date('2026-04-16T12:00:00.000Z'),
            activationCode: {
              id: 'code-1',
              code: 'ABCD1234',
              type: 'DAYS_7',
              createdBy: null,
              isUsed: true,
              usedAt: new Date('2026-04-17T12:00:00.000Z'),
              usedById: 'user-1',
              createdAt: new Date('2026-04-16T12:00:00.000Z'),
            },
          },
          now
        )
      ).toBe(false)
    })

    it('hides inactive banners', () => {
      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: false,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.ALL_USERS,
            maxAccountAgeDays: null,
          },
          { id: 'user-1', createdAt: new Date(), subscriptionEnd: null },
          null
        )
      ).toBe(false)
    })

    it('hides banners that have not started yet', () => {
      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: new Date('2099-01-01'),
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.ALL_USERS,
            maxAccountAgeDays: null,
          },
          { id: 'user-1', createdAt: new Date(), subscriptionEnd: null },
          null
        )
      ).toBe(false)
    })

    it('hides banners that have expired', () => {
      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: new Date('2020-01-01'),
            targetSegment: PROMO_BANNER_SEGMENTS.ALL_USERS,
            maxAccountAgeDays: null,
          },
          { id: 'user-1', createdAt: new Date(), subscriptionEnd: null },
          null
        )
      ).toBe(false)
    })

    it('hides banners after user dismisses', () => {
      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.ALL_USERS,
            maxAccountAgeDays: null,
          },
          { id: 'user-1', createdAt: new Date(), subscriptionEnd: null },
          {
            id: 'interaction-1',
            bannerId: 'banner-1',
            userId: 'user-1',
            activationCodeId: null,
            claimedAt: null,
            dismissedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        )
      ).toBe(false)
    })

    it('hides promo banners requiring premium for premium users', () => {
      expect(
        isUserEligibleForPromoBanner(
          {
            isActive: true,
            startsAt: null,
            endsAt: null,
            targetSegment: PROMO_BANNER_SEGMENTS.NON_PREMIUM_USERS,
            maxAccountAgeDays: null,
          },
          {
            id: 'user-1',
            createdAt: new Date(),
            subscriptionEnd: new Date('2099-01-01'),
          },
          null
        )
      ).toBe(false)
    })
  })
})
