import { getRattingNpcFaction } from '@/lib/constants/activity-data'

describe('getRattingNpcFaction', () => {
  it('reads npcFaction from activity data', () => {
    expect(
      getRattingNpcFaction({
        data: { npcFaction: 'Guristas' },
      })
    ).toBe('Guristas')
  })

  it('returns undefined when missing', () => {
    expect(getRattingNpcFaction({ data: {} })).toBeUndefined()
  })
})

describe('ratting session gross (logic)', () => {
  function gross(data: Record<string, unknown>, hasLootAutoEvents: boolean) {
    const base =
      (Number(data.automatedBounties) || 0) +
      (Number(data.automatedEss) || 0) +
      (Number(data.additionalBounties) || 0) +
      (Number(data.estimatedSalvageValue) || 0)

    if (hasLootAutoEvents) return base
    return base + (Number(data.estimatedLootValue) || 0)
  }

  it('sums bounty, ess, additional, salvage, and manual loot', () => {
    expect(
      gross(
        {
          automatedBounties: 100,
          automatedEss: 50,
          additionalBounties: 25,
          estimatedSalvageValue: 10,
          estimatedLootValue: 75,
        },
        false
      )
    ).toBe(260)
  })

  it('excludes estimatedLootValue when loot-auto events are ingested separately', () => {
    expect(
      gross(
        {
          automatedBounties: 100,
          estimatedLootValue: 75,
        },
        true
      )
    ).toBe(100)
  })
})

const mockActivityFindUnique = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    activity: { findUnique: (...args: unknown[]) => mockActivityFindUnique(...args) },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

describe('retractRattingLootForActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no-ops when the activity no longer exists', async () => {
    mockActivityFindUnique.mockResolvedValue(null)
    const { retractRattingLootForActivity } = await import('./ratting-loot-intel-ingest')

    await expect(retractRattingLootForActivity('missing')).resolves.toBeUndefined()
  })
})
