import { findTargetPendingRun, getAbyssalSessionMetrics } from './abyssal-metrics'

describe('getAbyssalSessionMetrics', () => {
  it('counts only completed runs as filaments and excludes deaths from ISK totals', () => {
    const metrics = getAbyssalSessionMetrics(
      [
        { status: 'completed', lootValue: 100, startTime: '2024-01-01T10:00:00Z', endTime: '2024-01-01T10:20:00Z' },
        { status: 'death', lootValue: 0, startTime: '2024-01-01T11:00:00Z', endTime: '2024-01-01T11:20:00Z' },
        { status: 'active', lootValue: 0, startTime: '2024-01-01T12:00:00Z' },
      ],
      1
    )

    expect(metrics.totalFilaments).toBe(1)
    expect(metrics.deathCount).toBe(1)
    expect(metrics.totalIsk).toBe(100)
    expect(metrics.iskPerHour).toBe(100)
  })
})

describe('findTargetPendingRun', () => {
  const runs = [
    {
      id: 'older',
      status: 'completed',
      registrationStatus: 'pending',
      startTime: '2024-01-01T10:00:00Z',
      endTime: '2024-01-01T10:20:00Z',
    },
    {
      id: 'newer',
      status: 'completed',
      registrationStatus: 'pending',
      startTime: '2024-01-01T11:00:00Z',
      endTime: '2024-01-01T11:20:00Z',
    },
  ]

  it('prefers the explicitly targeted run id', () => {
    expect(findTargetPendingRun(runs, 'older')?.id).toBe('older')
  })

  it('falls back to the most recently ended pending run', () => {
    expect(findTargetPendingRun(runs)?.id).toBe('newer')
  })
})
