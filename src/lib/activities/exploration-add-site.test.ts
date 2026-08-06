import { calculateLootDelta } from '@/lib/parsers/eve-cargo-parser'

describe('exploration add-site cargo delta', () => {
  it('detects new items from server-side before/after cargo states', () => {
    const before = 'Ancient Relic\t1\tRelic\t1 m3'
    const after = 'Ancient Relic\t1\tRelic\t1 m3\nIntact Armor Plates\t3\tMaterial\t3 m3'

    const loot = calculateLootDelta(before, after)

    expect(loot).toEqual([{ name: 'Intact Armor Plates', quantity: 3 }])
  })

  it('returns empty delta when cargo is unchanged', () => {
    const cargo = 'Ancient Relic\t1\tRelic\t1 m3'

    expect(calculateLootDelta(cargo, cargo)).toEqual([])
  })

  it('treats full after cargo as loot when before is empty', () => {
    const after = 'Intact Armor Plates\t2\tMaterial\t2 m3'

    expect(calculateLootDelta('', after)).toEqual([{ name: 'Intact Armor Plates', quantity: 2 }])
  })
})
