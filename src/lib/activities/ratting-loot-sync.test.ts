import type { Activity } from '@prisma/client'
import {
  buildLootSnapshotFromContents,
  calculateDelta,
  enrichDeltaWithTypeNames,
  initializeRattingLootSnapshot,
  fetchContainerContents,
} from './ratting-loot-sync'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      update: jest.fn(),
    },
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

const CHAR_ID = 2123456789
const CONTAINER_ID = 100000000001

function makeActivity(overrides?: Partial<Activity>): Activity {
  return {
    id: 'act-loot-1',
    userId: 'user-1',
    characterId: CHAR_ID,
    type: 'ratting',
    status: 'active',
    startTime: new Date('2026-05-21T19:30:00Z'),
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    participants: [{ characterId: CHAR_ID, characterName: 'Pilot' }],
    data: {
      autoLootTrackingEnabled: true,
      autoLootCharacterId: CHAR_ID,
      autoLootContainerId: CONTAINER_ID,
      autoLootContainerName: 'Ratting Loot',
      logs: [],
      estimatedLootValue: 0,
    },
    ...overrides,
  } as Activity
}

describe('buildLootSnapshotFromContents', () => {
  it('aggregates quantities by typeId', () => {
    const snapshot = buildLootSnapshotFromContents([
      { typeId: 34, typeName: 'Tritanium', quantity: 1000 },
      { typeId: 34, typeName: 'Tritanium', quantity: 500 },
      { typeId: 35, typeName: 'Pyerite', quantity: 200 },
    ])

    expect(snapshot).toEqual({ 34: 1500, 35: 200 })
  })
})

describe('calculateDelta', () => {
  it('returns only positive quantity differences', () => {
    const delta = calculateDelta({ 34: 1000, 35: 200 }, { 34: 1500, 35: 100, 36: 50 })

    expect(delta).toEqual([
      { typeId: 34, typeName: '', quantity: 500, unitPrice: 0, totalValue: 0 },
      { typeId: 36, typeName: '', quantity: 50, unitPrice: 0, totalValue: 0 },
    ])
  })

  it('returns empty array when snapshot is unchanged', () => {
    expect(calculateDelta({ 34: 1000 }, { 34: 1000 })).toEqual([])
  })
})

describe('enrichDeltaWithTypeNames', () => {
  it('maps typeId to typeName from container contents', () => {
    const delta = calculateDelta({}, { 34: 100, 35: 50 })
    const enriched = enrichDeltaWithTypeNames(delta, [
      { typeId: 34, typeName: 'Tritanium', quantity: 100 },
      { typeId: 35, typeName: 'Pyerite', quantity: 50 },
    ])

    expect(enriched).toEqual([
      expect.objectContaining({ typeId: 34, typeName: 'Tritanium', quantity: 100 }),
      expect.objectContaining({ typeId: 35, typeName: 'Pyerite', quantity: 50 }),
    ])
  })

  it('falls back to generic name when type is missing from contents', () => {
    const enriched = enrichDeltaWithTypeNames(
      [{ typeId: 99, typeName: '', quantity: 1, unitPrice: 0, totalValue: 0 }],
      []
    )

    expect(enriched[0].typeName).toBe('Type 99')
  })
})

describe('initializeRattingLootSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.activity.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-loot-1', data: data.data })
    )
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([
      { item_id: 2001, type_id: 34, location_id: CONTAINER_ID, quantity: 1000 },
      { item_id: 2002, type_id: 35, location_id: CONTAINER_ID, quantity: 200 },
    ])
    ;(getCharacterAssetNames as jest.Mock).mockResolvedValue([])
    ;(getTypeName as jest.Mock).mockImplementation((typeId: number) =>
      typeId === 34 ? 'Tritanium' : 'Pyerite'
    )
  })

  it('writes baseline snapshot without creating loot logs', async () => {
    await initializeRattingLootSnapshot(makeActivity())

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            lootSnapshot: { 34: 1000, 35: 200 },
            lastLootSyncAt: expect.any(String),
          }),
        }),
      })
    )
    const updatedData = (prisma.activity.update as jest.Mock).mock.calls[0][0].data.data
    expect(updatedData.logs).toEqual([])
    expect(updatedData.estimatedLootValue).toBe(0)
  })

  it('skips when auto loot tracking is disabled', async () => {
    await initializeRattingLootSnapshot(
      makeActivity({ data: { autoLootTrackingEnabled: false } as Activity['data'] })
    )

    expect(prisma.activity.update).not.toHaveBeenCalled()
  })

  it('skips when snapshot already exists', async () => {
    await initializeRattingLootSnapshot(
      makeActivity({
        data: {
          autoLootTrackingEnabled: true,
          autoLootCharacterId: CHAR_ID,
          autoLootContainerId: CONTAINER_ID,
          lootSnapshot: { 34: 500 },
        } as Activity['data'],
      })
    )

    expect(prisma.activity.update).not.toHaveBeenCalled()
  })

  it('initializes empty snapshot for empty container', async () => {
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([])

    await initializeRattingLootSnapshot(makeActivity())

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            lootSnapshot: {},
          }),
        }),
      })
    )
  })
})

describe('fetchContainerContents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([
      { item_id: 2001, type_id: 34, location_id: CONTAINER_ID, quantity: 500 },
    ])
    ;(getCharacterAssetNames as jest.Mock).mockResolvedValue([
      { item_id: 2001, name: 'Custom Stack' },
    ])
  })

  it('returns items inside the given container', async () => {
    const contents = await fetchContainerContents(CHAR_ID, CONTAINER_ID)

    expect(contents).toEqual([{ typeId: 34, typeName: 'Custom Stack', quantity: 500 }])
  })

  it('returns empty array when container has no items', async () => {
    ;(getCharacterAssets as jest.Mock).mockResolvedValue([])

    expect(await fetchContainerContents(CHAR_ID, CONTAINER_ID)).toEqual([])
  })
})
