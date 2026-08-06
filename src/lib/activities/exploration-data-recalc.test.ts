import {
  explorationLootDataChanged,
  recalcExplorationLootTotalsFromLogs,
} from './exploration-data-recalc'

describe('exploration-data-recalc', () => {
  it('recalculates totalLootValue and currentCargoValue from site and loot logs', () => {
    const totals = recalcExplorationLootTotalsFromLogs([
      { type: 'site', value: 1000 },
      { type: 'loot', amount: 500, value: 500 },
      { type: 'death', value: 9999 },
    ])

    expect(totals.totalLootValue).toBe(1500)
    expect(totals.currentCargoValue).toBe(1500)
  })

  it('detects loot data changes for reconcile', () => {
    const previous = {
      totalLootValue: 1000,
      logs: [{ refId: 'site-1', type: 'site', value: 1000 }],
    }
    const next = {
      totalLootValue: 1500,
      logs: [{ refId: 'site-1', type: 'site', value: 1500 }],
    }

    expect(explorationLootDataChanged(previous, next)).toBe(true)
    expect(explorationLootDataChanged(next, next)).toBe(false)
  })
})
