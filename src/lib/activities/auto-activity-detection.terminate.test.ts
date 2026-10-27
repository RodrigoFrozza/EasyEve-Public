import type { Activity } from '@prisma/client'
import {
  ACTIVITY_STALE_PAUSE_THRESHOLD_MS,
  ACTIVITY_TERMINATION_THRESHOLD_MS,
} from './activity-automation-policy'
import { terminateStaleActivities } from './auto-activity-detection'

const mockSyncRattingWallet = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/activities/ratting-wallet-sync', () => ({
  syncRattingWalletForActivity: (...args: unknown[]) => mockSyncRattingWallet(...args),
}))

jest.mock('@/lib/esi/mining-ledger', () => ({
  refreshMiningDetectionCacheForActivity: jest.fn(),
}))

jest.mock('@/lib/analytics/loot-intel-dispatch', () => ({
  scheduleLootIntelIngest: jest.fn(),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

import { prisma } from '@/lib/prisma'
import { scheduleLootIntelIngest } from '@/lib/analytics/loot-intel-dispatch'

const findMany = prisma.activity.findMany as jest.Mock
const findUnique = prisma.activity.findUnique as jest.Mock
const update = prisma.activity.update as jest.Mock
const createNotification = prisma.notification.create as jest.Mock

function makeRattingActivity(overrides?: Partial<Activity>): Activity {
  const startTime = new Date('2024-01-01T10:00:00Z')
  const lastDataAt = '2024-01-01T11:00:00Z'
  return {
    id: 'ratting-1',
    userId: 'user-1',
    characterId: 123,
    type: 'ratting',
    status: 'active',
    startTime,
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    isDeleted: false,
    participants: [{ characterId: 123, characterName: 'Pilot' }],
    data: {
      automatedBounties: 50_000_000,
      lastDataAt,
      logs: [{ date: lastDataAt, type: 'bounty', amount: 50_000_000 }],
    },
    region: null,
    space: 'Null',
    typeId: null,
    createdAt: startTime,
    updatedAt: new Date(lastDataAt),
    ...overrides,
  } as Activity
}

describe('terminateStaleActivities ratting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    mockSyncRattingWallet.mockImplementation(async (activity: Activity) => activity)
    createNotification.mockResolvedValue({})
    update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...makeRattingActivity(),
      ...data,
      data: (data.data as Record<string, unknown>) || makeRattingActivity().data,
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('syncs wallet before pausing stale ratting activity', async () => {
    const activity = makeRattingActivity()
    const nowMs = Date.parse('2024-01-01T11:00:00Z') + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([activity]).mockResolvedValueOnce([])

    const count = await terminateStaleActivities()

    expect(mockSyncRattingWallet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ratting-1', type: 'ratting' })
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ratting-1' },
        data: expect.objectContaining({ isPaused: true }),
      })
    )
    expect(count).toBe(1)
  })

  it('skips pause when wallet sync reports fresh progress', async () => {
    const activity = makeRattingActivity()
    const nowMs = Date.parse('2024-01-01T11:00:00Z') + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000
    const freshLastDataAt = new Date(nowMs - 5 * 60_000).toISOString()

    mockSyncRattingWallet.mockResolvedValue({
      ...activity,
      data: {
        ...(activity.data as Record<string, unknown>),
        lastDataAt: freshLastDataAt,
        automatedBounties: 75_000_000,
      },
    })

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([activity]).mockResolvedValueOnce([])

    const count = await terminateStaleActivities()

    expect(mockSyncRattingWallet).toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('syncs wallet before completing ratting paused for 6h', async () => {
    const pausedAt = new Date('2024-01-01T10:00:00Z')
    const activity = makeRattingActivity({
      isPaused: true,
      pausedAt,
      data: {
        automatedBounties: 80_000_000,
        lastDataAt: pausedAt.toISOString(),
        logs: [{ date: pausedAt.toISOString(), type: 'bounty', amount: 80_000_000 }],
      },
    })
    const syncedData = {
      ...(activity.data as Record<string, unknown>),
      automatedBounties: 120_000_000,
      lastDataAt: '2024-01-01T16:30:00Z',
    }
    const nowMs = pausedAt.getTime() + ACTIVITY_TERMINATION_THRESHOLD_MS + 60_000

    mockSyncRattingWallet.mockResolvedValue({ ...activity, data: syncedData })
    update.mockResolvedValue({
      ...activity,
      status: 'completed',
      data: {
        ...syncedData,
        autoTerminatedAt: new Date(nowMs).toISOString(),
        terminationReason: 'auto_terminated_6h_pause',
      },
    })

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([activity])

    const count = await terminateStaleActivities()

    expect(mockSyncRattingWallet).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ratting-1', type: 'ratting' })
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ratting-1' },
        data: expect.objectContaining({
          status: 'completed',
          data: expect.objectContaining({
            automatedBounties: 120_000_000,
            terminationReason: 'auto_terminated_6h_pause',
          }),
        }),
      })
    )
    expect(scheduleLootIntelIngest).toHaveBeenCalled()
    expect(count).toBe(1)
  })

  it('pauses ratting with income but missing progress timestamps', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z')
    const activity = makeRattingActivity({
      startTime,
      data: {
        automatedBounties: 50_000_000,
        grossBounties: 50_000_000,
      },
      updatedAt: startTime,
    })
    ;(activity.data as Record<string, unknown>).lastDataAt = undefined
    ;(activity.data as Record<string, unknown>).logs = []
    const nowMs = startTime.getTime() + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([activity]).mockResolvedValueOnce([])

    const count = await terminateStaleActivities()

    expect(count).toBe(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ratting-1' },
        data: expect.objectContaining({ isPaused: true }),
      })
    )
  })

  it('backfills lastDataAt from logs before pausing legacy ratting session', async () => {
    const startTime = new Date('2024-01-01T10:00:00Z')
    const logAt = '2024-01-01T11:00:00Z'
    const activity = makeRattingActivity({
      startTime,
      data: {
        automatedBounties: 25_000_000,
        logs: [{ date: logAt, type: 'bounty', amount: 25_000_000 }],
      },
      updatedAt: new Date(logAt),
    })
    const nowMs = Date.parse(logAt) + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    update
      .mockResolvedValueOnce({
        ...activity,
        data: { ...(activity.data as object), lastDataAt: new Date(logAt).toISOString() },
      })
      .mockResolvedValueOnce({})

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([activity]).mockResolvedValueOnce([])

    const count = await terminateStaleActivities()

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'ratting-1' },
        data: {
          data: expect.objectContaining({
            lastDataAt: new Date(logAt).toISOString(),
          }),
        },
      })
    )
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ isPaused: true }),
      })
    )
    expect(count).toBe(1)
  })

  it('discards zero-gross stale ratting after minimum session age', async () => {
    const startTime = new Date('2024-01-01T08:00:00Z')
    const activity = makeRattingActivity({
      startTime,
      data: { logs: [] },
      updatedAt: startTime,
    })
    const nowMs = startTime.getTime() + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    jest.useFakeTimers()
    jest.setSystemTime(nowMs)
    findMany.mockResolvedValueOnce([activity]).mockResolvedValueOnce([])
    findUnique.mockResolvedValue(activity)

    const count = await terminateStaleActivities()

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'ratting-1' } })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'ratting-1' },
      data: expect.objectContaining({
        isDeleted: true,
        status: 'completed',
        data: expect.objectContaining({ discardReason: 'zero_gross_auto' }),
      }),
    })
    expect(count).toBe(1)
  })
})
