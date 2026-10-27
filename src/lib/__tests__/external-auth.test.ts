import { verifyExternalApiKey } from '@/lib/external-auth'
import { AppError } from '@/lib/app-error'

describe('External API Authentication', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('should throw 500 if EXTERNAL_API_KEY is not configured', () => {
    delete process.env.EXTERNAL_API_KEY
    const req = {
      headers: {
        get: (name: string) => (name === 'X-API-Key' ? 'any-key' : null)
      }
    } as unknown as Request

    expect(() => verifyExternalApiKey(req)).toThrow(AppError)
    try {
      verifyExternalApiKey(req)
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
    }
  })

  it('should throw 401 if X-API-Key header is missing', () => {
    process.env.EXTERNAL_API_KEY = 'secret-key'
    const req = {
      headers: {
        get: () => null
      }
    } as unknown as Request

    expect(() => verifyExternalApiKey(req)).toThrow(AppError)
    try {
      verifyExternalApiKey(req)
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
    }
  })

  it('should throw 401 if X-API-Key header is incorrect', () => {
    process.env.EXTERNAL_API_KEY = 'secret-key'
    const req = {
      headers: {
        get: (name: string) => (name === 'X-API-Key' ? 'wrong-key' : null)
      }
    } as unknown as Request

    expect(() => verifyExternalApiKey(req)).toThrow(AppError)
  })

  it('should succeed if X-API-Key matches EXTERNAL_API_KEY', () => {
    process.env.EXTERNAL_API_KEY = 'secret-key'
    const req = {
      headers: {
        get: (name: string) => (name === 'X-API-Key' ? 'secret-key' : null)
      }
    } as unknown as Request

    expect(() => verifyExternalApiKey(req)).not.toThrow()
  })
})
