import {
  ingestSalvagingActivity,
  retractSalvagingForActivity,
} from '@/lib/analytics/salvaging-intel-ingest'

const upsertCalls: Array<{ update?: { totalDurationMs?: { increment: bigint } } }> = []

const mockTransaction = jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
  const tx = {
    salvageAnalyticsIngestion: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    salvageBatchFact: {
      create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn(),
    },
    salvageFactionRollup: {
      upsert: jest.fn().mockImplementation((args: { update?: { totalDurationMs?: { increment: bigint } } }) => {
        upsertCalls.push(args)
        return Promise.resolve({})
      }),
      findUnique: jest.fn().mockResolvedValue({
        totalBatches: 1,
        totalValue: 100,
        totalDurationMs: BigInt(7_200_000),
      }),
      update: jest.fn(),
    },
    salvageItemRollup: {
      upsert: jest.fn(),
      findUnique: jest.fn().mockResolvedValue({
        batchesWithItem: 1,
        totalQuantity: 2,
        totalValue: 100,
      }),
      update: jest.fn(),
    },
  }
  await fn(tx)
  return tx
})

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findUnique: jest.fn(),
    },
    salvageAnalyticsIngestion: {
      findUnique: jest.fn(),
    },
    $transaction: (fn: (tx: unknown) => Promise<void>) => mockTransaction(fn),
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { prisma } from '@/lib/prisma'

describe('ingestSalvagingActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    upsertCalls.length = 0
    ;(prisma.salvageAnalyticsIngestion.findUnique as jest.Mock).mockResolvedValue(null)
  })

  const baseActivity = {
    id: 'act-1',
    userId: 'user-1',
    type: 'salvaging',
    status: 'completed',
    region: null,
    space: 'Nullsec',
    startTime: new Date('2026-01-01T10:00:00Z'),
    endTime: new Date('2026-01-01T12:00:00Z'),
    data: {
      npcFaction: 'Angel Cartel',
      totalLootValue: 100,
      logs: [
        {
          type: 'salvage',
          spaceType: 'Nullsec',
          value: 100,
          date: '2026-01-01T11:00:00Z',
          items: [{ name: 'Item A', quantity: 2, typeId: 1, price: 50, total: 100 }],
        },
      ],
    },
  }

  it('rejects non-salvaging activities', async () => {
    const result = await ingestSalvagingActivity({ ...baseActivity, type: 'ratting' })
    expect(result).toEqual({ ok: false, reason: 'not_salvaging' })
  })

  it('skips when already ingested', async () => {
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        salvageAnalyticsIngestion: {
          findUnique: jest.fn().mockResolvedValue({ activityId: 'act-1' }),
          create: jest.fn(),
          deleteMany: jest.fn(),
        },
        salvageBatchFact: {
          create: jest.fn(),
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        salvageFactionRollup: { upsert: jest.fn(), update: jest.fn() },
        salvageItemRollup: { upsert: jest.fn(), update: jest.fn() },
      }
      await fn(tx)
      return tx
    })

    const result = await ingestSalvagingActivity(baseActivity)
    expect(result).toEqual({ ok: false, reason: 'already_ingested' })
  })

  it('skips when npc faction is missing', async () => {
    const result = await ingestSalvagingActivity({
      ...baseActivity,
      data: { logs: baseActivity.data.logs },
    })
    expect(result).toEqual({ ok: false, reason: 'no_faction' })
  })

  it('ingests loot-auto container logs', async () => {
    const result = await ingestSalvagingActivity({
      ...baseActivity,
      data: {
        npcFaction: 'Angel Cartel',
        logs: [
          {
            type: 'loot-auto',
            spaceType: 'Nullsec',
            value: 50,
            date: '2026-01-01T11:00:00Z',
            items: [{ name: 'Auto Item', quantity: 1, typeId: 2, price: 50, total: 50 }],
          },
        ],
      },
    })
    expect(result).toEqual({ ok: true, batchesIngested: 1 })
  })

  it('uses pause-aware session duration for faction rollups', async () => {
    await ingestSalvagingActivity({
      ...baseActivity,
      accumulatedPausedTime: 3_600_000,
    })

    const durationIncrements = upsertCalls
      .map((call) => call.update?.totalDurationMs?.increment)
      .filter((value): value is bigint => value !== undefined)

    expect(durationIncrements.length).toBeGreaterThan(0)
    expect(durationIncrements.every((value) => value === BigInt(3_600_000))).toBe(true)
  })

  it('re-ingests when reconcile is true', async () => {
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        salvageAnalyticsIngestion: {
          findUnique: jest.fn().mockResolvedValue({
            activityId: 'act-1',
            ingestedDurationMs: BigInt(7_200_000),
            ingestedNpcFaction: 'Angel Cartel',
          }),
          create: jest.fn(),
          delete: jest.fn(),
          deleteMany: jest.fn(),
        },
        salvageBatchFact: {
          create: jest.fn().mockResolvedValue({ id: 'batch-2' }),
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'batch-1',
              npcFaction: 'Angel Cartel',
              spaceType: 'Nullsec',
              batchValue: 100,
              items: [
                {
                  typeId: 1,
                  quantity: 2,
                  totalValue: 100,
                },
              ],
            },
          ]),
          deleteMany: jest.fn(),
        },
        salvageFactionRollup: {
          upsert: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            totalBatches: 1,
            totalValue: 100,
            totalDurationMs: BigInt(7_200_000),
          }),
          update: jest.fn(),
        },
        salvageItemRollup: {
          upsert: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            batchesWithItem: 1,
            totalQuantity: 2,
            totalValue: 100,
          }),
          update: jest.fn(),
        },
      }
      await fn(tx)
      return tx
    })

    const result = await ingestSalvagingActivity(baseActivity, { reconcile: true })
    expect(result).toEqual({ ok: true, batchesIngested: 1 })
  })
})

describe('retractSalvagingForActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no-ops when activity is missing', async () => {
    ;(prisma.activity.findUnique as jest.Mock).mockResolvedValue(null)
    await expect(retractSalvagingForActivity('missing')).resolves.toBeUndefined()
  })
})
