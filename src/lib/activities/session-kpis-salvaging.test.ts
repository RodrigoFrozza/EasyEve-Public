import { getSalvagingBatchCount, getSalvagingItemCount } from './session-kpis'

describe('salvaging session KPI helpers', () => {
  it('counts manual salvage and auto loot logs as batches', () => {
    const logs = [
      { type: 'salvage', items: [{ quantity: 10 }] },
      { type: 'loot-auto', items: [{ quantity: 5 }] },
      { type: 'note' },
    ] as any[]

    expect(getSalvagingBatchCount(logs)).toBe(2)
    expect(getSalvagingItemCount(logs)).toBe(15)
  })
})
