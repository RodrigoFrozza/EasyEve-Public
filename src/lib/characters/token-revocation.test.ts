const mockPrisma = {
  character: { updateMany: jest.fn(), findUnique: jest.fn() },
  notification: { create: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma
  },
}))
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
jest.mock('@/lib/server-logger', () => ({
  get logger() {
    return mockLogger
  },
}))

import { isRevocationError, isTokenRevoked, markCharacterTokenRevoked } from './token-revocation'

describe('token revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.character.findUnique.mockResolvedValue({
      name: 'wilson Pahineh',
      userId: 'u1',
      user: { accountCode: 'EVE-ABC123' },
    })
  })

  it('recognises the epoch+1ms sentinel and only that', () => {
    expect(isTokenRevoked(new Date(1))).toBe(true)
    expect(isTokenRevoked(new Date('2026-10-26T15:00:00Z'))).toBe(false)
    expect(isTokenRevoked(null)).toBe(false)
  })

  it('treats only invalid_grant/token_invalid as revocation', () => {
    expect(isRevocationError('invalid_grant')).toBe(true)
    expect(isRevocationError('token_invalid')).toBe(true)
    expect(isRevocationError('network_error')).toBe(false)
    expect(isRevocationError(undefined)).toBe(false)
  })

  it('flags the token and tells the owner, with a link to log the character in again', async () => {
    mockPrisma.character.updateMany.mockResolvedValue({ count: 1 })

    await markCharacterTokenRevoked(95600976)

    expect(mockPrisma.character.updateMany.mock.calls[0][0].data).toEqual({ tokenExpiresAt: new Date(1) })
    expect(mockPrisma.notification.create.mock.calls[0][0].data).toMatchObject({
      userId: 'u1',
      type: 'system',
      title: 'Reconecte wilson Pahineh',
      link: '/link-character?accountCode=EVE-ABC123',
    })
  })

  it('does not notify again when the token was already flagged', async () => {
    mockPrisma.character.updateMany.mockResolvedValue({ count: 0 })
    await markCharacterTokenRevoked(95600976)
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('keeps the flag even if the notification fails', async () => {
    mockPrisma.character.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.notification.create.mockRejectedValue(new Error('db down'))
    await expect(markCharacterTokenRevoked(95600976)).resolves.toBeUndefined()
    expect(mockLogger.error).toHaveBeenCalled()
  })
})
