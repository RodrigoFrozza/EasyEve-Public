import {
  appendMtuEntry,
  appendSalvageEntry,
  deleteManualEntry,
  type RattingActivityData,
  type RattingLootItem,
} from './ratting-manual-entries'

describe('appendMtuEntry', () => {
  it('sums totalValue (not value) for the log amount and estimatedLootValue', () => {
    const items: RattingLootItem[] = [
      { name: 'Tritanium', quantity: 100, typeId: 34, unitPrice: 5, totalValue: 500 },
      { name: 'Pyerite', quantity: 10, typeId: 35, unitPrice: 12, totalValue: 120 },
    ]

    const result = appendMtuEntry({}, items, 'Pilot')

    expect(result.logs?.[0]).toEqual(
      expect.objectContaining({ type: 'mtu', amount: 620, charName: 'Pilot' })
    )
    expect(result.mtuContents).toEqual([items])
    expect(result.estimatedLootValue).toBe(620)
  })

  it('ignores a stray legacy value field on the item shape', () => {
    const items: RattingLootItem[] = [
      { name: 'Tritanium', quantity: 100, value: 999, unitPrice: 5, totalValue: 500 },
    ]

    const result = appendMtuEntry({}, items, 'Pilot')

    expect(result.logs?.[0].amount).toBe(500)
  })
})

describe('appendSalvageEntry', () => {
  it('sums totalValue (not value) for the log amount and estimatedSalvageValue', () => {
    const items: RattingLootItem[] = [
      { name: 'Metal Scraps', quantity: 20, typeId: 25595, unitPrice: 3, totalValue: 60 },
    ]

    const result = appendSalvageEntry({}, items, 'Pilot')

    expect(result.logs?.[0]).toEqual(
      expect.objectContaining({ type: 'salvage', amount: 60, charName: 'Pilot' })
    )
    expect(result.salvageContents).toEqual([items])
    expect(result.estimatedSalvageValue).toBe(60)
  })
})

describe('deleteManualEntry with the canonical item shape', () => {
  it('removes the mtu entry and its content bucket together', () => {
    const items: RattingLootItem[] = [
      { name: 'Tritanium', quantity: 100, typeId: 34, unitPrice: 5, totalValue: 500 },
    ]
    const withEntry = appendMtuEntry({}, items, 'Pilot')
    const refId = withEntry.logs?.[0].refId as string

    const result = deleteManualEntry(withEntry as RattingActivityData, refId, 'mtu')

    expect(result?.logs).toEqual([])
    expect(result?.mtuContents).toEqual([])
    expect(result?.estimatedLootValue).toBe(0)
  })
})
