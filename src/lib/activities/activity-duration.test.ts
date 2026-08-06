import { getActivityDurationMs } from './activity-duration'

describe('getActivityDurationMs', () => {
  const start = '2024-01-01T10:00:00Z'

  it('freezes duration at pausedAt for retrospective auto-pause', () => {
    const pausedAt = '2024-01-01T12:00:00Z'
    const durationMs = getActivityDurationMs({
      startTime: start,
      status: 'active',
      isPaused: true,
      pausedAt,
      accumulatedPausedTime: 0,
      nowMs: Date.parse('2024-01-01T15:00:00Z'),
    })
    expect(durationMs).toBe(2 * 60 * 60 * 1000)
  })

  it('subtracts accumulatedPausedTime from active span', () => {
    const durationMs = getActivityDurationMs({
      startTime: start,
      endTime: '2024-01-01T13:00:00Z',
      status: 'completed',
      accumulatedPausedTime: 30 * 60 * 1000,
    })
    expect(durationMs).toBe(2.5 * 60 * 60 * 1000)
  })

  it('uses endTime for completed sessions', () => {
    const durationMs = getActivityDurationMs({
      startTime: start,
      endTime: '2024-01-01T11:00:00Z',
      status: 'completed',
    })
    expect(durationMs).toBe(60 * 60 * 1000)
  })
})
