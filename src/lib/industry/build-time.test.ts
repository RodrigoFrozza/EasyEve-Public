import {
  clampTe,
  parseIsoDurationToSeconds,
  localBuildTimeSeconds,
  iskPerHour,
} from '@/lib/industry/build-time'

describe('clampTe', () => {
  it('clamps to [0, 20] and floors', () => {
    expect(clampTe(-5)).toBe(0)
    expect(clampTe(25)).toBe(20)
    expect(clampTe(10.9)).toBe(10)
    expect(clampTe(20)).toBe(20)
  })
})

describe('parseIsoDurationToSeconds', () => {
  it('parses the EVE Ref hour/minute/second form', () => {
    // PT194H19M33S = 194*3600 + 19*60 + 33
    expect(parseIsoDurationToSeconds('PT194H19M33S')).toBe(194 * 3600 + 19 * 60 + 33)
  })

  it('parses days and partial forms', () => {
    expect(parseIsoDurationToSeconds('P1DT2H')).toBe(86400 + 2 * 3600)
    expect(parseIsoDurationToSeconds('PT30M')).toBe(1800)
    expect(parseIsoDurationToSeconds('PT45S')).toBe(45)
  })

  it('parses fractional seconds', () => {
    expect(parseIsoDurationToSeconds('PT1.5S')).toBe(1.5)
  })

  it('returns null for garbage or empty durations', () => {
    expect(parseIsoDurationToSeconds('P')).toBeNull()
    expect(parseIsoDurationToSeconds('PT')).toBeNull()
    expect(parseIsoDurationToSeconds('194H19M')).toBeNull()
    expect(parseIsoDurationToSeconds('')).toBeNull()
    // @ts-expect-error runtime guard for non-strings
    expect(parseIsoDurationToSeconds(null)).toBeNull()
  })
})

describe('localBuildTimeSeconds', () => {
  it('multiplies base per-run time by runs with no TE', () => {
    expect(localBuildTimeSeconds(600, 10, 0)).toBe(6000)
  })

  it('applies the TE reduction (value is a percent, 0-20)', () => {
    // 600 * 1 run * (1 - 20/100) = 480
    expect(localBuildTimeSeconds(600, 1, 20)).toBe(480)
  })

  it('treats runs < 1 as 1', () => {
    expect(localBuildTimeSeconds(600, 0, 0)).toBe(600)
  })

  it('returns null when base time is unknown or non-positive', () => {
    expect(localBuildTimeSeconds(null, 5, 0)).toBeNull()
    expect(localBuildTimeSeconds(0, 5, 0)).toBeNull()
    expect(localBuildTimeSeconds(undefined, 5, 0)).toBeNull()
  })
})

describe('iskPerHour', () => {
  it('divides net profit by hours', () => {
    // 3600s = 1h, profit 1000 -> 1000 ISK/h
    expect(iskPerHour(1000, 3600)).toBe(1000)
    // 1800s = 0.5h, profit 1000 -> 2000 ISK/h
    expect(iskPerHour(1000, 1800)).toBe(2000)
  })

  it('passes through a negative (money-losing) net profit', () => {
    expect(iskPerHour(-3600, 3600)).toBe(-3600)
  })

  it('returns null when time is unknown or non-positive', () => {
    expect(iskPerHour(1000, null)).toBeNull()
    expect(iskPerHour(1000, 0)).toBeNull()
    expect(iskPerHour(1000, -100)).toBeNull()
  })

  it('returns null when net profit is unknown', () => {
    expect(iskPerHour(null, 3600)).toBeNull()
    expect(iskPerHour(undefined, 3600)).toBeNull()
  })
})
