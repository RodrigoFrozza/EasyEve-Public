import {
  resolveJitaBuySellFromOrderSets,
  fillFromOrders,
  getRegionalMarketDepth,
} from './market-prices'
import { JITA_44_STATION_ID } from '@/lib/constants/market'

const mockSdeCacheFindMany = jest.fn()
const mockSdeCacheUpsert = jest.fn()
const mockEsiClientGet = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sdeCache: {
      findMany: (...args: unknown[]) => mockSdeCacheFindMany(...args),
      upsert: (...args: unknown[]) => mockSdeCacheUpsert(...args),
    },
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

describe('getJitaPricesPersistent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEsiClientGet.mockResolvedValue({ data: [], headers: {} })
  })

  it('keeps the last known price instead of persisting a fresh 0/0 when the order book is empty', async () => {
    const { getJitaPricesPersistent } = await import('./market-prices')
    const staleButKnown = { buy: 500, sell: 600, updatedAt: 0 }

    mockSdeCacheFindMany.mockResolvedValue([
      { key: 'price_jita_hub_12345', value: staleButKnown },
    ])

    const result = await getJitaPricesPersistent([12345])

    expect(result[12345]).toEqual(staleButKnown)
    expect(mockSdeCacheUpsert).not.toHaveBeenCalled()
  })

  it('persists a fresh 0/0 when there is no prior cached price at all', async () => {
    const { getJitaPricesPersistent } = await import('./market-prices')
    mockSdeCacheFindMany.mockResolvedValue([])

    const result = await getJitaPricesPersistent([54321])

    expect(result[54321]).toEqual(expect.objectContaining({ buy: 0, sell: 0 }))
    expect(mockSdeCacheUpsert).toHaveBeenCalled()
  })
})

describe('getRegionalMarketDepth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retries a transient page failure instead of falling back to an empty book', async () => {
    mockSdeCacheFindMany.mockResolvedValue([]) // nothing cached yet
    // Buy and sell fetch concurrently (Promise.all), so drive the mock off the
    // request's own order_type instead of call sequence to keep this
    // deterministic regardless of interleaving.
    let buyAttempts = 0
    mockEsiClientGet.mockImplementation(
      async (_url: string, config: { params?: { order_type?: string } }) => {
        if (config?.params?.order_type === 'buy') {
          buyAttempts++
          if (buyAttempts === 1) throw { response: { status: 500 } } // transient blip
          return { data: [], headers: {} }
        }
        return {
          data: [{ price: 42, location_id: 1, volume_remain: 10 }],
          headers: {},
        }
      }
    )

    const result = await getRegionalMarketDepth(10000002, [100])

    expect(buyAttempts).toBe(2) // 1 failure + 1 retry, never gave up early
    expect(result[100]!.sell[0]!.price).toBe(42)
  })

  it('serves the last known depth when every retry is exhausted', async () => {
    const staleDepth = {
      sell: [{ price: 99, volume: 5, locationId: 1 }],
      buy: [],
      updatedAt: Date.now() - 60 * 60 * 1000, // 1h old — expired TTL, but well within the fallback bound
    }
    mockSdeCacheFindMany.mockResolvedValue([
      { key: 'pi_market_depth_10000002_100', value: staleDepth },
    ])
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const result = await getRegionalMarketDepth(10000002, [100])

    expect(result[100]).toEqual(staleDepth)
    expect(mockSdeCacheUpsert).not.toHaveBeenCalled()
  })

  it('drops a cache fallback far older than the max fallback age instead of serving it forever', async () => {
    const ancientDepth = {
      sell: [{ price: 99, volume: 5, locationId: 1 }],
      buy: [],
      updatedAt: 0, // effectively epoch — live fetches have been failing for a very long time
    }
    mockSdeCacheFindMany.mockResolvedValue([
      { key: 'pi_market_depth_10000002_100', value: ancientDepth },
    ])
    mockEsiClientGet.mockRejectedValue({ response: { status: 500 } })

    const result = await getRegionalMarketDepth(10000002, [100])

    expect(result[100]).toEqual({ sell: [], buy: [], updatedAt: 0 })
  })
})

describe('resolveJitaBuySellFromOrderSets', () => {
  it('uses max buy and min sell at Jita 4-4 when hub orders exist', () => {
    const buyOrders = [
      { price: 100, location_id: JITA_44_STATION_ID },
      { price: 120, location_id: JITA_44_STATION_ID },
      { price: 200, location_id: 99999999 },
    ]
    const sellOrders = [
      { price: 150, location_id: JITA_44_STATION_ID },
      { price: 130, location_id: JITA_44_STATION_ID },
      { price: 50, location_id: 99999999 },
    ]

    expect(resolveJitaBuySellFromOrderSets(buyOrders, sellOrders)).toEqual({
      buy: 120,
      sell: 130,
    })
  })

  it('falls back to region-wide orders when hub has no orders', () => {
    const buyOrders = [{ price: 200, location_id: 99999999 }]
    const sellOrders = [{ price: 50, location_id: 99999999 }]

    expect(resolveJitaBuySellFromOrderSets(buyOrders, sellOrders)).toEqual({
      buy: 200,
      sell: 50,
    })
  })

  it('returns zero when no orders', () => {
    expect(resolveJitaBuySellFromOrderSets([], [])).toEqual({ buy: 0, sell: 0 })
  })
})

describe('fillFromOrders', () => {
  it('fills entirely from the cheapest level when it has enough volume', () => {
    const fill = fillFromOrders([{ price: 100, volume: 500 }, { price: 120, volume: 500 }], 300)
    expect(fill.avgUnitPrice).toBe(100)
    expect(fill.filledQty).toBe(300)
    expect(fill.sufficient).toBe(true)
    expect(fill.bestUnitPrice).toBe(100)
  })

  it('computes a volume-weighted average across multiple levels', () => {
    // 200 @ 100 + 100 @ 130 = 26,000 for 300 units => 86.67 avg
    const fill = fillFromOrders(
      [{ price: 100, volume: 200 }, { price: 130, volume: 400 }],
      300
    )
    expect(fill.filledQty).toBe(300)
    expect(fill.avgUnitPrice).toBeCloseTo((200 * 100 + 100 * 130) / 300, 6)
    expect(fill.sufficient).toBe(true)
  })

  it('flags insufficient depth when the book cannot cover the demand (the 210-units case)', () => {
    const fill = fillFromOrders([{ price: 91000, volume: 210 }], 5000)
    expect(fill.filledQty).toBe(210)
    expect(fill.sufficient).toBe(false)
    expect(fill.avgUnitPrice).toBe(91000)
  })

  it('handles zero demand and empty books', () => {
    expect(fillFromOrders([{ price: 100, volume: 10 }], 0).sufficient).toBe(true)
    const empty = fillFromOrders([], 100)
    expect(empty.sufficient).toBe(false)
    expect(empty.filledQty).toBe(0)
    expect(empty.avgUnitPrice).toBe(0)
  })
})
