import { calculateNextRun } from '../scheduler'

const FIFTEEN_MIN_MS = 15 * 60 * 1000
const TOLERANCE_MS = 3 * 60 * 1000

describe('calculateNextRun cadence', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-21T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('advances 15m for interval 15m', () => {
    const next = calculateNextRun('15m')
    expect(next.getTime() - Date.now()).toBeGreaterThanOrEqual(FIFTEEN_MIN_MS - 1000)
    expect(next.getTime() - Date.now()).toBeLessThanOrEqual(FIFTEEN_MIN_MS + 1000)
  })

  it('advances 15m for every15m alias', () => {
    const next = calculateNextRun('every15m')
    const delta = next.getTime() - Date.now()
    expect(Math.abs(delta - FIFTEEN_MIN_MS)).toBeLessThanOrEqual(TOLERANCE_MS)
  })

  it('advances 1h for hourly', () => {
    const next = calculateNextRun('hourly')
    expect(next.getTime() - Date.now()).toBeCloseTo(60 * 60 * 1000, -3)
  })
})
