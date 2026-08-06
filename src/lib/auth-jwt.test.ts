import { createJWT, verifyJWT, createSessionCookie, clearSessionCookie } from './auth-jwt'
import { SignJWT, jwtVerify } from 'jose'

describe('auth-jwt', () => {
  const mockSignJWT = SignJWT as any
  const mockJwtVerify = jwtVerify as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createJWT', () => {
    it('should create a valid JWT token', async () => {
      const token = await createJWT('user-123', 123456, 'owner-hash-abc')
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(mockSignJWT).toHaveBeenCalledWith({
        userId: 'user-123',
        characterId: 123456,
        ownerHash: 'owner-hash-abc',
      })
    })

    it('should set correct JWT options', async () => {
      await createJWT('user-123', 123456, 'owner-hash-abc')
      
      const mockInstance = mockSignJWT.mock.results[0].value
      expect(mockInstance.setProtectedHeader).toHaveBeenCalledWith({ alg: 'HS256' })
      expect(mockInstance.setIssuedAt).toHaveBeenCalled()
      expect(mockInstance.setExpirationTime).toHaveBeenCalledWith('8h')
    })
  })

  describe('verifyJWT', () => {
    it('should verify and decode a valid JWT', async () => {
      const mockPayload = {
        userId: 'user-123',
        characterId: 123456,
        ownerHash: 'owner-hash-abc',
        iat: 1234567890,
        exp: 1234567890,
      }
      mockJwtVerify.mockResolvedValue({ payload: mockPayload } as any)
      
      const token = 'valid.token.here'
      const result = await verifyJWT(token)
      
      expect(mockJwtVerify).toHaveBeenCalledWith(token, expect.any(Uint8Array))
      expect(result).toEqual({
        userId: 'user-123',
        characterId: 123456,
        ownerHash: 'owner-hash-abc',
        iat: 1234567890,
        exp: 1234567890,
      })
    })

    it('should return null for invalid token', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'))
      
      const result = await verifyJWT('invalid.token.here')
      expect(result).toBeNull()
    })

    it('should return null for empty string', async () => {
      mockJwtVerify.mockRejectedValue(new Error('Invalid token'))
      
      const result = await verifyJWT('')
      expect(result).toBeNull()
    })
  })

  describe('createSessionCookie', () => {
    it('should create session cookie with Secure flag in production', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'production'
      
      const cookie = createSessionCookie('test-token')
      
      expect(cookie).toContain('session=test-token')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Max-Age=28800')
    })

    it('should NOT include Secure flag in development', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'development'
      
      const cookie = createSessionCookie('test-token')
      
      expect(cookie).toContain('session=test-token')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).not.toContain('Secure')
    })
  })

  describe('clearSessionCookie', () => {
    it('should create cookie that clears session', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'production'
      
      const cookie = clearSessionCookie()
      
      expect(cookie).toContain('session=')
      expect(cookie).toContain('Max-Age=0')
      expect(cookie).toContain('HttpOnly')
    })
  })
})