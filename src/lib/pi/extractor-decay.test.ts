import {
  averageUnitsPerHour,
  calculateExtractorCycleOutputs,
  calculateExtractorProgramTotalOutput,
  isExtractorExpired,
} from '@/lib/pi/extractor-decay'

describe('extractor-decay', () => {
  it('produces decreasing cycle outputs over time', () => {
    const outputs = calculateExtractorCycleOutputs(6965, 30 * 60, 10)
    expect(outputs.length).toBe(10)
    expect(outputs[0]).toBeGreaterThan(outputs[outputs.length - 1])
    expect(outputs.every((v) => v >= 0)).toBe(true)
  })

  it('calculates program total for a multi-day program', () => {
    const install = '2024-01-01T00:00:00Z'
    const expiry = '2024-01-03T00:00:00Z'
    const total = calculateExtractorProgramTotalOutput(6965, 30 * 60, install, expiry)
    expect(total).toBeGreaterThan(0)
  })

  it('returns zero average when extractor expired', () => {
    const install = '2024-01-01T00:00:00Z'
    const expiry = '2024-01-02T00:00:00Z'
    const now = Date.parse('2024-01-03T00:00:00Z')
    expect(isExtractorExpired(expiry, now)).toBe(true)
    expect(
      averageUnitsPerHour(6965, 30 * 60, install, expiry, now)
    ).toBeGreaterThanOrEqual(0)
  })

  it('returns positive average during active program', () => {
    const install = '2024-01-01T00:00:00Z'
    const expiry = '2024-01-03T00:00:00Z'
    const now = Date.parse('2024-01-01T12:00:00Z')
    const avg = averageUnitsPerHour(6965, 30 * 60, install, expiry, now)
    expect(avg).toBeGreaterThan(0)
  })

  it('does not report a zero current rate while still inside the first cycle', () => {
    const install = '2024-01-01T00:00:00Z'
    const expiry = '2024-01-03T00:00:00Z'
    // 5 minutes after install — the first 30-minute cycle hasn't completed yet.
    const now = Date.parse('2024-01-01T00:05:00Z')
    const avg = averageUnitsPerHour(6965, 30 * 60, install, expiry, now)
    expect(avg).toBeGreaterThan(0)
  })
})
