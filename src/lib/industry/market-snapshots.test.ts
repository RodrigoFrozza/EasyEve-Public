const mockUpsert = jest.fn()
const mockTransaction = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    stationMarketSnapshot: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

import type { StationOrderAggregate } from '@/lib/industry/deficit-scan'

function makeAggregate(typeId: number): StationOrderAggregate {
  return { typeId, sellVolume: 10, buyVolume: 5, bestSell: 100, bestBuy: 90 }
}

describe('persistStationSnapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpsert.mockResolvedValue({})
    // Mirrors prisma.$transaction([...]) — resolve to the settled results.
    mockTransaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it('writes one upsert row per aggregate and returns the count', async () => {
    const { persistStationSnapshots } = await import('./market-snapshots')

    const aggregates = new Map<number, StationOrderAggregate>([
      [1, makeAggregate(1)],
      [2, makeAggregate(2)],
      [3, makeAggregate(3)],
    ])

    const written = await persistStationSnapshots('struct-1', aggregates)

    expect(written).toBe(3)
    expect(mockUpsert).toHaveBeenCalledTimes(3)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { structureId_typeId_day: expect.objectContaining({ structureId: 'struct-1', typeId: 1 }) },
        create: expect.objectContaining({
          structureId: 'struct-1',
          typeId: 1,
          sellVolume: 10,
          buyVolume: 5,
          bestSell: 100,
          bestBuy: 90,
        }),
      })
    )
  })

  it('chunks writes into transactions of at most 100', async () => {
    const { persistStationSnapshots } = await import('./market-snapshots')

    const aggregates = new Map<number, StationOrderAggregate>()
    for (let i = 0; i < 250; i++) aggregates.set(i, makeAggregate(i))

    const written = await persistStationSnapshots('struct-1', aggregates)

    expect(written).toBe(250)
    expect(mockTransaction).toHaveBeenCalledTimes(3)
    const sizes = mockTransaction.mock.calls.map(([ops]) => (ops as unknown[]).length)
    expect(sizes).toEqual([100, 100, 50])
  })

  it('normalizes day to UTC midnight regardless of current time', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-16T23:47:12.000Z'))
    try {
      const { persistStationSnapshots } = await import('./market-snapshots')

      const aggregates = new Map<number, StationOrderAggregate>([[1, makeAggregate(1)]])
      await persistStationSnapshots('struct-1', aggregates)

      const call = mockUpsert.mock.calls[0][0]
      const day: Date = call.create.day
      expect(day.toISOString()).toBe('2026-07-16T00:00:00.000Z')
    } finally {
      jest.useRealTimers()
    }
  })

  it('writes nothing for an empty aggregate map', async () => {
    const { persistStationSnapshots } = await import('./market-snapshots')

    const written = await persistStationSnapshots('struct-1', new Map())

    expect(written).toBe(0)
    expect(mockUpsert).not.toHaveBeenCalled()
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})
