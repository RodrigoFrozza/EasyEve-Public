import { formatRelativeTime } from './format-relative-time'

describe('formatRelativeTime', () => {
  it('renders "ready" for zero or negative deltas', () => {
    expect(formatRelativeTime(0)).toBe('ready')
    expect(formatRelativeTime(-1000)).toBe('ready')
  })

  it('renders days + hours for multi-day deltas', () => {
    const ms = 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
    expect(formatRelativeTime(ms)).toBe('5d 2h')
  })

  it('renders hours + minutes for sub-day deltas', () => {
    const ms = 3 * 60 * 60 * 1000 + 12 * 60 * 1000
    expect(formatRelativeTime(ms)).toBe('3h 12m')
  })

  it('renders minutes only for sub-hour deltas', () => {
    expect(formatRelativeTime(45 * 60 * 1000)).toBe('45m')
  })

  it('renders <1m for sub-minute deltas', () => {
    expect(formatRelativeTime(30 * 1000)).toBe('<1m')
  })

  it('renders — for non-finite input', () => {
    expect(formatRelativeTime(NaN)).toBe('—')
    expect(formatRelativeTime(Infinity)).toBe('—')
  })
})
