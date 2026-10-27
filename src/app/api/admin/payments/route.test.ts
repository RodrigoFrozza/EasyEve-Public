import { AppError } from '@/lib/app-error'
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
}))

let currentRole: 'master' | 'user' = 'master'

const mockPrisma = {
  payment: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    ({ requiredRole }: { requiredRole: string }, handler: any) =>
    async (req: Request) => {
      if (currentRole !== requiredRole) {
        throw new AppError(ErrorCodes.API_FORBIDDEN, 'Forbidden', 403)
      }
      return handler(req, { id: 'admin-user', role: currentRole })
    },
}))

describe('GET /api/admin/payments authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 403 for non-master users', async () => {
    currentRole = 'user'
    const { GET } = await import('./route')

    const req = { url: 'http://localhost/api/admin/payments', method: 'GET' } as Request
    const res = await GET(req as any)

    expect(res.status).toBe(403)
  })
})
