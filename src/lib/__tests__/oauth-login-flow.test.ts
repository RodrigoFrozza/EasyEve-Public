const tx = {
  user: { create: jest.fn() },
  character: { create: jest.fn() },
}

const mockPrisma = {
  character: { findUnique: jest.fn() },
  user: { create: jest.fn(), update: jest.fn() },
  securityEvent: { create: jest.fn() },
  $transaction: jest.fn(),
}

jest.mock('../prisma', () => ({
  get prisma() {
    return mockPrisma
  },
}))

const mockFetchCharacterData = jest.fn()
jest.mock('../esi', () => ({
  getCharacterInfo: jest.fn().mockResolvedValue({
    character_id: 2124753941,
    character_name: 'DANKLEY02',
    character_owner_hash: 'owner-hash',
  }),
  fetchCharacterData: (...args: unknown[]) => mockFetchCharacterData(...args),
}))
jest.mock('../crypto/token-cipher', () => ({ encryptToken: (t: string) => `enc:${t}` }))
jest.mock('../account-code', () => ({ generateAccountCode: () => 'EVE-TEST01' }))
jest.mock('../server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { handleLoginFlow, recordLoginFailure } from '../oauth-handlers'

describe('handleLoginFlow — first login of a new character', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 1200 }),
    }) as unknown as typeof fetch
    mockPrisma.character.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))
    tx.user.create.mockResolvedValue({ id: 'new-user', isBlocked: false, isTester: false, subscriptionEnd: null })
    tx.character.create.mockResolvedValue({})
    mockPrisma.user.update.mockResolvedValue({})
  })

  it('creates no account at all when the ESI character fetch fails', async () => {
    mockFetchCharacterData.mockRejectedValue(new Error('ESI 404 for new character'))

    await expect(handleLoginFlow('code', 'https://easyeve.test')).rejects.toThrow('ESI 404')

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('creates the user and its character inside one transaction', async () => {
    mockFetchCharacterData.mockResolvedValue({ corporationId: 98826336 })

    const result = await handleLoginFlow('code', 'https://easyeve.test')

    expect(result.userId).toBe('new-user')
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
    expect(tx.character.create.mock.calls[0][0].data).toMatchObject({
      id: 2124753941,
      userId: 'new-user',
      ownerHash: 'owner-hash',
      isMain: true,
    })
  })

  it('propagates a character insert failure so the transaction rolls the user back', async () => {
    mockFetchCharacterData.mockResolvedValue({})
    tx.character.create.mockRejectedValue(new Error('Unique constraint failed on ownerHash'))

    await expect(handleLoginFlow('code', 'https://easyeve.test')).rejects.toThrow('Unique constraint')
    expect(tx.user.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})

describe('recordLoginFailure', () => {
  beforeEach(() => jest.clearAllMocks())

  it('stores the error as a LOGIN_FAILED security event', async () => {
    await recordLoginFailure('/api/auth/callback/eveonline', new Error('boom'), 'main')
    expect(mockPrisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        event: 'LOGIN_FAILED',
        path: '/api/auth/callback/eveonline',
        details: { esiApp: 'main', errorName: 'Error', message: 'boom' },
      },
    })
  })

  it('never throws, so the user still gets the error redirect', async () => {
    mockPrisma.securityEvent.create.mockRejectedValue(new Error('db down'))
    await expect(recordLoginFailure('/x', 'oops', 'holding')).resolves.toBeUndefined()
  })
})
