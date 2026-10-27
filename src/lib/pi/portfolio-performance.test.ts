import {
  buildPiDailyPerformance,
  piDailyProfitFromRate,
} from '@/lib/pi/portfolio-performance'

describe('portfolio-performance', () => {
  it('estimates daily profit from current NET ISK/h (24h at real rate)', () => {
    expect(piDailyProfitFromRate(1_000_000)).toBe(24_000_000)
    expect(piDailyProfitFromRate(-500_000)).toBe(-12_000_000)
  })

  it('uses live portfolio for today and stored snapshots for past days', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-06-26T15:00:00.000Z'))

    const dateRange = ['2024-06-24', '2024-06-25', '2024-06-26']
    const snapshots = {
      '2024-06-24': {
        currentNetIskPerHour: 100,
        colonyCount: 2,
        recordedAt: '2024-06-24T12:00:00.000Z',
      },
      '2024-06-25': {
        currentNetIskPerHour: 200,
        colonyCount: 2,
        recordedAt: '2024-06-25T12:00:00.000Z',
      },
    }

    const rows = buildPiDailyPerformance(dateRange, snapshots, {
      currentNetIskPerHour: 300,
      colonyCount: 3,
    })

    expect(rows[0]?.value).toBe(100 * 24)
    expect(rows[1]?.value).toBe(200 * 24)
    expect(rows[2]?.value).toBe(300 * 24)
    expect(rows[2]?.sessions).toBe(1)

    jest.useRealTimers()
  })
})
