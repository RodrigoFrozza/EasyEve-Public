const mockPrisma = {
  securityEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
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

jest.mock('@/lib/session', () => ({
  getSession: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request) =>
      handler(req, { id: 'master-user', role: 'master' }),
}))

describe('POST /api/admin/security', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.INTERNAL_SECURITY_KEY
  })

  it('returns 403 when request has no internal key and no master session', async () => {
    const { POST } = await import('./route')

    const req = {
      url: 'http://localhost/api/admin/security',
      method: 'POST',
      headers: {
        get: () => null,
      },
      json: async () => ({ event: 'TEST' }),
    } as unknown as Request

    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
