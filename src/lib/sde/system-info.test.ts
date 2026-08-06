const mockEsiClient = {
  get: jest.fn(),
  post: jest.fn(),
}

jest.mock('@/lib/esi-client', () => ({
  esiClient: mockEsiClient,
  USER_AGENT: 'test-agent',
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {},
}))

// Each test uses a distinct system/constellation id — getSolarSystemInfo caches
// results in a module-level Map that persists across the `it()` blocks below.

describe('getSolarSystemInfo region_id resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('resolves region_id via the constellation hop — ESI systems responses have no region_id field', async () => {
    const { getSolarSystemInfo } = await import('./index')
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/universe/systems/30000142/')) {
        return Promise.resolve({
          data: {
            name: 'Jita',
            security_status: 0.9459,
            constellation_id: 20000020,
          },
        })
      }
      if (url.includes('/universe/constellations/20000020/')) {
        return Promise.resolve({ data: { region_id: 10000002 } })
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })

    const info = await getSolarSystemInfo(30000142)

    expect(info?.region_id).toBe(10000002)
    expect(info?.constellation_id).toBe(20000020)
  })

  it('returns undefined region_id (not a stale/wrong value) when the constellation lookup fails', async () => {
    const { getSolarSystemInfo } = await import('./index')
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/universe/systems/30000144/')) {
        return Promise.resolve({
          data: { name: 'Amarr', security_status: 1.0, constellation_id: 20000021 },
        })
      }
      if (url.includes('/universe/constellations/20000021/')) {
        return Promise.reject(new Error('ESI down'))
      }
      return Promise.reject(new Error(`unexpected url: ${url}`))
    })

    const info = await getSolarSystemInfo(30000144)

    expect(info?.region_id).toBeUndefined()
  })
})
