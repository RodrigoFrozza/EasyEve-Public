import { calculateLootDelta, calculateAbyssalDelta, parseEVECargoEntries } from './eve-cargo-parser'

function entriesOf(text: string) {
  return Array.from(parseEVECargoEntries(text).values())
}

describe('parseEVECargoEntries "Qty x Item" / "Item xQty" formats', () => {
  it('parses "Qty x Item" lines (MTU/salvage paste placeholder format)', () => {
    expect(
      entriesOf('1 x Kinetic Armor plating\n5 x Rookie ship\n10 x Shrouded Weapon')
    ).toEqual([
      { displayName: 'Kinetic Armor plating', quantity: 1 },
      { displayName: 'Rookie ship', quantity: 5 },
      { displayName: 'Shrouded Weapon', quantity: 10 },
    ])
  })

  it('parses "Item xQty" lines', () => {
    expect(
      entriesOf('Kinetic Armor plating x1\nRookie ship x5\nShrouded Weapon x10')
    ).toEqual([
      { displayName: 'Kinetic Armor plating', quantity: 1 },
      { displayName: 'Rookie ship', quantity: 5 },
      { displayName: 'Shrouded Weapon', quantity: 10 },
    ])
  })

  it('parses "Item Qty" lines without an x separator', () => {
    expect(entriesOf('Damaged Armor Plate 3')).toEqual([
      { displayName: 'Damaged Armor Plate', quantity: 3 },
    ])
  })

  it('parses thousand-separated quantities in tab-separated rows without inflating them', () => {
    expect(entriesOf('Tritanium\t1.234\tMineral\t1234 m3')).toEqual([
      { displayName: 'Tritanium', quantity: 1234 },
    ])
    expect(entriesOf('Tritanium\t1,234\tMineral\t1234 m3')).toEqual([
      { displayName: 'Tritanium', quantity: 1234 },
    ])
  })
})

describe('eve-cargo-parser', () => {
  it('preserves original item name casing in loot delta', () => {
    const before = 'Ancient Relic\t1\tRelic\t1 m3'
    const after =
      'Ancient Relic\t1\tRelic\t1 m3\nIntact Armor Plates\t3\tMaterial\t3 m3'

    expect(calculateLootDelta(before, after)).toEqual([
      { name: 'Intact Armor Plates', quantity: 3 },
    ])
  })

  it('matches item names case-insensitively when computing delta', () => {
    const before = 'intact armor plates\t1\tMaterial\t1 m3'
    const after = 'Intact Armor Plates\t4\tMaterial\t4 m3'

    expect(calculateLootDelta(before, after)).toEqual([
      { name: 'Intact Armor Plates', quantity: 3 },
    ])
  })

  it('preserves casing in abyssal gained loot', () => {
    const before = ''
    const after = 'Capacitor Power Relay\t2\tModule\t2 m3'

    expect(calculateAbyssalDelta(before, after).loot).toEqual([
      { name: 'Capacitor Power Relay', quantity: 2 },
    ])
  })
})
