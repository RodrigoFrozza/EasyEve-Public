const mockPrisma = {
  activationCode: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
}

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
}))

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request) =>
      handler(req, { id: 'master-user', role: 'master' }),
}))

describe('DELETE /api/admin/codes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 when trying to invalidate an already used code', async () => {
    const { DELETE } = await import('./route')
    mockPrisma.activationCode.findUnique.mockResolvedValue({
      id: 'code-1',
      isUsed: true,
      isInvalidated: false,
    })

    const req = { url: 'http://localhost/api/admin/codes?id=code-1', method: 'DELETE' } as Request

    const res = await DELETE(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('already used')
  })
})
