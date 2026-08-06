import { ErrorCodes, getErrorMessage, isKnownErrorCode, ErrorMessages } from './error-codes'

describe('error-codes', () => {
  describe('ErrorCodes', () => {
    it('should have all required codes', () => {
      expect(ErrorCodes.CHUNK_LOAD_ERROR).toBe('E001')
      expect(ErrorCodes.ESI_TOKEN_EXPIRED).toBe('A001')
      expect(ErrorCodes.API_FETCH_FAILED).toBe('C001')
      expect(ErrorCodes.VALIDATION_FAILED).toBe('D001')
      expect(ErrorCodes.DATABASE_ERROR).toBe('E002')
    })
  })

  describe('getErrorMessage', () => {
    it('should return message for valid code', () => {
      expect(getErrorMessage(ErrorCodes.API_NOT_FOUND)).toBe('Resource not found.')
    })

    it('should return unknown error message for invalid code', () => {
      expect(getErrorMessage('INVALID' as any)).toBe(ErrorMessages[ErrorCodes.UNKNOWN_ERROR])
    })
  })

  describe('isKnownErrorCode', () => {
    it('should return true for valid codes', () => {
      expect(isKnownErrorCode('C001')).toBe(true)
      expect(isKnownErrorCode('E001')).toBe(true)
    })

    it('should return false for invalid codes', () => {
      expect(isKnownErrorCode('INVALID')).toBe(false)
      expect(isKnownErrorCode('')).toBe(false)
    })
  })
})