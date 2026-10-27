class MockResponse {
  static json(body: any, init?: any) {
    return new MockResponse(body, init)
  }
  headers: any
  constructor(public body: any, public init?: any) {
    const headersMap = new Map<string, string>()
    if (init?.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        headersMap.set(k.toLowerCase(), String(v))
      })
    }
    this.headers = {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
      set: (name: string, value: string) => headersMap.set(name.toLowerCase(), value),
      has: (name: string) => headersMap.has(name.toLowerCase()),
      getSetCookie: () => [],
      forEach: (cb: any) => headersMap.forEach((v, k) => cb(v, k)),
    }
  }
  async json() {
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
  }
  get status() {
    return this.init?.status ?? 200
  }
}

class MockRequest {
  url: string
  headers: any
  constructor(input: any, public init?: any) {
    this.url = typeof input === 'string' ? input : input?.url ?? ''
    const headersMap = new Map<string, string>()
    if (init?.headers) {
      Object.entries(init.headers).forEach(([k, v]) => {
        headersMap.set(k.toLowerCase(), String(v))
      })
    }
    this.headers = {
      get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
      set: (name: string, value: string) => headersMap.set(name.toLowerCase(), value),
      has: (name: string) => headersMap.has(name.toLowerCase()),
      forEach: (cb: any) => headersMap.forEach((v, k) => cb(v, k)),
    }
  }
  async json() {
    return this.init?.body ? JSON.parse(this.init.body) : {}
  }
}

if (typeof global.Response === 'undefined') {
  global.Response = MockResponse as any
}
if (typeof global.Request === 'undefined') {
  global.Request = MockRequest as any
}

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const mockPrisma = {
  userProfile: {
    upsert: jest.fn(),
  },
  piPlanetConfig: {
    upsert: jest.fn(),
  },
}

const mockLoadPiUserConfig = jest.fn()
const mockGetCurrentUser = jest.fn()
const mockDeleteCacheByPrefix = jest.fn()
const mockAssertPlatformModuleActive = jest.fn()

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
  getCurrentUser: mockGetCurrentUser,
}))

jest.mock('@/lib/cache', () => ({
  deleteCacheByPrefix: mockDeleteCacheByPrefix,
}))

jest.mock('@/lib/pi/pi-config-store', () => ({
  loadPiUserConfig: mockLoadPiUserConfig,
}))

jest.mock('@/lib/admin/platform-module-gate', () => ({
  assertPlatformModuleActive: (...args: unknown[]) => mockAssertPlatformModuleActive(...args),
}))

describe('GET /api/pi/config', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAssertPlatformModuleActive.mockResolvedValue(undefined)
  })

  it('returns 401 if user not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)
    const { GET } = await import('./route')

    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('returns user config successfully', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123' })
    const configData = {
      configs: [],
      preferences: { exportTaxRate: 0.1, pricingMode: 'mid_price' },
    }
    mockLoadPiUserConfig.mockResolvedValue(configData)

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    if (res.status !== 200) console.log("GET ERROR:", data)

    expect(res.status).toBe(200)
    expect(data).toEqual(configData)
  })

  it('returns 403 when PI module is disabled', async () => {
    const { AppError } = await import('@/lib/app-error')
    const { ErrorCodes } = await import('@/lib/error-codes')
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123' })
    mockAssertPlatformModuleActive.mockRejectedValue(
      new AppError(ErrorCodes.API_FORBIDDEN, 'Planetary Industry is currently disabled by administrators.', 403)
    )

    const { GET } = await import('./route')
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.error).toContain('disabled by administrators')
    expect(mockLoadPiUserConfig).not.toHaveBeenCalled()
  })
})

describe('PUT /api/pi/config', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123' })
    mockAssertPlatformModuleActive.mockResolvedValue(undefined)
  })

  it('validates exportTaxRate boundaries', async () => {
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        preferences: { exportTaxRate: 1.5, pricingMode: 'mid_price' },
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('exportTaxRate must be between 0 and 1')
  })

  it('validates pricingMode values', async () => {
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        preferences: { exportTaxRate: 0.1, pricingMode: 'invalid_mode' },
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('Invalid pricingMode')
  })

  it('validates visitCadenceHrs boundaries', async () => {
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        preferences: { visitCadenceHrs: 0 },
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('visitCadenceHrs must be an integer between 1 and 720')
  })

  it('updates preferences successfully', async () => {
    mockPrisma.userProfile.upsert.mockResolvedValue({})
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        preferences: { exportTaxRate: 0.05, pricingMode: 'mid_price', visitCadenceHrs: 48 },
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    if (res.status !== 200) console.log("PUT PREFERENCES ERROR:", data)

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(mockPrisma.userProfile.upsert).toHaveBeenCalled()
    expect(mockPrisma.userProfile.upsert.mock.calls[0][0].update).toMatchObject({
      piVisitCadenceHrs: 48,
    })
    expect(mockDeleteCacheByPrefix).toHaveBeenCalled()
  })

  it('validates planetId for planet config updates', async () => {
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        surplusForSale: false,
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('planetId is required')
  })

  it('updates planet config successfully', async () => {
    mockPrisma.piPlanetConfig.upsert.mockResolvedValue({
      planetId: 456,
      surplusForSale: false,
    })
    const { PUT } = await import('./route')
    const req = {
      json: async () => ({
        planetId: 456,
        surplusForSale: false,
      }),
    } as any

    const res = await PUT(req)
    const data = await res.json()

    if (res.status !== 200) console.log("PUT PLANET ERROR:", data)

    expect(res.status).toBe(200)
    expect(data.planetId).toBe(456)
    expect(data.surplusForSale).toBe(false)
    expect(mockPrisma.piPlanetConfig.upsert).toHaveBeenCalled()
    expect(mockDeleteCacheByPrefix).toHaveBeenCalled()
  })
})
