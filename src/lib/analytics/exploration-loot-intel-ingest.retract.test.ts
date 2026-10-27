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

describe('retractExplorationLootForActivity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('no-ops when the activity no longer exists', async () => {
    mockActivityFindUnique.mockResolvedValue(null)
    const { retractExplorationLootForActivity } = await import('./exploration-loot-intel-ingest')

    await expect(retractExplorationLootForActivity('missing')).resolves.toBeUndefined()
  })
})
