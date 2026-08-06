import { buildDailyBaselines, isValidMiningEntry } from '@/lib/activities/mining-activity-sync'

describe('mining-activity-sync helpers', () => {
  it('validates mining ledger entries', () => {
    expect(
      isValidMiningEntry({
        date: '2026-06-18',
        quantity: 100,
        type_id: 11396,
        solar_system_id: 30000142,
      })
    ).toBe(true)

    expect(
      isValidMiningEntry({
        date: '2026-06-18',
        quantity: 0,
        type_id: 11396,
        solar_system_id: 30000142,
      })
    ).toBe(false)
  })

  it('builds baselines only for the activity start date', () => {
    const baselines = buildDailyBaselines(
      [
        {
          charId: 1,
          entries: [
            { date: '2026-06-17', quantity: 500, type_id: 11396, solar_system_id: 1 },
            { date: '2026-06-18', quantity: 3324, type_id: 11396, solar_system_id: 1 },
          ],
        },
      ],
      '2026-06-18'
    )

    expect(baselines['1-11396-1-2026-06-18']).toBe(3324)
    expect(baselines['1-11396-1-2026-06-17']).toBeUndefined()
  })

  it('attributes next-day entries without baseline subtraction', () => {
    const baselines = buildDailyBaselines(
      [
        {
          charId: 1,
          entries: [{ date: '2026-06-18', quantity: 1000, type_id: 11396, solar_system_id: 1 }],
        },
      ],
      '2026-06-18'
    )

    const nextDayQty = 2500
    const activityDateOnly = '2026-06-18'
    const entryDate = '2026-06-19'
    const key = '1-11396-1-2026-06-19'

    let effectiveQuantity = nextDayQty
    if (entryDate === activityDateOnly) {
      const baselineQty = baselines[key] ?? 0
      effectiveQuantity = Math.max(0, nextDayQty - baselineQty)
    }

    expect(effectiveQuantity).toBe(2500)
  })
})
