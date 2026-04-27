import { validateAccountCode, generateAccountCode } from './account-code'

describe('account-code', () => {
  describe('validateAccountCode', () => {
    it('should validate correct account codes', () => {
      // ABC are valid (A-C are in A-H), 2 is valid (2-9 are valid digits)
      expect(validateAccountCode('EVE-ABC2XX')).toBe(true)
    })

    it('should reject invalid format', () => {
      expect(validateAccountCode('INVALID')).toBe(false)
      expect(validateAccountCode('EVE-')).toBe(false)
      expect(validateAccountCode('')).toBe(false)
    })

    it('should reject codes with ambiguous characters', () => {
      // I, O, N are not allowed to avoid confusion
      expect(validateAccountCode('EVE-INIXXX')).toBe(false)
      expect(validateAccountCode('EVE-ONOXXX')).toBe(false)
      // 0 and 1 are not valid digits
      expect(validateAccountCode('EVE-0XXXXX')).toBe(false)
      expect(validateAccountCode('EVE-1XXXXX')).toBe(false)
    })

    it('should accept valid characters', () => {
      // A-H, J-N, P-Z, 2-9 are allowed
      expect(validateAccountCode('EVE-ABCDEF')).toBe(true)
      expect(validateAccountCode('EVE-QRSTUV')).toBe(true)
      expect(validateAccountCode('EVE-234567')).toBe(true)
    })
  })

  describe('generateAccountCode', () => {
    it('should generate valid account codes', () => {
      const code = generateAccountCode()
      expect(validateAccountCode(code)).toBe(true)
    })

    it('should generate codes with EVE- prefix', () => {
      const code = generateAccountCode()
      expect(code.startsWith('EVE-')).toBe(true)
    })

    it('should generate 10 character codes', () => {
      const code = generateAccountCode()
      expect(code.length).toBe(10)
    })
  })
})