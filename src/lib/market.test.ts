const mockEsiClient = {
  get: jest.fn(),
  post: jest.fn(),
}

jest.mock('./esi-client', () => ({
  esiClient: mockEsiClient,
  USER_AGENT: 'test-agent',
}))

jest.mock('./server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Each test uses a distinct item name/typeId — market.ts caches prices in a
// module-level Map with a 6h TTL, and jest keeps that module instance alive
// across the `it()` blocks in this file, so reusing a name would leak state.

describe('getMarketAppraisalDetailed', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the Jita 4-4 buy price when the order book has depth', async () => {
    const { getMarketAppraisalDetailed } = await import('./market')
    mockEsiClient.post.mockResolvedValue({
      data: { inventory_types: [{ id: 34, name: 'Tritanium' }] },
    })
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/markets/10000002/orders/')) {
        return Promise.resolve({
          data: [{ price: 5, location_id: 60003760, is_buy_order: true, volume_remain: 100 }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    const result = await getMarketAppraisalDetailed(['Tritanium'])

    expect(result.tritanium).toEqual(
      expect.objectContaining({ unitPrice: 5, source: 'jita_buy' })
    )
  })

  it('falls back to the same global-average price getMarketAppraisal uses when Jita 4-4 has no orders', async () => {
    const { getMarketAppraisalDetailed } = await import('./market')
    mockEsiClient.post.mockResolvedValue({
      data: { inventory_types: [{ id: 35, name: 'Pyerite' }] },
    })
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/markets/10000002/orders/')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/markets/prices/')) {
        return Promise.resolve({ data: [{ type_id: 35, average_price: 7.5 }] })
      }
      return Promise.resolve({ data: [] })
    })

    const result = await getMarketAppraisalDetailed(['Pyerite'])

    expect(result.pyerite).toEqual(
      expect.objectContaining({ unitPrice: 7.5, source: 'global_average' })
    )
  })

  it('falls back to the already-resolved global-average price if only its own order-book fetch throws', async () => {
    // fetchMarketDataInternal (called first, to resolve the typeId) does its own
    // Jita order lookup and successfully falls back to the global average price,
    // caching it. getMarketAppraisalDetailed then does its own *separate*
    // order-book fetch for the buy/sell/liquidity breakdown — if that one fails,
    // it must still fall back to the price fetchMarketDataInternal already found,
    // instead of reporting not_found for an item that does have a price.
    const { getMarketAppraisalDetailed } = await import('./market')
    mockEsiClient.post.mockResolvedValue({
      data: { inventory_types: [{ id: 36, name: 'Mexallon' }] },
    })

    let ordersCallCount = 0
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/markets/10000002/orders/')) {
        ordersCallCount += 1
        if (ordersCallCount === 1) {
          return Promise.resolve({ data: [] })
        }
        return Promise.reject(new Error('ESI down'))
      }
      if (url.includes('/markets/prices/')) {
        return Promise.resolve({ data: [{ type_id: 36, average_price: 3 }] })
      }
      return Promise.resolve({ data: [] })
    })

    const result = await getMarketAppraisalDetailed(['Mexallon'])

    expect(result.mexallon).toEqual(
      expect.objectContaining({ unitPrice: 3, source: 'global_average' })
    )
  })

  it('fetches the global price list at most once even when several items need the fallback concurrently', async () => {
    const { getMarketAppraisalDetailed } = await import('./market')
    mockEsiClient.post.mockResolvedValue({
      data: {
        inventory_types: [
          { id: 3801, name: 'FallbackItemA' },
          { id: 3802, name: 'FallbackItemB' },
          { id: 3803, name: 'FallbackItemC' },
        ],
      },
    })

    let globalPriceFetchCount = 0
    mockEsiClient.get.mockImplementation((url: string) => {
      if (url.includes('/markets/10000002/orders/')) {
        return Promise.resolve({ data: [] })
      }
      if (url.includes('/markets/prices/')) {
        globalPriceFetchCount += 1
        return Promise.resolve({
          data: [
            { type_id: 3801, average_price: 10 },
            { type_id: 3802, average_price: 20 },
            { type_id: 3803, average_price: 30 },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })

    const result = await getMarketAppraisalDetailed([
      'FallbackItemA',
      'FallbackItemB',
      'FallbackItemC',
    ])

    expect(globalPriceFetchCount).toBe(1)
    expect(result.fallbackitema).toEqual(expect.objectContaining({ unitPrice: 10 }))
    expect(result.fallbackitemb).toEqual(expect.objectContaining({ unitPrice: 20 }))
    expect(result.fallbackitemc).toEqual(expect.objectContaining({ unitPrice: 30 }))
  })

  it('reports not_found when no price exists anywhere', async () => {
    const { getMarketAppraisalDetailed } = await import('./market')
    mockEsiClient.post.mockResolvedValue({
      data: { inventory_types: [{ id: 37, name: 'Isogen' }] },
    })
    mockEsiClient.get.mockResolvedValue({ data: [] })

    const result = await getMarketAppraisalDetailed(['Isogen'])

    expect(result.isogen).toEqual(
      expect.objectContaining({ unitPrice: 0, source: 'not_found' })
    )
  })
})
