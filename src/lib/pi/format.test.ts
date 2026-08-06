import { formatBufferCountdown, formatPiRate } from '@/lib/pi/format'

describe('formatPiRate', () => {
  it('limits fractional rates to one decimal', () => {
    expect(formatPiRate(12.345)).toBe('12.3')
    expect(formatPiRate(0.166666)).toBe('0.2')
  })

  it('keeps compact suffixes at one decimal', () => {
    expect(formatPiRate(1500)).toBe('1.5K')
  })
})

describe('formatBufferCountdown', () => {
  it('formats sub-hour durations in minutes', () => {
    expect(formatBufferCountdown(0.5)).toBe('30m')
  })

  it('formats multi-day durations', () => {
    expect(formatBufferCountdown(50)).toBe('2d 2h')
  })
})
