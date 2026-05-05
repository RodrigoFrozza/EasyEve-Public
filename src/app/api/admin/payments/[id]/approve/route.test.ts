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

const mockPrisma = {
  $transaction: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/server-logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request, context: any) =>
      handler(req, { id: 'admin-user' }, context),
}))

describe('POST /api/admin/payments/[id]/approve', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 400 when payment is already approved', async () => {
    const { POST } = await import('./route')

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'approved',
            amount: 1000,
            userId: 'user-1',
            user: {
              subscriptionEnd: null,
              allowedActivities: [],
            },
          }),
        },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/approve',
      method: 'POST',
      json: async () => ({ allowedActivities: [], months: 1 }),
    } as unknown as Request

    const res = await POST(req as any, { params: { id: 'payment-1' } })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.code).toBe(ErrorCodes.INVALID_INPUT)
    expect(data.error).toContain('already approved')
  })
})
