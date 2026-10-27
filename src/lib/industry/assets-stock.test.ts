const mockGetCharacterAssets = jest.fn()
const mockCacheFindUnique = jest.fn()
const mockCacheUpsert = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sdeCache: {
      findUnique: (...args: unknown[]) => mockCacheFindUnique(...args),
      upsert: (...args: unknown[]) => mockCacheUpsert(...args),
    },
  },
}))

jest.mock('@/lib/esi', () => ({
  getCharacterAssets: (...args: unknown[]) => mockGetCharacterAssets(...args),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

function asset(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    item_id: 1,
    type_id: 100,
    quantity: 1,
    location_id: 60003760,
    location_flag: 'Hangar',
    is_singleton: false,
    ...overrides,
  }
}

describe('getUserAssetStock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCacheFindUnique.mockResolvedValue(null)
    mockCacheUpsert.mockResolvedValue({})
  })

  it('sums quantities across characters and locations for the same type_id', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockGetCharacterAssets
      .mockResolvedValueOnce([
        asset({ type_id: 100, quantity: 5, location_id: 1 }),
        asset({ type_id: 100, quantity: 3, location_id: 2 }),
      ])
      .mockResolvedValueOnce([asset({ type_id: 100, quantity: 2, location_id: 3 })])

    const result = await getUserAssetStock('user-1', [1, 2])

    expect(result.stock[100]).toBe(10)
    expect(result.failed).toEqual([])
  })

  it('isolates a per-character failure — other characters still aggregate', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockGetCharacterAssets
      .mockRejectedValueOnce(new Error('esi down'))
      .mockResolvedValueOnce([asset({ type_id: 200, quantity: 4 })])

    const result = await getUserAssetStock('user-1', [1, 2])

    expect(result.failed).toEqual([1])
    expect(result.stock[200]).toBe(4)
  })

  it('serves the cache within TTL without calling ESI', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockCacheFindUnique.mockResolvedValue({
      value: { stock: { 100: 42 }, fetchedAt: Date.now() - 1000 },
    })

    const result = await getUserAssetStock('user-1', [1, 2])

    expect(mockGetCharacterAssets).not.toHaveBeenCalled()
    expect(result.stock).toEqual({ 100: 42 })
  })

  it('total failure serves a stale cache younger than 30min, flagged stale', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockCacheFindUnique.mockResolvedValue({
      value: { stock: { 100: 7 }, fetchedAt: Date.now() - 10 * 60 * 1000 },
    })
    mockGetCharacterAssets.mockRejectedValue(new Error('esi down'))

    const result = await getUserAssetStock('user-1', [1, 2], { forceRefresh: true })

    expect(result.stale).toBe(true)
    expect(result.stock).toEqual({ 100: 7 })
    expect(result.failed).toEqual([1, 2])
  })

  it('total failure with no usable cache returns empty stock with all ids failed (not a throw)', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockCacheFindUnique.mockResolvedValue(null)
    mockGetCharacterAssets.mockRejectedValue(new Error('esi down'))

    const result = await getUserAssetStock('user-1', [1, 2], { forceRefresh: true })

    expect(result.stock).toEqual({})
    expect(result.failed).toEqual([1, 2])
    expect(result.stale).toBeUndefined()
  })

  it('ignores entries with missing type_id or non-positive quantity', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    mockGetCharacterAssets.mockResolvedValueOnce([
      asset({ type_id: 100, quantity: 5 }),
      asset({ type_id: undefined, quantity: 5 }),
      asset({ type_id: 200, quantity: 0 }),
      asset({ type_id: 300, quantity: -2 }),
    ])

    const result = await getUserAssetStock('user-1', [1])

    expect(result.stock).toEqual({ 100: 5 })
  })

  it('characterIds.length === 0 returns empty stock without calling ESI', async () => {
    const { getUserAssetStock } = await import('./assets-stock')

    const result = await getUserAssetStock('user-1', [])

    expect(mockGetCharacterAssets).not.toHaveBeenCalled()
    expect(result).toMatchObject({ stock: {}, failed: [] })
  })
})
