import {
  buildRattingComposition,
  buildRattingTimelines,
  getRattingLogSignedValue,
  normalizeRattingLogType,
} from './activity-analytics'

describe('normalizeRattingLogType', () => {
  it('classifies loot-auto as loot', () => {
    expect(normalizeRattingLogType('loot-auto')).toBe('loot')
  })

  it('classifies mtu and salvage as loot', () => {
    expect(normalizeRattingLogType('mtu')).toBe('loot')
    expect(normalizeRattingLogType('salvage')).toBe('loot')
  })

  it('classifies escalation and expense', () => {
    expect(normalizeRattingLogType('escalation')).toBe('escalation')
    expect(normalizeRattingLogType('expense')).toBe('expense')
  })
})

describe('getRattingLogSignedValue', () => {
  it('returns negative amount for expenses', () => {
    expect(getRattingLogSignedValue({ date: '', type: 'expense', amount: 50_000_000 })).toBe(
      -50_000_000
    )
  })

  it('ignores unsold escalations', () => {
    expect(
      getRattingLogSignedValue({
        date: '',
        type: 'escalation',
        amount: 0,
        escalationStatus: 'dropped',
      })
    ).toBe(0)
  })

  it('counts sold escalations', () => {
    expect(
      getRattingLogSignedValue({
        date: '',
        type: 'escalation',
        amount: 120_000_000,
        escalationStatus: 'sold',
      })
    ).toBe(120_000_000)
  })
})

describe('buildRattingComposition', () => {
  it('includes DED escalations and expenses', () => {
    const slices = buildRattingComposition([
      { date: '2026-01-01', type: 'bounty', amount: 100 },
      { date: '2026-01-02', type: 'escalation', amount: 50, escalationStatus: 'sold' },
      { date: '2026-01-03', type: 'expense', amount: 20 },
    ])

    expect(slices.find((s) => s.labelKey === 'chartEscalation')?.value).toBe(50)
    expect(slices.find((s) => s.labelKey === 'chartExpense')?.value).toBe(20)
    expect(slices.find((s) => s.labelKey === 'chartExpense')?.kind).toBe('deduction')
  })
})

describe('buildRattingTimelines', () => {
  it('subtracts expenses from net timeline', () => {
    const tl = buildRattingTimelines([
      { date: '2026-01-01T10:00:00Z', type: 'bounty', amount: 100 },
      { date: '2026-01-01T11:00:00Z', type: 'expense', amount: 30 },
    ])

    expect(tl.gross).toEqual([100, 100])
    expect(tl.net).toEqual([100, 70])
    expect(tl.expense).toEqual([0, 30])
  })
})
