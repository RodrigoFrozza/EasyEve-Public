import { ingestMiningLootActivity } from '@/lib/analytics/mining-loot-intel-ingest'

const dimensionUpserts: Array<{ update?: { totalDurationMs?: { increment: bigint } } }> = []
const regionUpserts: Array<{
  create?: { totalEvents?: number }
  update?: { totalEvents?: { increment: number } }
}> = []

const mockTransaction = jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
  const tx = {
    miningLootAnalyticsIngestion: { findUnique: jest.fn(), create: jest.fn() },
    miningLootEventFact: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    miningLootDimensionRollup: {
      upsert: jest.fn().mockImplementation((args: { update?: { totalDurationMs?: { increment: bigint } } }) => {
        dimensionUpserts.push(args)
        return Promise.resolve({})
      }),
    },
    miningLootItemRollup: { upsert: jest.fn() },
    miningLootRegionRollup: {
      upsert: jest.fn().mockImplementation((args: typeof regionUpserts[number]) => {
        regionUpserts.push(args)
        return Promise.resolve({})
      }),
    },
  }
  await fn(tx)
  return tx
})

const mockActivityFindUnique = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    miningLootAnalyticsIngestion: {
      findUnique: jest.fn(),
    },
    activity: { findUnique: (...args: unknown[]) => mockActivityFindUnique(...args) },
    $transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { prisma } from '@/lib/prisma'

describe('ingestMiningLootActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    dimensionUpserts.length = 0
    regionUpserts.length = 0
    ;(prisma.miningLootAnalyticsIngestion.findUnique as jest.Mock).mockResolvedValue(null)
  })

  const baseActivity = {
    id: 'mining-1',
    userId: 'user-1',
    type: 'mining',
    status: 'completed',
    region: null,
    space: 'Highsec',
    startTime: new Date('2026-01-01T10:00:00Z'),
    endTime: new Date('2026-01-01T12:00:00Z'),
    accumulatedPausedTime: 3_600_000,
    data: {
      miningType: 'Ore',
      logs: [
        {
          date: '2026-01-01T11:00:00Z',
          oreName: 'Veldspar',
          typeId: 1230,
          quantity: 100,
          estimatedValue: 5000,
        },
      ],
    },
  }

  it('uses pause-aware session duration for dimension rollups', async () => {
    const result = await ingestMiningLootActivity(baseActivity)
    expect(result).toEqual({ ok: true, eventsIngested: 1 })

    const durationIncrements = dimensionUpserts
      .map((call) => call.update?.totalDurationMs?.increment)
      .filter((value): value is bigint => value !== undefined)

    expect(durationIncrements.length).toBeGreaterThan(0)
    expect(durationIncrements.every((value) => value === BigInt(3_600_000))).toBe(true)
  })

  it('counts each log per region in region rollups', async () => {
    const activity = {
      ...baseActivity,
      data: {
        miningType: 'Ore',
        logs: [
          {
            date: '2026-01-01T11:00:00Z',
            oreName: 'Veldspar',
            typeId: 1230,
            quantity: 100,
            estimatedValue: 5000,
            regionId: 10000002,
            regionName: 'The Forge',
          },
          {
            date: '2026-01-01T11:30:00Z',
            oreName: 'Scordite',
            typeId: 1228,
            quantity: 50,
            estimatedValue: 3000,
            regionId: 10000002,
            regionName: 'The Forge',
          },
          {
            date: '2026-01-01T12:00:00Z',
            oreName: 'Plagioclase',
            typeId: 18,
            quantity: 80,
            estimatedValue: 4000,
            regionId: 10000043,
            regionName: 'Domain',
          },
        ],
      },
    }

    const result = await ingestMiningLootActivity(activity)
    expect(result).toEqual({ ok: true, eventsIngested: 3 })

    const eventIncrements = regionUpserts
      .map((call) => call.create?.totalEvents ?? call.update?.totalEvents?.increment)
      .filter((value): value is number => value !== undefined)

    expect(eventIncrements).toEqual([2, 1, 0, 0])
  })

  it('re-ingests when reconcile is true', async () => {
    ;(prisma.miningLootAnalyticsIngestion.findUnique as jest.Mock).mockResolvedValue({
      activityId: 'mining-1',
    })

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        miningLootAnalyticsIngestion: {
          findUnique: jest.fn().mockResolvedValue({
            activityId: 'mining-1',
            ingestedDurationMs: BigInt(3_600_000),
            ingestedSpaceType: 'Highsec',
            ingestedMiningCategory: 'Ore',
          }),
          create: jest.fn(),
          delete: jest.fn(),
        },
        miningLootEventFact: {
          create: jest.fn().mockResolvedValue({ id: 'event-2' }),
          findMany: jest.fn().mockResolvedValue([
            {
              miningCategory: 'Ore',
              spaceType: 'Highsec',
              eventValue: 5000,
              regionId: null,
              regionName: null,
              items: [{ typeId: 1230, quantity: 100, totalValue: 5000 }],
            },
          ]),
          deleteMany: jest.fn(),
        },
        miningLootDimensionRollup: {
          upsert: jest.fn().mockImplementation((args: { update?: { totalDurationMs?: { increment: bigint } } }) => {
            dimensionUpserts.push(args)
            return Promise.resolve({})
          }),
          findUnique: jest.fn().mockResolvedValue({
            totalEvents: 1,
            totalValue: 5000,
            totalDurationMs: BigInt(3_600_000),
          }),
          update: jest.fn(),
        },
        miningLootItemRollup: {
          upsert: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            eventsWithItem: 1,
            totalQuantity: 100,
            totalValue: 5000,
          }),
          update: jest.fn(),
        },
        miningLootRegionRollup: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      }
      await fn(tx)
      return tx
    })

    const result = await ingestMiningLootActivity(baseActivity, { reconcile: true })
    expect(result).toEqual({ ok: true, eventsIngested: 1 })
  })
})

describe('retractMiningLootForActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no-ops when the activity no longer exists', async () => {
    mockActivityFindUnique.mockResolvedValue(null)
    const { retractMiningLootForActivity } = await import('./mining-loot-intel-ingest')

    await expect(retractMiningLootForActivity('missing')).resolves.toBeUndefined()
  })
})
