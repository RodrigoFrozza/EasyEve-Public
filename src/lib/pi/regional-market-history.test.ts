const mockFindUnique = jest.fn()
const mockUpsert = jest.fn()
const mockEsiClientGet = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sdeCache: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const REGION_ID = 10000002
const TYPE_ID = 2073

describe('getRegionalMarketHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpsert.mockResolvedValue({})
  })

  it('fetches from ESI on a cache miss and caches the result', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockEsiClientGet.mockResolvedValue({
      data: [
        { date: '2026-07-17', average: 10, highest: 12, lowest: 9, order_count: 5, volume: 1000 },
      ],
    })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).not.toBeNull()
    expect(result!.stale).toBe(false)
    expect(result!.points).toHaveLength(1)
    expect(result!.points[0]).toMatchObject({ date: '2026-07-17', average: 10, volume: 1000 })
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('serves a fresh cache entry without calling ESI', async () => {
    mockFindUnique.mockResolvedValue({
      value: { points: [{ date: '2026-07-17', average: 10, highest: 12, lowest: 9, orderCount: 5, volume: 1000 }], updatedAt: Date.now() },
    })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).not.toBeNull()
    expect(result!.stale).toBe(false)
    expect(mockEsiClientGet).not.toHaveBeenCalled()
  })

  it('refetches once the cache entry is older than the TTL', async () => {
    const twelveHoursAgo = Date.now() - 13 * 60 * 60 * 1000
    mockFindUnique.mockResolvedValue({
      value: { points: [{ date: 'old', average: 1, highest: 1, lowest: 1, orderCount: 1, volume: 1 }], updatedAt: twelveHoursAgo },
    })
    mockEsiClientGet.mockResolvedValue({
      data: [{ date: '2026-07-18', average: 20, highest: 22, lowest: 19, order_count: 8, volume: 2000 }],
    })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(mockEsiClientGet).toHaveBeenCalledTimes(1)
    expect(result!.points[0].date).toBe('2026-07-18')
  })

  it('maps a 404 (never traded in this region) to a real empty result, not null', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockEsiClientGet.mockRejectedValue({ response: { status: 404 } })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).not.toBeNull()
    expect(result!.points).toEqual([])
    expect(result!.stale).toBe(false)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('falls back to expired cache on a non-404 ESI error, marked stale', async () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
    mockFindUnique.mockResolvedValue({
      value: { points: [{ date: 'old', average: 1, highest: 1, lowest: 1, orderCount: 1, volume: 1 }], updatedAt: twoDaysAgo },
    })
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).not.toBeNull()
    expect(result!.stale).toBe(true)
    expect(result!.points[0].date).toBe('old')
  })

  it('returns null when ESI fails and the cache is older than the max fallback age', async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    mockFindUnique.mockResolvedValue({
      value: { points: [{ date: 'ancient', average: 1, highest: 1, lowest: 1, orderCount: 1, volume: 1 }], updatedAt: eightDaysAgo },
    })
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).toBeNull()
  })

  it('returns null when ESI fails and there is no cache at all', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const { getRegionalMarketHistory } = await import('./regional-market-history')
    const result = await getRegionalMarketHistory(REGION_ID, TYPE_ID)

    expect(result).toBeNull()
  })
})
