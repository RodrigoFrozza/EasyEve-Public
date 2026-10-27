import {
  getRattingDetectionWindowStart,
  getRattingRollingWindowStart,
  RATTING_DETECTION_LOOKBACK_MS,
} from './ratting-detection-window'

describe('ratting-detection-window', () => {
  const now = new Date('2026-06-19T14:00:00Z')

  it('rolling window is 30 minutes before now', () => {
    const start = getRattingRollingWindowStart(now)
    expect(start.getTime()).toBe(now.getTime() - RATTING_DETECTION_LOOKBACK_MS)
  })

  it('detection window uses activity start when session is younger than 30 minutes', () => {
    const activityStart = new Date('2026-06-19T13:45:00Z')
    const start = getRattingDetectionWindowStart(activityStart, now)
    expect(start.getTime()).toBe(activityStart.getTime())
  })

  it('detection window uses rolling 30min when session is older than 30 minutes', () => {
    const oldStart = new Date('2026-06-19T12:00:00Z')
    const start = getRattingDetectionWindowStart(oldStart, now)
    expect(start.getTime()).toBe(now.getTime() - RATTING_DETECTION_LOOKBACK_MS)
  })
})
