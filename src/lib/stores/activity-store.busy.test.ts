import { useActivityStore } from './activity-store'

const mockGet = jest.fn()

jest.mock('@/lib/api-error', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

describe('activity-store busy character detection', () => {
  const rattingActivity = {
    id: 'act-ratting',
    type: 'ratting',
    status: 'active' as const,
    startTime: new Date().toISOString(),
    participants: [{ characterId: 1, characterName: 'Pilot One' }],
  }

  beforeEach(() => {
    mockGet.mockReset()
    useActivityStore.setState({
      activities: [rattingActivity] as any,
      busyCharacterIdsGlobal: [],
    })
  })

  it('reports busy for a character in the type-filtered activities list', () => {
    expect(useActivityStore.getState().isCharacterBusy(1)).toBe(true)
  })

  it('does not report busy for a character with no active activity anywhere', () => {
    expect(useActivityStore.getState().isCharacterBusy(999)).toBe(false)
  })

  it('reports busy for a character only present in busyCharacterIdsGlobal (e.g. active in a different activity type)', () => {
    useActivityStore.setState({ busyCharacterIdsGlobal: [42] })

    expect(useActivityStore.getState().isCharacterBusy(42)).toBe(true)
  })

  it('fetchBusyCharacterIdsGlobal populates busyCharacterIdsGlobal from the API', async () => {
    mockGet.mockResolvedValue({ data: { characterIds: [7, 8] }, error: null })

    await useActivityStore.getState().fetchBusyCharacterIdsGlobal()

    expect(useActivityStore.getState().busyCharacterIdsGlobal).toEqual([7, 8])
    expect(mockGet).toHaveBeenCalledWith(
      '/api/activities/busy-characters',
      expect.objectContaining({ showToast: false })
    )
  })

  it('leaves busyCharacterIdsGlobal unchanged when the API call fails', async () => {
    useActivityStore.setState({ busyCharacterIdsGlobal: [1, 2] })
    mockGet.mockResolvedValue({ data: null, error: new Error('network') })

    await useActivityStore.getState().fetchBusyCharacterIdsGlobal()

    expect(useActivityStore.getState().busyCharacterIdsGlobal).toEqual([1, 2])
  })
})
