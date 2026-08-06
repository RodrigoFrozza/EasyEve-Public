const mockPrisma = {
  scriptExecution: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  securityEvent: {
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

jest.mock('@/lib/scripts/runner', () => ({
  runScript: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/scripts/registry', () => ({
  SCRIPT_REGISTRY: {
    dangerous_script: {
      name: 'Dangerous Script',
      executionPolicy: 'elevated',
      supportsDryRun: true,
    },
  },
  normalizeScriptParams: jest.fn().mockReturnValue({ ok: true, params: {} }),
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request) =>
      handler(req, { id: 'master-user' }),
}))

describe('POST /api/admin/scripts/execute (elevated policy)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.ADMIN_SCRIPT_ELEVATED_USER_IDS = 'another-admin'
    mockPrisma.scriptExecution.findFirst.mockResolvedValue(null)
  })

  it('returns 403 when master user is not in elevated allowlist', async () => {
    const { POST } = await import('./route')

    const req = {
      url: 'http://localhost/api/admin/scripts/execute?scriptId=dangerous_script',
      method: 'POST',
      json: async () => ({ params: {} }),
      clone: function () {
        return this
      },
    } as unknown as Request

    const res = await POST(req as any)
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain('elevated')
  })
})
