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

jest.mock('@/lib/api-helpers', () => ({
  withAuth:
    (_opts: unknown, handler: any) =>
    async (req: Request, context: any) =>
      handler(req, { id: 'admin-user' }, context),
}))

describe('PUT /api/admin/payments/[id]/link', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('moves the credited iskBalance from the old user to the new user', async () => {
    const { PUT } = await import('./route')

    const userUpdate = jest.fn().mockResolvedValue({})
    const iskHistoryCreate = jest.fn().mockResolvedValue({})

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'pending',
            amount: 500,
            userId: 'old-user',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'pending',
            amount: 500,
            userId: 'new-user',
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ iskBalance: 500 }), update: userUpdate },
        iskHistory: { create: iskHistoryCreate },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/link',
      method: 'PUT',
      json: async () => ({ userId: 'new-user' }),
    } as unknown as Request

    await PUT(req as any, { params: { id: 'payment-1' } })

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'old-user' },
      data: { iskBalance: { decrement: 500 } },
    })
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'new-user' },
      data: { iskBalance: { increment: 500 } },
    })
    expect(iskHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'old-user', amount: -500, type: 'payment_relink_out' }),
    })
    expect(iskHistoryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'new-user', amount: 500, type: 'payment_relink_in' }),
    })
  })

  it('does not move iskBalance when the payment was already rejected', async () => {
    const { PUT } = await import('./route')

    const userUpdate = jest.fn().mockResolvedValue({})
    const iskHistoryCreate = jest.fn().mockResolvedValue({})

    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'rejected',
            amount: 500,
            userId: 'old-user',
          }),
          update: jest.fn().mockResolvedValue({
            id: 'payment-1',
            status: 'rejected',
            amount: 500,
            userId: 'new-user',
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ iskBalance: 500 }), update: userUpdate },
        iskHistory: { create: iskHistoryCreate },
      }
      return cb(tx)
    })

    const req = {
      url: 'http://localhost/api/admin/payments/payment-1/link',
      method: 'PUT',
      json: async () => ({ userId: 'new-user' }),
    } as unknown as Request

    await PUT(req as any, { params: { id: 'payment-1' } })

    expect(userUpdate).not.toHaveBeenCalled()
    expect(iskHistoryCreate).not.toHaveBeenCalled()
  })
})
