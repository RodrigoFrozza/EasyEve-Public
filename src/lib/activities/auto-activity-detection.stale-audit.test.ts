import type { Activity } from '@prisma/client'
import { ACTIVITY_STALE_PAUSE_THRESHOLD_MS } from './activity-automation-policy'
import { previewStaleActivityAudit } from './auto-activity-detection'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findMany: jest.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

const findMany = prisma.activity.findMany as jest.Mock

function makeExplorationActivity(overrides?: Partial<Activity>): Activity {
  const startTime = new Date('2024-01-01T10:00:00Z')
  return {
    id: 'explore-1',
    userId: 'user-1',
    characterId: 123,
    type: 'exploration',
    status: 'active',
    startTime,
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    isDeleted: false,
    participants: [{ characterId: 123, characterName: 'Pilot' }],
    data: {
      lastDataAt: startTime.toISOString(),
      totalLootValue: 0,
      logs: [],
    },
    region: null,
    space: 'Highsec',
    typeId: null,
    createdAt: startTime,
    updatedAt: startTime,
    ...overrides,
  } as Activity
}

describe('previewStaleActivityAudit', () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  it('discards stale zero-gross exploration with no safe pause instant', async () => {
    const activity = makeExplorationActivity()
    const nowMs = startTimeMs(activity) + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    findMany
      .mockResolvedValueOnce([activity])
      .mockResolvedValueOnce([])

    const actions = await previewStaleActivityAudit(nowMs)

    expect(actions).toEqual([
      expect.objectContaining({
        action: 'discard',
        activityId: 'explore-1',
        type: 'exploration',
        reason: 'zero gross income with no safe pause instant',
      }),
    ])
  })

  it('pauses stale exploration when gross income is recorded', async () => {
    const lastSite = '2024-01-01T11:00:00Z'
    const activity = makeExplorationActivity({
      data: {
        lastDataAt: lastSite,
        totalLootValue: 500_000,
        logs: [{ type: 'site', value: 500_000, date: lastSite }],
      },
    })
    const nowMs = Date.parse(lastSite) + ACTIVITY_STALE_PAUSE_THRESHOLD_MS + 60_000

    findMany
      .mockResolvedValueOnce([activity])
      .mockResolvedValueOnce([])

    const actions = await previewStaleActivityAudit(nowMs)

    expect(actions).toEqual([
      expect.objectContaining({
        action: 'pause',
        activityId: 'explore-1',
        type: 'exploration',
        pauseAt: '2024-01-01T11:00:00.000Z',
      }),
    ])
  })

  it('discards paused zero-gross activity after 6h threshold', async () => {
    const pausedAt = new Date('2024-01-01T10:00:00Z')
    const activity = makeExplorationActivity({
      isPaused: true,
      pausedAt,
      data: { totalLootValue: 0, logs: [] },
    })
    const nowMs = pausedAt.getTime() + 6 * 60 * 60 * 1000 + 60_000

    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([activity])

    const actions = await previewStaleActivityAudit(nowMs)

    expect(actions).toEqual([
      expect.objectContaining({
        action: 'discard',
        activityId: 'explore-1',
        reason: 'zero gross income after 6h pause',
      }),
    ])
  })
})

function startTimeMs(activity: Activity): number {
  return new Date(activity.startTime).getTime()
}
