const mockFindMany = jest.fn()
const mockFindUnique = jest.fn()
const mockUpsert = jest.fn()
const mockEsiClientGet = jest.fn()
const mockGetValidAccessToken = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sdeCache: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

describe('getStructureMarketDepth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindMany.mockResolvedValue([]) // no cached depth
    mockUpsert.mockResolvedValue({})
  })

  it('tries the last-known-good character first instead of walking the whole roster', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    // Structure access cache says character 3 worked last time.
    mockFindUnique.mockResolvedValue({
      value: { characterId: 3, cachedAt: Date.now() },
    })
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockEsiClientGet.mockResolvedValue({
      data: [{ type_id: 100, is_buy_order: false, price: 50, volume_remain: 10 }],
      headers: {},
    })

    await getStructureMarketDepth('struct-1', [1, 2, 3, 4, 5], [100])

    // Only ONE character's token was resolved (the cached one) — no roster walk.
    expect(mockGetValidAccessToken).toHaveBeenCalledTimes(1)
    expect(mockGetValidAccessToken).toHaveBeenCalledWith(3)
  })

  it('falls back to walking the roster when no character is cached, then remembers the winner', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    mockFindUnique.mockResolvedValue(null) // nothing cached yet
    mockGetValidAccessToken.mockImplementation(async (characterId: number) =>
      characterId === 2 ? { accessToken: 'tok' } : { accessToken: null }
    )
    mockEsiClientGet.mockResolvedValue({
      data: [{ type_id: 100, is_buy_order: false, price: 50, volume_remain: 10 }],
      headers: {},
    })

    await getStructureMarketDepth('struct-1', [1, 2, 3], [100])

    expect(mockGetValidAccessToken).toHaveBeenCalledWith(1)
    expect(mockGetValidAccessToken).toHaveBeenCalledWith(2)
    // Persisted character 2 as the new known-good access character.
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'pi_struct_access_char_struct-1' },
        create: expect.objectContaining({
          value: expect.objectContaining({ characterId: 2 }),
        }),
      })
    )
  })

  it('re-walks the roster when the cached character has lost access', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    mockFindUnique.mockResolvedValue({ value: { characterId: 1, cachedAt: Date.now() } })
    mockGetValidAccessToken.mockImplementation(async (characterId: number) =>
      characterId === 5 ? { accessToken: 'tok' } : { accessToken: null }
    )
    mockEsiClientGet.mockResolvedValue({
      data: [{ type_id: 100, is_buy_order: false, price: 50, volume_remain: 10 }],
      headers: {},
    })

    const result = await getStructureMarketDepth('struct-1', [1, 2, 5], [100])

    expect(mockGetValidAccessToken).toHaveBeenCalledWith(1) // tried cached first, failed
    expect(mockGetValidAccessToken).toHaveBeenCalledWith(5) // found via roster walk
    expect(result[100]!.sell[0]!.price).toBe(50)
  })

  it('retries a transient page failure instead of discarding the whole fetch', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    mockFindUnique.mockResolvedValue({ value: { characterId: 1, cachedAt: Date.now() } })
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockEsiClientGet
      .mockRejectedValueOnce({ response: { status: 500 } }) // transient blip
      .mockResolvedValueOnce({
        data: [{ type_id: 100, is_buy_order: false, price: 42, volume_remain: 5 }],
        headers: {},
      })

    const result = await getStructureMarketDepth('struct-1', [1], [100])

    expect(mockEsiClientGet).toHaveBeenCalledTimes(2)
    expect(result[100]!.sell[0]!.price).toBe(42)
  })

  it('does not retry a non-transient error (e.g. 403 lost access)', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    mockFindUnique.mockResolvedValue(null)
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockEsiClientGet.mockRejectedValue({ response: { status: 403 } })

    const result = await getStructureMarketDepth('struct-1', [1], [100])

    // One attempt for the only character, no retries wasted on a 403.
    expect(mockEsiClientGet).toHaveBeenCalledTimes(1)
    expect(result).toEqual({})
  })

  it('serves expired cache when the live fetch fails but the cache is still recent', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    const recentDepth = {
      sell: [{ price: 99, volume: 5, locationId: 1 }],
      buy: [],
      updatedAt: Date.now() - 60 * 60 * 1000, // 1h old — past TTL, well within fallback bound
    }
    mockFindMany.mockResolvedValue([{ key: 'pi_struct_depth_struct-1_100', value: recentDepth }])
    mockFindUnique.mockResolvedValue(null)
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const result = await getStructureMarketDepth('struct-1', [1], [100])

    expect(result[100]).toEqual(recentDepth)
  })

  it('drops a cache fallback far older than the max fallback age instead of serving it forever', async () => {
    const { getStructureMarketDepth } = await import('./structure-market')

    const ancientDepth = {
      sell: [{ price: 99, volume: 5, locationId: 1 }],
      buy: [],
      updatedAt: 0, // live fetches have effectively never succeeded within the fallback window
    }
    mockFindMany.mockResolvedValue([{ key: 'pi_struct_depth_struct-1_100', value: ancientDepth }])
    mockFindUnique.mockResolvedValue(null)
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'tok' })
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const result = await getStructureMarketDepth('struct-1', [1], [100])

    expect(result[100]).toBeUndefined()
  })
})
