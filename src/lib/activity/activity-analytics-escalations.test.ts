import { buildEscalationsComposition } from './activity-analytics'

describe('buildEscalationsComposition', () => {
  it('deducts tax logs from the cost slice, matching buildEscalationsTimelines', () => {
    const logs = [
      { date: '2026-01-01T10:00:00Z', type: 'bounty', amount: 100 },
      { date: '2026-01-01T10:05:00Z', type: 'escalation-buy', amount: -20 },
      { date: '2026-01-01T10:10:00Z', type: 'tax', amount: -5 },
    ]

    const slices = buildEscalationsComposition(logs)
    const cost = slices.find((s) => s.kind === 'deduction')

    expect(cost?.value).toBe(25)
  })
})
