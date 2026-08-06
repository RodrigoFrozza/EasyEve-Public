import type { Character } from '@prisma/client'
import { runAutoTrackingForUser } from './auto-activity-detection'

const mockGetValidAccessToken = jest.fn()
const mockGetCharacterWalletJournal = jest.fn()
const mockGetCharacterMiningLedger = jest.fn()
const mockGetCharacterLocation = jest.fn()
const mockResolveSystemGeo = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    character: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    sdeCache: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

jest.mock('@/lib/esi', () => ({
  getCharacterWalletJournal: (...args: unknown[]) => mockGetCharacterWalletJournal(...args),
  getCharacterMiningLedger: (...args: unknown[]) => mockGetCharacterMiningLedger(...args),
  getCharacterLocation: (...args: unknown[]) => mockGetCharacterLocation(...args),
}))

jest.mock('@/lib/mining-system-geo', () => ({
  resolveSystemGeo: (...args: unknown[]) => mockResolveSystemGeo(...args),
}))

jest.mock('@/lib/esi/mining-ledger', () => ({
  buildEntryMapForDate: jest.fn(() => ({})),
  readMiningDetectionCache: jest.fn(() => null),
  refreshMiningDetectionCacheForActivity: jest.fn(),
  sumEntryQuantities: jest.fn(() => 0),
  writeMiningDetectionCache: jest.fn(),
}))

jest.mock('@/lib/activities/mining-activity-sync', () => ({
  runMiningActivitySync: jest.fn(),
}))

jest.mock('@/lib/analytics/loot-intel-dispatch', () => ({
  scheduleLootIntelIngest: jest.fn(),
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
}))

import { prisma } from '@/lib/prisma'

const USER_ID = 'user-1'

function recentBountyDate(): string {
  return new Date(Date.now() - 5 * 60 * 1000).toISOString()
}

function makeChar(
  id: number,
  name: string,
  tags: string[]
): Character {
  return {
    id,
    userId: USER_ID,
    name,
    tags,
  } as Character
}

function bountyJournal(charId: number) {
  return [
    {
      id: 1000 + charId,
      date: recentBountyDate(),
      ref_type: 'bounty_prizes',
      amount: 1_000_000,
    },
  ]
}

