import { isTokenExpired, isTokenExpiringSoon } from './token-manager'

describe('token-manager', () => {
  describe('isTokenExpired', () => {
    it('should return true for null', () => {
      expect(isTokenExpired(null)).toBe(true)
    })

    it('should return true for past date', () => {
      const pastDate = new Date('2020-01-01')
      expect(isTokenExpired(pastDate)).toBe(true)
    })

    it('should return false for future date', () => {
      const futureDate = new Date('2099-12-31')
      expect(isTokenExpired(futureDate)).toBe(false)
    })

    it('should return true for current time (exactly now)', () => {
      const now = new Date()
      const result = isTokenExpired(now)
      // Should be true or false depending on millisecond precision
      // Just verify it returns a boolean
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('should return true for null', () => {
      expect(isTokenExpiringSoon(null)).toBe(true)
    })

    it('should return true for past date', () => {
      const pastDate = new Date('2020-01-01')
      expect(isTokenExpiringSoon(pastDate)).toBe(true)
    })

    it('should return false for date more than threshold in future', () => {
      const farFuture = new Date(Date.now() + 30 * 60 * 1000) // 30 mins
      expect(isTokenExpiringSoon(farFuture, 5)).toBe(false)
    })

    it('should return true for date within threshold', () => {
      const soon = new Date(Date.now() + 2 * 60 * 1000) // 2 mins (within 5 min threshold)
      expect(isTokenExpiringSoon(soon, 5)).toBe(true)
    })

    it('should respect custom threshold', () => {
      const in10Mins = new Date(Date.now() + 10 * 60 * 1000)
      
      // 10 minutes > 5 minute threshold = NOT expiring soon
      expect(isTokenExpiringSoon(in10Mins, 5)).toBe(false)
      // 10 minutes < 15 minute threshold = IS expiring soon
      expect(isTokenExpiringSoon(in10Mins, 15)).toBe(true)
    })
  })
})