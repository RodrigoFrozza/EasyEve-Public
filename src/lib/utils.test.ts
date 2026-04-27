import { cn, calculateNetProfit, formatISK, isPremium, checkSiteSafety, formatNumber, formatSP, timeAgo, getRemainingDays } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar')
      expect(result).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      const result = cn('foo', false && 'bar', 'baz')
      expect(result).toBe('foo baz')
    })
  })

  describe('calculateNetProfit', () => {
    it('should return 0 for null data', () => {
      expect(calculateNetProfit(null)).toBe(0)
    })

    it('should return 0 for undefined data', () => {
      expect(calculateNetProfit(undefined)).toBe(0)
    })

    it('should calculate bounties correctly', () => {
      const data = { 
        automatedBounties: 1000000,
        automatedEss: 500000,
        additionalBounties: 100000
      }
      expect(calculateNetProfit(data)).toBe(1600000)
    })

    it('should include assets in calculation', () => {
      const data = { 
        automatedBounties: 1000000,
        estimatedLootValue: 200000
      }
      expect(calculateNetProfit(data)).toBe(1200000)
    })

    it('should subtract taxes', () => {
      const data = { 
        automatedBounties: 1000000,
        automatedTaxes: 100000
      }
      expect(calculateNetProfit(data)).toBe(900000)
    })
  })

  describe('formatISK', () => {
    it('should format millions correctly', () => {
      expect(formatISK(1000000)).toBe('1.00M ISK')
    })

    it('should format billions correctly', () => {
      expect(formatISK(1000000000)).toBe('1.00B ISK')
    })

    it('should format small amounts', () => {
      expect(formatISK(500)).toBe('500.00 ISK')
    })

    it('should handle null/undefined', () => {
      expect(formatISK(null)).toBe('0 ISK')
      expect(formatISK(undefined)).toBe('0 ISK')
    })

    it('should handle negative values', () => {
      expect(formatISK(-1000000)).toBe('-1.00M ISK')
    })
  })

  describe('isPremium', () => {
    it('should return false for null/undefined', () => {
      expect(isPremium(null)).toBe(false)
      expect(isPremium(undefined)).toBe(false)
    })

    it('should return false for past dates', () => {
      const pastDate = new Date('2020-01-01')
      expect(isPremium(pastDate)).toBe(false)
    })

    it('should return true for future dates', () => {
      const futureDate = new Date('2099-12-31')
      expect(isPremium(futureDate)).toBe(true)
    })
  })

  describe('checkSiteSafety', () => {
    it('should identify ghost sites as not_safe', () => {
      const result = checkSiteSafety('Ghost Site')
      expect(result.safety).toBe('not_safe')
      expect(result.type).toBe('ghost')
    })

    it('should identify covert sites as not_safe', () => {
      const result = checkSiteSafety('Covert Research')
      expect(result.safety).toBe('not_safe')
      expect(result.type).toBe('ghost')
    })

    it('should identify sleeper caches as not_safe', () => {
      const result = checkSiteSafety('Sleeper Cache')
      expect(result.safety).toBe('not_safe')
      expect(result.type).toBe('sleeper')
    })

    it('should identify superior sleeper cache with high difficulty', () => {
      const result = checkSiteSafety('Superior Sleeper Cache')
      expect(result.difficulty).toBe(5)
    })

    it('should identify drone sites as not_safe', () => {
      const result = checkSiteSafety('Abandoned Research Complex')
      expect(result.safety).toBe('not_safe')
      expect(result.type).toBe('drone')
    })

    it('should identify forgotten sites as not_safe', () => {
      const result = checkSiteSafety('Forgotten')
      expect(result.safety).toBe('not_safe')
    })

    it('should identify gas sites', () => {
      const result = checkSiteSafety('Gas Site')
      expect(result.type).toBe('gas')
    })

    it('should identify nebula as warning (safer)', () => {
      const result = checkSiteSafety('Nebula')
      expect(result.safety).toBe('warning')
    })

    it('should identify safe relic sites', () => {
      const result = checkSiteSafety('Crumbling Relic')
      expect(result.safety).toBe('safe')
      expect(result.type).toBe('relic')
    })

    it('should identify ruined relic sites', () => {
      const result = checkSiteSafety('Ruined Relic')
      expect(result.safety).toBe('safe')
    })

    it('should identify monument sites as safe', () => {
      const result = checkSiteSafety('Monument Site')
      expect(result.safety).toBe('safe')
    })

    it('should identify temple sites as safe', () => {
      const result = checkSiteSafety('Temple Site')
      expect(result.safety).toBe('safe')
    })

    it('should identify data sites by prefix', () => {
      const result = checkSiteSafety('Local Data')
      expect(result.type).toBe('data')
      expect(result.difficulty).toBe(1)
    })

    it('should identify regional data sites with medium difficulty', () => {
      const result = checkSiteSafety('Regional Data')
      expect(result.difficulty).toBe(2)
    })

    it('should return warning for unknown sites', () => {
      const result = checkSiteSafety('Random Site Name')
      expect(result.safety).toBe('warning')
      expect(result.type).toBe('unknown')
    })
  })

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000000)).toBe('1,000,000')
    })

    it('should handle null/undefined', () => {
      expect(formatNumber(null)).toBe('0')
      expect(formatNumber(undefined)).toBe('0')
    })

    it('should handle NaN', () => {
      expect(formatNumber(NaN)).toBe('0')
    })
  })

  describe('formatSP', () => {
    it('should format millions', () => {
      expect(formatSP(2500000)).toBe('2.50M SP')
    })

    it('should format thousands', () => {
      expect(formatSP(2500)).toBe('2.5K SP')
    })

    it('should handle raw values', () => {
      expect(formatSP(500)).toBe('500 SP')
    })

    it('should handle null/undefined', () => {
      expect(formatSP(null)).toBe('0 SP')
      expect(formatSP(undefined)).toBe('0 SP')
    })
  })

  describe('timeAgo', () => {
    it('should return years ago', () => {
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      expect(timeAgo(twoYearsAgo)).toContain('years ago')
    })

    it('should return months ago', () => {
      const date = new Date()
      date.setMonth(date.getMonth() - 2)
      expect(timeAgo(date)).toContain('month')
    })

    it('should return weeks ago', () => {
      const twoWeeksAgo = new Date()
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      expect(timeAgo(twoWeeksAgo)).toContain('weeks ago')
    })

    it('should return days ago', () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      expect(timeAgo(twoDaysAgo)).toBe('2 days ago')
    })

    it('should return hours ago', () => {
      const twoHoursAgo = new Date()
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)
      expect(timeAgo(twoHoursAgo)).toBe('2 hours ago')
    })

    it('should return minutes ago', () => {
      const twoMinutesAgo = new Date()
      twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2)
      expect(timeAgo(twoMinutesAgo)).toBe('2 minutes ago')
    })

    it('should return just now for recent dates', () => {
      expect(timeAgo(new Date())).toBe('just now')
    })

    it('should handle string dates', () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
      expect(timeAgo(twoDaysAgo.toISOString())).toBe('2 days ago')
    })
  })

  describe('getRemainingDays', () => {
    it('should return 0 for null/undefined', () => {
      expect(getRemainingDays(null)).toBe(0)
      expect(getRemainingDays(undefined)).toBe(0)
    })

    it('should return 0 for past dates', () => {
      const pastDate = new Date('2020-01-01')
      expect(getRemainingDays(pastDate)).toBe(0)
    })

    it('should return positive days for future dates', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)
      expect(getRemainingDays(futureDate)).toBeGreaterThan(0)
    })
  })
})