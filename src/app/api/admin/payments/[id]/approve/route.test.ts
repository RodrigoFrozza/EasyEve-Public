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

// Provide Prisma.sql (used for the FOR UPDATE row lock) without a generated client.
jest.mock('@prisma/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
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

  it('rejects approving an already-rejected payment (credit was already reversed)', async () => {
    const { POST } = await import('./route')

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'rejected',
            amount: 100_000_000,
            userId: 'user-1',
            user: { subscriptionEnd: null, allowedActivities: [] },
          }),
        },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/approve',
      method: 'POST',
      json: async () => ({ months: 1 }),
    } as unknown as Request

    const res = await POST(req as any, { params: { id: 'payment-1' } })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('rejected')
  })

  it('consumes the payment ISK from the balance when approving (no double-credit)', async () => {
    const { POST } = await import('./route')

    const userUpdate = jest.fn().mockResolvedValue({ id: 'user-1' })
    const iskHistoryCreate = jest.fn().mockResolvedValue({})

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'pending',
            amount: 100_000_000,
            userId: 'user-1',
            user: { subscriptionEnd: null, allowedActivities: [] },
          }),
          update: jest.fn().mockResolvedValue({ id: 'payment-1', status: 'approved' }),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue({ iskBalance: 100_000_000 }),
          update: userUpdate,
        },
        iskHistory: { create: iskHistoryCreate },
        securityEvent: { create: jest.fn().mockResolvedValue({}) },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/approve',
      method: 'POST',
      json: async () => ({ months: 1 }),
    } as unknown as Request

    const res: any = await POST(req as any, { params: { id: 'payment-1' } })

    expect(res.success).toBe(true)
    // The full 100M credited by the sync must be consumed on approval.
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iskBalance: { decrement: 100_000_000 } }),
      })
    )
    expect(iskHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: -100_000_000 }) })
    )
  })

  it('clamps the debit to the available balance (never goes negative)', async () => {
    const { POST } = await import('./route')

    const userUpdate = jest.fn().mockResolvedValue({ id: 'user-1' })

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        $executeRaw: jest.fn().mockResolvedValue(1),
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'pending',
            amount: 100_000_000,
            userId: 'user-1',
            user: { subscriptionEnd: null, allowedActivities: [] },
          }),
          update: jest.fn().mockResolvedValue({ id: 'payment-1', status: 'approved' }),
        },
        user: {
          // Balance already partially spent — only 40M left.
          findUnique: jest.fn().mockResolvedValue({ iskBalance: 40_000_000 }),
          update: userUpdate,
        },
        iskHistory: { create: jest.fn().mockResolvedValue({}) },
        securityEvent: { create: jest.fn().mockResolvedValue({}) },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/approve',
      method: 'POST',
      json: async () => ({ months: 1 }),
    } as unknown as Request

    await POST(req as any, { params: { id: 'payment-1' } })

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ iskBalance: { decrement: 40_000_000 } }),
      })
    )
  })
})
