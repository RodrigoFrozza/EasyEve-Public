import type { Activity } from '@prisma/client'
import { backfillAutoTrackedRattingParticipants, syncRattingWalletForActivity } from './ratting-wallet-sync'

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
      findFirst: jest.fn(),
    },
    character: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: { activity: typeof txMocks }) => Promise<unknown>) =>
      cb({ activity: txMocks })
    ),
  },
}))

jest.mock('@/lib/esi', () => ({
  getCharacterWalletJournal: jest.fn(),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

import { prisma } from '@/lib/prisma'
import { getCharacterWalletJournal } from '@/lib/esi'
import { getRattingDetectionWindowStart } from './ratting-detection-window'

const CHAR_ID = 2123456789
const CHAR_NAME = 'Rodrigo Frozza'
const BOUNTY_DATE = '2026-05-21T19:39:22Z'
const BOUNTY_AMOUNT = 5_870_000
const REF_ID = 987654321
const ACTIVITY_START = new Date('2026-05-21T19:30:00Z')
const JOURNAL_UNTIL = new Date(ACTIVITY_START.getTime() - 30 * 60 * 1000)

function makeActivity(overrides?: Partial<Activity>): Activity {
  return {
    id: 'act-1',
    userId: 'user-1',
    characterId: CHAR_ID,
    type: 'ratting',
    status: 'active',
    startTime: ACTIVITY_START,
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    participants: [{ characterId: CHAR_ID, characterName: CHAR_NAME }],
    data: {
      isAutoTracked: true,
      logs: [
        {
          type: 'bounty',
          amount: BOUNTY_AMOUNT,
          charName: CHAR_NAME,
          date: BOUNTY_DATE,
          id: String(REF_ID),
        },
      ],
      automatedBounties: BOUNTY_AMOUNT,
      automatedEss: 0,
      automatedTaxes: 0,
    },
    updatedAt: new Date('2026-05-21T19:30:00Z'),
    ...overrides,
  } as Activity
}

describe('syncRattingWalletForActivity', () => {
  let currentActivity: Activity

  beforeEach(() => {
    jest.clearAllMocks()
    currentActivity = makeActivity()
    txMocks.findFirst.mockImplementation(() => Promise.resolve(currentActivity))
    txMocks.updateMany.mockImplementation(({ data }) => {
      currentActivity = {
        ...currentActivity,
        data: data.data,
      } as Activity
      return Promise.resolve({ count: 1 })
    })
    txMocks.findUnique.mockImplementation(() => Promise.resolve(currentActivity))
    ;(prisma.activity.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-1', data: data.data })
    )
    ;(prisma.character.findMany as jest.Mock).mockResolvedValue([
      { id: CHAR_ID, name: CHAR_NAME, tags: ['Ratter'], userId: 'user-1' },
    ])
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
  })

  it('fetches journal with activity window floor (startTime - 30min), not endTimeLimit', async () => {
    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([])

    await syncRattingWalletForActivity(makeActivity())

    expect(getCharacterWalletJournal).toHaveBeenCalledWith(CHAR_ID, JOURNAL_UNTIL)
  })

  it('does not duplicate the first bounty when legacy auto-detect log already exists', async () => {
    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([
      {
        id: REF_ID,
        date: BOUNTY_DATE,
        amount: BOUNTY_AMOUNT,
        ref_type: 'bounty_prizes',
      },
    ])

    await syncRattingWalletForActivity(makeActivity())

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    const logs = updateCall.data.data.logs as Array<Record<string, unknown>>

    const bountyLogs = logs.filter((l) => l.type === 'bounty')
    expect(bountyLogs).toHaveLength(1)
    expect(bountyLogs[0].charId).toBe(CHAR_ID)
    expect(bountyLogs[0].refId).toBe(String(REF_ID))
    expect(updateCall.data.data.automatedBounties).toBe(BOUNTY_AMOUNT)
    expect(updateCall.data.data.lastSyncChangeCount).toBe(0)
  })

  it('adds a new bounty when journal has a distinct entry', async () => {
    const secondRef = 987654322
    const secondDate = '2026-05-21T19:45:00Z'
    const secondAmount = 1_000_000

    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([
      {
        id: REF_ID,
        date: BOUNTY_DATE,
        amount: BOUNTY_AMOUNT,
        ref_type: 'bounty_prizes',
      },
      {
        id: secondRef,
        date: secondDate,
        amount: secondAmount,
        ref_type: 'bounty_prizes',
      },
    ])

    await syncRattingWalletForActivity(makeActivity())

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    const logs = updateCall.data.data.logs as Array<Record<string, unknown>>
    const bountyLogs = logs.filter((l) => l.type === 'bounty')

    expect(bountyLogs).toHaveLength(2)
    expect(updateCall.data.data.automatedBounties).toBe(BOUNTY_AMOUNT + secondAmount)
    expect(updateCall.data.data.lastSyncChangeCount).toBe(1)
  })

  it('does not update lastSyncAt when all participant journal fetches fail', async () => {
    const previousLastSyncAt = '2026-05-21T18:00:00Z'
    ;(getCharacterWalletJournal as jest.Mock).mockRejectedValue(new Error('ESI rate limited'))

    await syncRattingWalletForActivity(
      makeActivity({
        data: {
          automatedBounties: 0,
          logs: [],
          lastSyncAt: previousLastSyncAt,
        },
      })
    )

    const updateCall = (prisma.activity.update as jest.Mock).mock.calls[0][0]
    expect(updateCall.data.data.lastSyncAt).toBe(previousLastSyncAt)
    expect(updateCall.data.data.syncErrors).toEqual([
      {
        characterId: CHAR_ID,
        characterName: CHAR_NAME,
        error: 'ESI rate limited',
      },
    ])
    expect(updateCall.data.data.lastSyncFailedAt).toBeDefined()
  })

  it('sets lastEssPaymentAt to the most recent ESS payment after sorting logs', async () => {
    const olderEss = '2026-05-21T19:35:00Z'
    const newerEss = '2026-05-21T20:00:00Z'

    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([
      {
        id: 111,
        date: olderEss,
        amount: 100_000,
        ref_type: 'ess_payout',
      },
      {
        id: 222,
        date: newerEss,
        amount: 200_000,
        ref_type: 'ess_payout',
      },
    ])

    await syncRattingWalletForActivity(
      makeActivity({
        data: {
          automatedBounties: 0,
          automatedEss: 0,
          logs: [],
        },
      })
    )

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    expect(updateCall.data.data.lastEssPaymentAt).toBe(newerEss)
    expect(updateCall.data.data.automatedEss).toBe(300_000)
  })

  it('records partial sync errors while still updating lastSyncAt on success', async () => {
    const secondCharId = 2123456790
    const secondCharName = 'Alt Pilot'

    ;(getCharacterWalletJournal as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: REF_ID,
          date: BOUNTY_DATE,
          amount: BOUNTY_AMOUNT,
          ref_type: 'bounty_prizes',
        },
      ])
      .mockRejectedValueOnce(new Error('Token invalid'))

    await syncRattingWalletForActivity(
      makeActivity({
        participants: [
          { characterId: CHAR_ID, characterName: CHAR_NAME },
          { characterId: secondCharId, characterName: secondCharName },
        ],
        data: { automatedBounties: 0, logs: [] },
      })
    )

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    expect(updateCall.data.data.lastSyncAt).toBeDefined()
    expect(updateCall.data.data.syncErrors).toEqual([
      {
        characterId: secondCharId,
        characterName: secondCharName,
        error: 'Token invalid',
      },
    ])
  })

  it('backfills missing ratter-tagged participant with bounty since activity start', async () => {
    const secondCharId = 2123456790
    const secondCharName = 'Fleet Alt'
    const recentStart = new Date(Date.now() - 10 * 60 * 1000)
    const recentBounty = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const windowStart = getRattingDetectionWindowStart(recentStart)

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue([
      { id: CHAR_ID, name: CHAR_NAME, tags: ['Ratter'], userId: 'user-1' },
      { id: secondCharId, name: secondCharName, tags: ['Ratter'], userId: 'user-1' },
    ])
    ;(getCharacterWalletJournal as jest.Mock).mockImplementation((charId: number) => {
      if (charId === secondCharId) {
        return Promise.resolve([
          {
            id: 555,
            date: recentBounty,
            amount: 500_000,
            ref_type: 'bounty_prizes',
          },
        ])
      }
      return Promise.resolve([])
    })
    ;(prisma.activity.update as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({
        ...makeActivity({ startTime: recentStart }),
        participants: data.participants,
        data: data.data,
      })
    )

    const updated = await backfillAutoTrackedRattingParticipants(
      makeActivity({ startTime: recentStart })
    )

    expect(getCharacterWalletJournal).toHaveBeenCalledWith(secondCharId, windowStart)
    expect(updated.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ characterId: CHAR_ID }),
        expect.objectContaining({ characterId: secondCharId, characterName: secondCharName }),
      ])
    )
  })

  it('does not backfill ratter with bounty before activity start', async () => {
    const secondCharId = 2123456790
    const secondCharName = 'EarlyBountyAlt'
    const recentStart = new Date(Date.now() - 10 * 60 * 1000)
    const preSessionBountyDate = new Date(Date.now() - 20 * 60 * 1000).toISOString()

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue([
      { id: CHAR_ID, name: CHAR_NAME, tags: ['Ratter'], userId: 'user-1' },
      { id: secondCharId, name: secondCharName, tags: ['Ratter'], userId: 'user-1' },
    ])
    ;(getCharacterWalletJournal as jest.Mock).mockImplementation((charId: number) => {
      if (charId === secondCharId) {
        return Promise.resolve([
          {
            id: 556,
            date: preSessionBountyDate,
            amount: 500_000,
            ref_type: 'bounty_prizes',
          },
        ])
      }
      return Promise.resolve([])
    })

    const updated = await backfillAutoTrackedRattingParticipants(
      makeActivity({ startTime: recentStart })
    )

    const participantIds = (updated.participants as Array<{ characterId: number }>).map(
      (p) => p.characterId
    )
    expect(participantIds).toEqual([CHAR_ID])
    expect(participantIds).not.toContain(secondCharId)
  })

  it('excludes bounty/tax entries after endTime on a completed session (would double-count with a new session)', async () => {
    const endTime = new Date('2026-05-21T20:00:00Z')
    const afterEndBountyDate = new Date(endTime.getTime() + 10 * 60 * 1000).toISOString()

    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([
      {
        id: REF_ID,
        date: BOUNTY_DATE,
        amount: BOUNTY_AMOUNT,
        ref_type: 'bounty_prizes',
      },
      {
        id: 999,
        date: afterEndBountyDate,
        amount: 1_000_000,
        ref_type: 'bounty_prizes',
      },
    ])

    await syncRattingWalletForActivity(
      makeActivity({ status: 'completed', endTime })
    )

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    const logs = updateCall.data.data.logs as Array<Record<string, unknown>>
    const bountyLogs = logs.filter((l) => l.type === 'bounty')

    expect(bountyLogs).toHaveLength(1)
    expect(bountyLogs[0].refId).toBe(String(REF_ID))
  })

  it('still accepts an ESS payout up to 168 minutes after a completed session ends', async () => {
    const endTime = new Date('2026-05-21T20:00:00Z')
    const delayedEssDate = new Date(endTime.getTime() + 60 * 60 * 1000).toISOString()

    ;(getCharacterWalletJournal as jest.Mock).mockResolvedValue([
      {
        id: 1234,
        date: delayedEssDate,
        amount: 2_000_000,
        ref_type: 'ess_escrow_transfer',
      },
    ])

    await syncRattingWalletForActivity(
      makeActivity({
        status: 'completed',
        endTime,
        data: { isAutoTracked: true, logs: [], automatedBounties: 0, automatedEss: 0, automatedTaxes: 0 },
      })
    )

    const updateCall = txMocks.updateMany.mock.calls[0][0]
    const logs = updateCall.data.data.logs as Array<Record<string, unknown>>
    const essLogs = logs.filter((l) => l.type === 'ess')

    expect(essLogs).toHaveLength(1)
    expect(updateCall.data.data.automatedEss).toBe(2_000_000)
  })
})
