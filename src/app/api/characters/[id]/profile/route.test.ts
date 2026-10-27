import { ErrorCodes } from '@/lib/error-codes'

jest.mock('@/lib/api-handler', () => ({
  withErrorHandling:
    (handler: any) =>
    async (req: Request, ...args: any[]) => {
      try {
        return await handler(req, ...args)
      } catch (error: any) {
        return {
          status: error?.statusCode || 500,
          json: async () => ({
            error: error?.message || 'Internal server error',
            code: error?.code,
          }),
        }
      }
    },
  // Real Zod parsing (not mocked) so the PatchBodySchema in the route is
  // actually exercised — but reimplemented locally rather than pulling in the
  // real '@/lib/api-handler' module, which eagerly imports 'next/server' and
  // needs a full Response/Request polyfill this test suite doesn't set up.
  validateBody: async (req: Request, schema: any) => {
    const body = await req.json()
    return schema.parse(body)
  },
}))

const mockWriteCharacterSnapshot = jest.fn()
jest.mock('@/lib/characters/snapshot', () => ({
  writeCharacterSnapshot: (...args: unknown[]) => mockWriteCharacterSnapshot(...args),
}))

const mockToOwnerProfileDto = jest.fn()
jest.mock('@/lib/characters/share-profile', () => ({
  toOwnerProfileDto: (...args: unknown[]) => mockToOwnerProfileDto(...args),
}))

const mockGenerateShareToken = jest.fn()
jest.mock('@/lib/characters/share-token', () => ({
  generateShareToken: (...args: unknown[]) => mockGenerateShareToken(...args),
}))

const mockPrisma = {
  character: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

let currentUser: any = { id: 'user-1' }
jest.mock('@/lib/api-helpers', () => ({
  withAuth: (...args: any[]) => {
    // Supports both withAuth(handler) and withAuth(options, handler) overloads.
    const handler = args.length === 1 ? args[0] : args[1]
    return async (req: Request, context: any) => handler(req, currentUser, context)
  },
}))

describe('PATCH /api/characters/[id]/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentUser = { id: 'user-1' }
  })

  it('returns 404 (API_NOT_FOUND) when the character does not belong to the authenticated user', async () => {
    mockPrisma.character.findFirst.mockResolvedValue(null)
    const { PATCH } = await import('./route')

    const req = { json: async () => ({ shareAction: 'rotate' }) } as unknown as Request
    const res: any = await PATCH(req, { params: Promise.resolve({ id: '42' }) })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.code).toBe(ErrorCodes.API_NOT_FOUND)
    expect(mockPrisma.character.update).not.toHaveBeenCalled()
  })

  it("shareAction 'rotate' mints a fresh token different from the previous one", async () => {
    mockPrisma.character.findFirst.mockResolvedValue({ id: 42, userId: 'user-1', shareToken: 'old-token' })
    mockGenerateShareToken.mockReturnValue('brand-new-token')
    mockPrisma.character.update.mockResolvedValue({ id: 42, isOmega: null, shareToken: 'brand-new-token' })

    const { PATCH } = await import('./route')
    const req = { json: async () => ({ shareAction: 'rotate' }) } as unknown as Request
    const res: any = await PATCH(req, { params: Promise.resolve({ id: '42' }) })

    expect(mockPrisma.character.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { shareToken: 'brand-new-token' },
    })
    expect(res.shareToken).toBe('brand-new-token')
    expect(res.shareToken).not.toBe('old-token')
  })

  it("shareAction 'enable' mints a token only when one doesn't already exist (reuses the existing one otherwise)", async () => {
    mockPrisma.character.findFirst.mockResolvedValue({ id: 42, userId: 'user-1', shareToken: 'already-there' })
    mockPrisma.character.update.mockResolvedValue({ id: 42, isOmega: null, shareToken: 'already-there' })

    const { PATCH } = await import('./route')
    const req = { json: async () => ({ shareAction: 'enable' }) } as unknown as Request
    await PATCH(req, { params: Promise.resolve({ id: '42' }) })

    expect(mockGenerateShareToken).not.toHaveBeenCalled()
    expect(mockPrisma.character.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { shareToken: 'already-there' },
    })
  })

  it("shareAction 'disable' clears the share token to null", async () => {
    mockPrisma.character.findFirst.mockResolvedValue({ id: 42, userId: 'user-1', shareToken: 'old-token' })
    mockPrisma.character.update.mockResolvedValue({ id: 42, isOmega: null, shareToken: null })

    const { PATCH } = await import('./route')
    const req = { json: async () => ({ shareAction: 'disable' }) } as unknown as Request
    const res: any = await PATCH(req, { params: Promise.resolve({ id: '42' }) })

    expect(mockPrisma.character.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { shareToken: null },
    })
    expect(res.shareToken).toBeNull()
  })

  it('updates isOmega independently of shareAction', async () => {
    mockPrisma.character.findFirst.mockResolvedValue({ id: 42, userId: 'user-1', shareToken: null })
    mockPrisma.character.update.mockResolvedValue({ id: 42, isOmega: true, shareToken: null })

    const { PATCH } = await import('./route')
    const req = { json: async () => ({ isOmega: true }) } as unknown as Request
    const res: any = await PATCH(req, { params: Promise.resolve({ id: '42' }) })

    expect(mockPrisma.character.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { isOmega: true },
    })
    expect(res.isOmega).toBe(true)
  })

  it('rejects an invalid shareAction with a validation error (real Zod schema, not mocked)', async () => {
    mockPrisma.character.findFirst.mockResolvedValue({ id: 42, userId: 'user-1', shareToken: null })

    const { PATCH } = await import('./route')
    const req = { json: async () => ({ shareAction: 'not-a-real-action' }) } as unknown as Request
    const res: any = await PATCH(req, { params: Promise.resolve({ id: '42' }) })

    // The route's own PatchBodySchema rejects the invalid enum value before any
    // Prisma write happens — status shape depends on the (mocked) error handler,
    // but the write must never occur.
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(mockPrisma.character.update).not.toHaveBeenCalled()
  })
})
