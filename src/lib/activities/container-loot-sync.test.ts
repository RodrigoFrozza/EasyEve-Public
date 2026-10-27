import type { Activity } from '@prisma/client'
import {
  syncContainerLootForActivity,
  mergeLootSnapshotPeak,
  AUTO_LOOT_SUPPORTED_TYPES,
} from './container-loot-sync'

describe('mergeLootSnapshotPeak', () => {
  it('raises the baseline on a new high', () => {
    expect(mergeLootSnapshotPeak({ 34: 1000 }, { 34: 1500 })).toEqual({ 34: 1500 })
  })

  it('keeps the old peak on a partial decrease instead of lowering it', () => {
    expect(mergeLootSnapshotPeak({ 34: 1000 }, { 34: 800 })).toEqual({ 34: 1000 })
  })

  it('resets the baseline to absent once the type is fully removed', () => {
    expect(mergeLootSnapshotPeak({ 34: 1000 }, {})).toEqual({})
  })

  it('adds a brand new typeId at its full quantity', () => {
    expect(mergeLootSnapshotPeak({ 34: 1000 }, { 34: 1000, 35: 50 })).toEqual({ 34: 1000, 35: 50 })
  })
})

const txMocks = {
  findFirst: jest.fn(),
  updateMany: jest.fn(),
  findUnique: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: { activity: typeof txMocks }) => Promise<unknown>) =>
      cb({ activity: txMocks })
    ),
  },
}))

jest.mock('@/lib/esi', () => ({
  getCharacterAssets: jest.fn(),
  getCharacterAssetNames: jest.fn(),
  getTypeName: jest.fn(),
}))

