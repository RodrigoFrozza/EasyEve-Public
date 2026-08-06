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
  securityEvent: { create: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

jest.mock('@/lib/server-logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request, context: any) =>
      handler(req, { id: 'admin-user' }, context),
}))

describe('POST /api/admin/payments/[id]/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reverses the credited iskBalance and records a negative IskHistory entry', async () => {
    const { POST } = await import('./route')

    const userUpdate = jest.fn().mockResolvedValue({})
    const iskHistoryCreate = jest.fn().mockResolvedValue({})

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'pending',
            amount: 1000,
            userId: 'user-1',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'rejected',
            amount: 1000,
            userId: 'user-1',
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ iskBalance: 1000 }), update: userUpdate },
        iskHistory: { create: iskHistoryCreate },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/reject',
      method: 'POST',
    } as unknown as Request

    const result = await POST(req as any, { params: { id: 'payment-1' } })

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { iskBalance: { decrement: 1000 } },
    })
    expect(iskHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        amount: -1000,
        type: 'payment_reversal',
        reference: 'payment-1',
      }),
    })
    expect(result).toEqual(
      expect.objectContaining({ id: 'payment-1', status: 'rejected' })
    )
  })

  it('returns 400 when payment is already rejected', async () => {
    const { POST } = await import('./route')

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'rejected',
            amount: 1000,
            userId: 'user-1',
          }),
        },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/reject',
      method: 'POST',
    } as unknown as Request

    const res = await POST(req as any, { params: { id: 'payment-1' } })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.code).toBe(ErrorCodes.INVALID_INPUT)
    expect(data.error).toContain('already rejected')
  })
})
