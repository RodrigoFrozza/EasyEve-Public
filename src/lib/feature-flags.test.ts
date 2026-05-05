import { DEFAULT_FEATURE_FLAGS, getResolvedFeatureFlags } from './feature-flags'

const mockFindMany = jest.fn()
const mockLoggerError = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    featureFlag: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

describe('getResolvedFeatureFlags', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockLoggerError.mockReset()
  })

  it('merges DB flags with defaults', async () => {
    mockFindMany.mockResolvedValue([
      { name: 'autoLootTracking', isEnabled: false },
      { name: 'miningLaunchV2', isEnabled: true },
    ])

    const result = await getResolvedFeatureFlags()

    expect(result.autoLootTracking).toBe(false)
    expect(result.miningLaunchV2).toBe(true)
    expect(result.abyssalSyncV2).toBe(DEFAULT_FEATURE_FLAGS.abyssalSyncV2)
    expect(result.rattingValidationStrict).toBe(DEFAULT_FEATURE_FLAGS.rattingValidationStrict)
    expect(result.explorationQualityGuards).toBe(DEFAULT_FEATURE_FLAGS.explorationQualityGuards)
  })

  it('returns defaults and logs when query fails', async () => {
    const dbError = new Error('db down')
    mockFindMany.mockRejectedValue(dbError)

    const result = await getResolvedFeatureFlags()

    expect(result).toEqual(DEFAULT_FEATURE_FLAGS)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'FeatureFlags',
      'Failed to resolve feature flags',
      dbError
    )
  })
})
