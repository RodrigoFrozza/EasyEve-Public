import { getKpiGridClass } from './ActivityAnalyticsKpiRow'

describe('getKpiGridClass', () => {
  it('gives the 6-column KPI row (ratting) more columns at the lg breakpoint than the 3-column row', () => {
    const six = getKpiGridClass(6)
    const three = getKpiGridClass(3)

    expect(six).not.toBe(three)
    expect(six).toContain('lg:grid-cols-6')
  })

  it('keeps the 3-column layout capped at 3 columns', () => {
    expect(getKpiGridClass(3)).toBe('grid-cols-2 sm:grid-cols-3')
  })

  it('keeps the 2-column layout single-row on all breakpoints', () => {
    expect(getKpiGridClass(2)).toBe('grid-cols-2')
  })

  it('falls back to the default 4-column layout', () => {
    expect(getKpiGridClass(4)).toBe('grid-cols-2 sm:grid-cols-4')
  })
})
