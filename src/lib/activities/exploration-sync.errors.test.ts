import type { Activity } from '@prisma/client'

const mockCharacterUpdate = jest.fn()
const mockActivityUpdate = jest.fn()
const mockGetValidAccessToken = jest.fn()
const mockGetCharacterLocation = jest.fn()
const mockGetCharacterShip = jest.fn()

let currentActivity: Activity

jest.mock('@/lib/prisma', () => ({
  prisma: {
    character: { update: (...args: unknown[]) => mockCharacterUpdate(...args) },
    activity: {
      findUnique: jest.fn(() => Promise.resolve(currentActivity)),
    },
    $transaction: (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        activity: {
          findFirst: jest.fn(() => Promise.resolve(currentActivity)),
          updateMany: (...args: unknown[]) => {
            mockActivityUpdate(...args)
            return Promise.resolve({ count: 1 })
          },
          findUnique: jest.fn(() => Promise.resolve(currentActivity)),
        },
      }),
  },
}))

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

jest.mock('@/lib/esi', () => ({
  getCharacterLocation: (...args: unknown[]) => mockGetCharacterLocation(...args),
  getCharacterShip: (...args: unknown[]) => mockGetCharacterShip(...args),
}))

function makeActivity(overrides?: Partial<Activity>): Activity {
  return {
    id: 'act-1',
    userId: 'user-1',
    characterId: 111,
    type: 'exploration',
    status: 'active',
    startTime: new Date('2026-06-01T10:00:00Z'),
    endTime: null,
    isPaused: false,
    pausedAt: null,
    accumulatedPausedTime: 0,
    isDeleted: false,
    participants: [{ characterId: 111, characterName: 'Pilot One' }],
    data: { logs: [] },
    region: null,
    space: null,
    typeId: null,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
    ...overrides,
  } as Activity
}

describe('syncExplorationActivity error persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCharacterUpdate.mockResolvedValue({})
    mockActivityUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data)
  })

  it('persists a syncErrors entry instead of throwing when ESI reports a location failure', async () => {
    const { syncExplorationActivity } = await import('./exploration-sync')
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'token-1' })
    mockGetCharacterLocation.mockResolvedValue({ error: 'Unauthorized/Invalid token', status: 401 })
    mockGetCharacterShip.mockResolvedValue({})

    currentActivity = makeActivity()
    await syncExplorationActivity(currentActivity)

    expect(mockActivityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          data: expect.objectContaining({
            syncErrors: [
              expect.objectContaining({ characterId: 111, error: 'Unauthorized/Invalid token' }),
            ],
          }),
        }),
      })
    )
  })

  it('records a syncErrors entry and keeps the existing participant when a DB write throws', async () => {
    const { syncExplorationActivity } = await import('./exploration-sync')
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'token-1' })
    mockGetCharacterLocation.mockResolvedValue({ location: 'Jita' })
    mockGetCharacterShip.mockResolvedValue({ ship: 'Astero', shipTypeId: 33468 })
    mockCharacterUpdate.mockRejectedValue(new Error('db unavailable'))

    currentActivity = makeActivity()
    const result = (await syncExplorationActivity(currentActivity)) as { participants: unknown[] }

    expect(mockActivityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants: [{ characterId: 111, characterName: 'Pilot One' }],
          data: expect.objectContaining({
            syncErrors: [expect.objectContaining({ characterId: 111, error: 'db unavailable' })],
          }),
        }),
      })
    )
    expect(result).toBeDefined()
  })

  it('persists an empty syncErrors array when every participant syncs cleanly', async () => {
    const { syncExplorationActivity } = await import('./exploration-sync')
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'token-1' })
    mockGetCharacterLocation.mockResolvedValue({ location: 'Jita' })
    mockGetCharacterShip.mockResolvedValue({ ship: 'Astero', shipTypeId: 33468 })

    currentActivity = makeActivity()
    await syncExplorationActivity(currentActivity)

    expect(mockActivityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ data: expect.objectContaining({ syncErrors: [] }) }),
      })
    )
  })
})