jest.mock('@/lib/market', () => ({
  getMarketAppraisalDetailed: jest.fn(),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

import { prisma } from '@/lib/prisma'
import { getCharacterAssets, getCharacterAssetNames, getTypeName } from '@/lib/esi'
import { getMarketAppraisalDetailed } from '@/lib/market'

const CHAR_ID = 2123456789
const CONTAINER_ID = 100000000001

function makeActivity(type: 'exploration' | 'salvaging', overrides?: Partial<Activity>): Activity {
  return {
    id: `act-${type}-loot`,
    userId: 'user-1',
    characterId: CHAR_ID,
    type,
    status: 'active',
    startTime: new Date('2026-05-21T19:30:00Z'),
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    participants: [{ characterId: CHAR_ID, characterName: 'Pilot' }],
    space: 'Highsec',
    data: {
      autoLootTrackingEnabled: true,
      autoLootCharacterId: CHAR_ID,
      autoLootContainerId: CONTAINER_ID,
      autoLootContainerName: 'Salvage Bin',
      lootSnapshot: { 34: 1000 },
      logs: [{ type: 'salvage', date: '2026-05-21T18:00:00Z', value: 5000 }],
      totalLootValue: 5000,
    },
    updatedAt: new Date('2026-05-21T19:30:00Z'),
    ...overrides,
  } as Activity
}

describe('AUTO_LOOT_SUPPORTED_TYPES', () => {
  it('includes ratting, exploration, and salvaging', () => {
    expect(AUTO_LOOT_SUPPORTED_TYPES).toEqual(
      expect.arrayContaining(['ratting', 'exploration', 'salvaging'])
    )
  })
})

describe('syncContainerLootForActivity profiles', () => {
  let currentActivity: Activity

  beforeEach(() => {
    jest.clearAllMocks()
    currentActivity = makeActivity('exploration')
    txMocks.findFirst.mockImplementation(() => Promise.resolve(currentActivity))
    txMocks.updateMany.mockImplementation(({ data }) => {
      currentActivity = { ...currentActivity, data: data.data } as Activity
      return Promise.resolve({ count: 1 })
    })
    txMocks.findUnique.mockImplementation(() => Promise.resolve(currentActivity))
    ;(prisma.activity.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'updated', data: data.data })
    )
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([
      { item_id: 2001, type_id: 34, location_id: CONTAINER_ID, quantity: 1500 },
    ])
    ;(getCharacterAssetNames as jest.Mock).mockResolvedValue([])
    ;(getTypeName as jest.Mock).mockResolvedValue('Tritanium')
    ;(getMarketAppraisalDetailed as jest.Mock).mockResolvedValue({
      tritanium: { unitPrice: 5, source: 'jita' },
    })
  })

  it('writes exploration loot logs with type loot and totalLootValue', async () => {
    await syncContainerLootForActivity(makeActivity('exploration'))

    const updatedData = txMocks.updateMany.mock.calls[0][0].data.data
    expect(updatedData.logs[0]).toEqual(
      expect.objectContaining({
        type: 'loot',
        siteName: 'Auto Container',
        amount: 2500,
        value: 2500,
      })
    )
    expect(updatedData.totalLootValue).toBe(7500)
    expect(updatedData.lootSnapshot).toEqual({ 34: 1500 })
  })

  it('writes salvaging auto loot logs without removing manual salvage logs', async () => {
    currentActivity = makeActivity('salvaging')
    txMocks.findFirst.mockImplementation(() => Promise.resolve(currentActivity))
    await syncContainerLootForActivity(makeActivity('salvaging'))

    const updatedData = txMocks.updateMany.mock.calls[0][0].data.data
    expect(updatedData.logs).toHaveLength(2)
    expect(updatedData.logs[0]).toEqual(
      expect.objectContaining({
        type: 'loot-auto',
        label: 'Auto Container',
        value: 2500,
      })
    )
    expect(updatedData.logs[1]).toEqual(
      expect.objectContaining({ type: 'salvage', value: 5000 })
    )
    expect(updatedData.totalLootValue).toBe(7500)
  })

  it('keeps the loot snapshot at the historical peak when quantities decrease without adding loot', async () => {
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([
      { item_id: 2001, type_id: 34, location_id: CONTAINER_ID, quantity: 800 },
    ])

    await syncContainerLootForActivity(makeActivity('exploration'))

    const updatedData = txMocks.updateMany.mock.calls[0][0].data.data
    // A partial decrease (sale/reprocessing) is indistinguishable from a plain
    // withdrawal of already-counted loot, so the peak baseline must be preserved —
    // lowering it here would double-count the remaining 800 units on a future sync.
    expect(updatedData.lootSnapshot).toEqual({ 34: 1000 })
    expect(updatedData.totalLootValue).toBe(5000)
    expect(updatedData.logs).toHaveLength(1)
  })

  it('resets the peak once a type is fully removed, then credits new loot that lands below the old peak', async () => {
    // Step 1: container is fully emptied (type 34 no longer present at all).
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([])

    await syncContainerLootForActivity(makeActivity('exploration'))

    const afterDrain = txMocks.updateMany.mock.calls[0][0].data.data
    expect(afterDrain.lootSnapshot).toEqual({})
    expect(afterDrain.totalLootValue).toBe(5000)

    // Step 2: new loot accumulates to a level below the old peak (1000) — with the
    // old "always overwrite with the absolute reading" logic this new loot would be
    // silently discarded because 300 < 1000 reads as a net decrease.
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([
      { item_id: 2002, type_id: 34, location_id: CONTAINER_ID, quantity: 300 },
    ])

    await syncContainerLootForActivity(currentActivity)

    const afterRefill = txMocks.updateMany.mock.calls[1][0].data.data
    expect(afterRefill.lootSnapshot).toEqual({ 34: 300 })
    expect(afterRefill.totalLootValue).toBe(5000 + 300 * 5)
  })

  it('skips when auto loot tracking is disabled', async () => {
    await syncContainerLootForActivity(
      makeActivity('exploration', {
        data: { autoLootTrackingEnabled: false } as Activity['data'],
      })
    )

    expect(txMocks.updateMany).not.toHaveBeenCalled()
    expect(prisma.activity.update).not.toHaveBeenCalled()
  })

  it('records a lootSyncErrors entry and still throws when the ESI fetch fails', async () => {
    ;(getCharacterAssets as jest.Mock).mockRejectedValue(new Error('ESI unavailable'))
    ;(prisma.activity.findUnique as jest.Mock).mockResolvedValue(currentActivity)

    await expect(syncContainerLootForActivity(currentActivity)).rejects.toThrow('ESI unavailable')

    expect(prisma.activity.update).toHaveBeenCalledTimes(1)
    const persisted = (prisma.activity.update as jest.Mock).mock.calls[0][0].data.data
    expect(persisted.lootSyncErrors).toEqual([
      expect.objectContaining({ message: 'ESI unavailable' }),
    ])
  })

  it('clears lootSyncErrors once a sync succeeds again', async () => {
    currentActivity = makeActivity('exploration', {
      data: {
        ...(currentActivity.data as Record<string, unknown>),
        lootSyncErrors: [{ message: 'ESI unavailable', timestamp: '2026-05-21T18:00:00Z' }],
      } as Activity['data'],
    })
    txMocks.findFirst.mockImplementation(() => Promise.resolve(currentActivity))

    await syncContainerLootForActivity(currentActivity)

    const updatedData = txMocks.updateMany.mock.calls[0][0].data.data
    expect(updatedData.lootSyncErrors).toBeUndefined()
  })
})
