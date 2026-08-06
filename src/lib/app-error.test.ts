import { AppError, isAppError, getErrorCode, throwAppError } from './app-error'
import { ErrorCodes } from './error-codes'

describe('app-error', () => {
  describe('AppError', () => {
    it('should create error with code and details', () => {
      const error = new AppError(ErrorCodes.API_NOT_FOUND, 'Custom message', 404)
      expect(error.code).toBe(ErrorCodes.API_NOT_FOUND)
      expect(error.message).toBe('Custom message')
      expect(error.statusCode).toBe(404)
    })

    it('should use default message when not provided', () => {
      const error = new AppError(ErrorCodes.INVALID_INPUT)
      expect(error.message).toBeDefined()
    })

    it('should serialize to JSON', () => {
      const error = new AppError(ErrorCodes.VALIDATION_FAILED, 'Test', 400)
      const json = error.toJSON()
      expect(json.code).toBe(ErrorCodes.VALIDATION_FAILED)
      expect(json.statusCode).toBe(400)
    })
  })

  describe('isAppError', () => {
    it('should return true for AppError', () => {
      const error = new AppError(ErrorCodes.INVALID_INPUT)
      expect(isAppError(error)).toBe(true)
    })

    it('should return false for regular Error', () => {
      const error = new Error('test')
      expect(isAppError(error)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isAppError(null)).toBe(false)
    })
  })

  describe('getErrorCode', () => {
    it('should extract code from AppError', () => {
      const error = new AppError(ErrorCodes.VALIDATION_FAILED)
      expect(getErrorCode(error)).toBe(ErrorCodes.VALIDATION_FAILED)
    })

    it('should map database connection errors', () => {
      const error = new Error('database connection timeout')
      expect(getErrorCode(error)).toBe(ErrorCodes.DB_CONNECTION_FAILED)
    })

    it('should map token expired errors', () => {
      const error = new Error('token expired')
      expect(getErrorCode(error)).toBe(ErrorCodes.ESI_TOKEN_EXPIRED)
    })

    it('should map unauthorized errors', () => {
      const error = new Error('unauthorized access')
      expect(getErrorCode(error)).toBe(ErrorCodes.API_UNAUTHORIZED)
    })

    it('should map forbidden errors', () => {
      const error = new Error('forbidden access')
      expect(getErrorCode(error)).toBe(ErrorCodes.API_FORBIDDEN)
    })

    it('should map validation errors', () => {
      const error = new Error('validation failed')
      expect(getErrorCode(error)).toBe(ErrorCodes.VALIDATION_FAILED)
    })

    it('should map not found errors', () => {
      const error = new Error('resource not found')
      expect(getErrorCode(error)).toBe(ErrorCodes.API_NOT_FOUND)
    })

    it('should fallback to API_FETCH_FAILED for unknown errors', () => {
      const error = new Error('some random error')
      expect(getErrorCode(error)).toBe(ErrorCodes.API_FETCH_FAILED)
    })
  })

  describe('throwAppError', () => {
    it('should throw AppError', () => {
      expect(() => throwAppError(ErrorCodes.INVALID_INPUT)).toThrow(AppError)
    })
  })
})