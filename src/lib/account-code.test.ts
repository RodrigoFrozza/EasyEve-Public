import { validateAccountCode, generateAccountCode, extractAccountCode } from './account-code'

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

  describe('extractAccountCode', () => {
    it("reads the code from the payer's reason note (the real deposit case)", () => {
      // EVE puts the player's typed note in `reason`; `description` is CCP's
      // auto-generated text with no code. Regression that lost a 100M deposit.
      const reason = 'EVE-ABC234'
      const description = '[r] Brutus Kobalt deposited cash into Easy Eve Holding\'s account'
      expect(extractAccountCode(reason, description)).toBe('EVE-ABC234')
    })

    it('prefers reason over description when both contain a code', () => {
      expect(extractAccountCode('pay EVE-ABC234', 'note EVE-DEF345')).toBe('EVE-ABC234')
    })

    it('falls back to description when reason is empty', () => {
      expect(extractAccountCode(null, 'ref EVE-ABC234 thanks')).toBe('EVE-ABC234')
    })

    it('normalizes to uppercase', () => {
      expect(extractAccountCode('eve-abc234')).toBe('EVE-ABC234')
    })

    it('returns null when no code is present', () => {
      expect(extractAccountCode('just a donation', undefined, null)).toBeNull()
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