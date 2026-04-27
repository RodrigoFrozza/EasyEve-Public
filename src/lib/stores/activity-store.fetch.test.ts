import { useActivityStore } from './activity-store'

const mockGet = jest.fn()

jest.mock('@/lib/api-error', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe('activity-store fetchFromAPI', () => {
  const seedActivity = {
    id: 'act-1',
    type: 'ratting',
    status: 'active' as const,
    startTime: new Date().toISOString(),
    participants: [{ characterId: 1, characterName: 'Pilot' }],
  }

  beforeEach(() => {
    mockGet.mockReset()
    useActivityStore.setState({
      activities: [seedActivity] as any,
      isLoading: false,
      pagination: {
        total: 0,
        activeCount: 1,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    })
  })

  it('does not wipe activities when the API returns an error', async () => {
    mockGet.mockResolvedValue({ data: null, error: new Error('network') })

    await useActivityStore.getState().fetchFromAPI('ratting', 1)

    expect(useActivityStore.getState().activities).toHaveLength(1)
    expect(useActivityStore.getState().activities[0].id).toBe('act-1')
    expect(useActivityStore.getState().isLoading).toBe(false)
  })
})