describe('runAutoTrackingForUser ratting multi-char', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
      subscriptionEnd: new Date('2099-01-01'),
      isTester: false,
    })
    ;(prisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
      autoTrackingEnabled: true,
    })
    ;(prisma.activity.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.notification.create as jest.Mock).mockResolvedValue({})
    ;(prisma.activity.update as jest.Mock).mockResolvedValue({})

    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'token' })
    mockGetCharacterMiningLedger.mockResolvedValue([])
    // Default: no resolvable location, so npcFaction/space stay unset rather
    // than a hardcoded 'unknown'/'Unknown' — tests that care about location
    // resolution override these explicitly.
    mockGetCharacterLocation.mockResolvedValue({})
    mockResolveSystemGeo.mockResolvedValue({})
  })

  it('creates ratting activity only with chars that have recent bounty', async () => {
    const chars = [
      makeChar(101, 'RatterOne', ['Ratter']),
      makeChar(102, 'RatterTwo', ['Ratter']),
      makeChar(103, 'RatterThree', ['Ratter']),
    ]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-new', ...data })
    )

    mockGetCharacterWalletJournal.mockImplementation((charId: number) => {
      if (charId === 101) return Promise.resolve(bountyJournal(charId))
      return Promise.resolve([])
    })

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).toHaveBeenCalledTimes(1)
    const createCall = (prisma.activity.create as jest.Mock).mock.calls[0][0]
    const participantIds = createCall.data.participants.map(
      (p: { characterId: number }) => p.characterId
    )
    expect(participantIds).toEqual([101])
  })

  it('notifies re-auth (not a silent skip) when a ratter token is broken', async () => {
    const chars = [makeChar(201, 'BrokenTokenRatter', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.sdeCache.findUnique as jest.Mock).mockResolvedValue(null)

    // Broken/expired token: getValidAccessToken returns no token + an error code.
    mockGetValidAccessToken.mockResolvedValue({ accessToken: null, error: 'token_invalid' })

    await runAutoTrackingForUser(USER_ID)

    // No session created, but the failure is surfaced instead of swallowed.
    expect(prisma.activity.create).not.toHaveBeenCalled()
    const reauthNotif = (prisma.notification.create as jest.Mock).mock.calls.find(
      (c) => c[0]?.data?.title === 'Reautenticação necessária'
    )
    expect(reauthNotif).toBeTruthy()
    expect(reauthNotif[0].data.userId).toBe(USER_ID)
    expect(prisma.sdeCache.upsert).toHaveBeenCalled()
  })

  it('does not re-notify a broken ratter token within the dedupe cooldown', async () => {
    const chars = [makeChar(202, 'StillBrokenRatter', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    // A recent flag means we already warned within the last 24h.
    ;(prisma.sdeCache.findUnique as jest.Mock).mockResolvedValue({
      value: { at: Date.now() - 60 * 1000 },
    })

    mockGetValidAccessToken.mockResolvedValue({ accessToken: null, error: 'token_invalid' })

    await runAutoTrackingForUser(USER_ID)

    const reauthNotif = (prisma.notification.create as jest.Mock).mock.calls.find(
      (c) => c[0]?.data?.title === 'Reautenticação necessária'
    )
    expect(reauthNotif).toBeUndefined()
  })

  it('creates ratting activity with each ratter that has recent bounty in the same cycle', async () => {
    const chars = [
      makeChar(101, 'RatterOne', ['Ratter']),
      makeChar(102, 'RatterTwo', ['Ratter']),
      makeChar(103, 'RatterThree', ['Ratter']),
    ]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-new', ...data })
    )

    mockGetCharacterWalletJournal.mockImplementation((charId: number) => {
      if (charId === 101 || charId === 102) return Promise.resolve(bountyJournal(charId))
      return Promise.resolve([])
    })

    await runAutoTrackingForUser(USER_ID)

    const createCall = (prisma.activity.create as jest.Mock).mock.calls[0][0]
    const participantIds = createCall.data.participants.map(
      (p: { characterId: number }) => p.characterId
    )
    expect(participantIds).toEqual(expect.arrayContaining([101, 102]))
    expect(participantIds).toHaveLength(2)
    expect(participantIds).not.toContain(103)
  })

  it('does not add idle ratter-tagged chars without bounty', async () => {
    const chars = [
      makeChar(101, 'RatterOne', ['Ratter']),
      makeChar(102, 'IdleAlt', ['Ratter']),
    ]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-new', ...data })
    )

    mockGetCharacterWalletJournal.mockImplementation((charId: number) => {
      if (charId === 101) return Promise.resolve(bountyJournal(charId))
      return Promise.resolve([])
    })

    await runAutoTrackingForUser(USER_ID)

    const createCall = (prisma.activity.create as jest.Mock).mock.calls[0][0]
    const participantIds = createCall.data.participants.map(
      (p: { characterId: number }) => p.characterId
    )
    expect(participantIds).toEqual([101])
    expect(participantIds).not.toContain(102)
  })

  it('still evaluates ratting when character has Miner tag and active mining activity', async () => {
    const chars = [makeChar(201, 'DualTag', ['Miner', 'Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockImplementation(
      ({ where }: { where: { type?: string } }) => {
        if (where.type === 'mining') {
          return Promise.resolve({
            id: 'mining-act',
            isPaused: false,
            participants: [{ characterId: 201 }],
          })
        }
        return Promise.resolve(null)
      }
    )
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'rat-act', ...data })
    )

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(201))

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ratting' }),
      })
    )
  })

  it('joins existing auto ratting activity when late ratter is detected', async () => {
    const chars = [
      makeChar(301, 'AlreadyIn', ['Ratter']),
      makeChar(302, 'LateJoin', ['Ratter']),
    ]

    const existingActivity = {
      id: 'rat-existing',
      participants: [{ characterId: 301, characterName: 'AlreadyIn', fit: null }],
      data: { isAutoTracked: true, logs: [], automatedBounties: 0, automatedEss: 0 },
      isPaused: false,
    }

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockImplementation(
      ({ where }: { where: { type?: string; data?: unknown; participants?: unknown } }) => {
        if (where.type === 'ratting' && where.data) {
          return Promise.resolve(existingActivity)
        }
        if (where.participants) {
          const contains = where.participants as { array_contains: Array<{ characterId: number }> }
          const id = contains.array_contains[0]?.characterId
          if (id === 301) return Promise.resolve(existingActivity)
          return Promise.resolve(null)
        }
        return Promise.resolve(null)
      }
    )

    mockGetCharacterWalletJournal.mockImplementation((charId: number) => {
      if (charId === 302) return Promise.resolve(bountyJournal(charId))
      return Promise.resolve([])
    })

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rat-existing' },
        data: expect.objectContaining({
          participants: expect.arrayContaining([
            expect.objectContaining({ characterId: 301 }),
            expect.objectContaining({ characterId: 302 }),
          ]),
        }),
      })
    )
  })

  it('treats legacy ratting tag as ratter for detection', async () => {
    const chars = [makeChar(401, 'LegacyTag', ['ratting'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-legacy', ...data })
    )

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(401))

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'ratting' }),
      })
    )
  })

  it('skips ratting auto-create when character has active escalations session', async () => {
    const chars = [makeChar(501, 'EscBlocked', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockImplementation(({ where }) => {
      if (where.type === 'escalations') {
        return Promise.resolve({ id: 'esc-active', isPaused: false, type: 'escalations' })
      }
      return Promise.resolve(null)
    })

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(501))

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it('skips ratting auto-create when character has a PAUSED escalations session (it will resume and re-absorb the same bounties)', async () => {
    const chars = [makeChar(502, 'EscPausedBlocked', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockImplementation(({ where }) => {
      if (where.type === 'escalations') {
        return Promise.resolve({ id: 'esc-paused', isPaused: true, type: 'escalations' })
      }
      return Promise.resolve(null)
    })

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(502))

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it('fills npcFaction/space from the character location when it resolves to a known region', async () => {
    const chars = [makeChar(601, 'LocatedRatter', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-located', ...data })
    )

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(601))
    mockGetCharacterLocation.mockResolvedValue({ solar_system_id: 30000142 })
    mockResolveSystemGeo.mockResolvedValue({
      30000142: {
        systemId: 30000142,
        systemName: 'Jita',
        regionId: 10000002,
        regionName: 'The Forge',
        constellationId: 20000020,
        constellationName: 'Kimotoro',
        security: 0.9459,
        securityBand: 'Highsec',
      },
    })

    await runAutoTrackingForUser(USER_ID)

    const createCall = (prisma.activity.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.data.npcFaction).toBe('Guristas')
    expect(createCall.data.space).toBe('Highsec')
  })

  it('leaves npcFaction/space unset (never a placeholder string) when location cannot be resolved', async () => {
    const chars = [makeChar(602, 'UnlocatableRatter', ['Ratter'])]

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-unlocated', ...data })
    )

    mockGetCharacterWalletJournal.mockResolvedValue(bountyJournal(602))
    mockGetCharacterLocation.mockRejectedValue(new Error('Missing required scope'))

    await runAutoTrackingForUser(USER_ID)

    const createCall = (prisma.activity.create as jest.Mock).mock.calls[0][0]
    expect(createCall.data.data.npcFaction).toBeUndefined()
    expect(createCall.data.space).toBeUndefined()
  })

  it('does not recreate a session from bounties already attributed to a session that just completed', async () => {
    const chars = [makeChar(701, 'JustFinished', ['Ratter'])]
    const completedEndTime = new Date(Date.now() - 3 * 60 * 1000)
    const staleBountyDate = new Date(completedEndTime.getTime() - 60 * 1000).toISOString()

    ;(prisma.character.findMany as jest.Mock).mockResolvedValue(chars)
    ;(prisma.activity.findFirst as jest.Mock).mockImplementation(
      ({ where }: { where: { type?: unknown; status?: string; participants?: unknown } }) => {
        if (where.status === 'completed') {
          return Promise.resolve({ endTime: completedEndTime })
        }
        return Promise.resolve(null)
      }
    )
    ;(prisma.activity.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: 'act-should-not-exist', ...data })
    )

    mockGetCharacterWalletJournal.mockResolvedValue([
      {
        id: 9001,
        date: staleBountyDate,
        ref_type: 'bounty_prizes',
        amount: 1_000_000,
      },
    ])

    await runAutoTrackingForUser(USER_ID)

    expect(prisma.activity.create).not.toHaveBeenCalled()
  })
})
