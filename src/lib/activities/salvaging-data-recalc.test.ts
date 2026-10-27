import {
  recalcSalvagingLootTotalsFromLogs,
  salvagingLootDataChanged,
} from './salvaging-data-recalc'

describe('salvaging-data-recalc', () => {
  it('recalculates totals from salvage and loot-auto logs', () => {
    const totals = recalcSalvagingLootTotalsFromLogs([
      { type: 'salvage', value: 100, items: [{ quantity: 2 }] },
      { type: 'loot-auto', value: 50, items: [{ quantity: 1 }] },
      { type: 'death', value: 9999 },
    ])

    expect(totals.totalLootValue).toBe(150)
    expect(totals.batchesCompleted).toBe(2)
    expect(totals.totalItems).toBe(3)
    expect(totals.currentCargoValue).toBe(150)
  })

  it('detects loot data changes for reconcile', () => {
    const previous = {
      totalLootValue: 100,
      batchesCompleted: 1,
      logs: [{ refId: 'salvage-1', type: 'salvage', value: 100 }],
    }
    const next = {
      totalLootValue: 150,
      batchesCompleted: 1,
      logs: [{ refId: 'salvage-1', type: 'salvage', value: 150 }],
    }

    expect(salvagingLootDataChanged(previous, next)).toBe(true)
    expect(salvagingLootDataChanged(next, next)).toBe(false)
  })
})
