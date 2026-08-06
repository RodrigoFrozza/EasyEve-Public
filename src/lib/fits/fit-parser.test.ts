import { FitParser } from './fit-parser'
import type { Module } from '@/types/fit'

describe('FitParser.toEFT', () => {
  it('writes the header as [Ship, Fit Name]', () => {
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587, name: 'My Rifter' })
    expect(eft.split('\n')[0]).toBe('[Rifter, My Rifter]')
  })

  it('falls back to a default fit name when none is given', () => {
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587 })
    expect(eft.split('\n')[0]).toBe('[Rifter, EasyEve Fit]')
  })

  it('includes the loaded charge as "Module, Charge"', () => {
    const modules: Module[] = [
      {
        typeId: 2929,
        name: '200mm AutoCannon II',
        slot: 'high',
        slotIndex: 0,
        charge: { id: 12625, name: 'Barrage S', quantity: 1 },
      },
    ]
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587, name: 'x', modules })
    expect(eft).toContain('200mm AutoCannon II, Barrage S')
  })

  it('marks offline modules with /offline', () => {
    const modules: Module[] = [
      { typeId: 578, name: 'Small Armor Repairer II', slot: 'low', slotIndex: 0, offline: true },
    ]
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587, name: 'x', modules })
    expect(eft).toContain('Small Armor Repairer II /offline')
  })

  it('orders modules within a rack by slotIndex', () => {
    const modules: Module[] = [
      { typeId: 2, name: 'Second', slot: 'high', slotIndex: 1 },
      { typeId: 1, name: 'First', slot: 'high', slotIndex: 0 },
    ]
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587, name: 'x', modules })
    expect(eft.indexOf('First')).toBeLessThan(eft.indexOf('Second'))
  })

  it('writes drones and cargo with quantities', () => {
    const eft = FitParser.toEFT({
      ship: 'Ishtar',
      shipId: 12005,
      name: 'x',
      drones: [{ id: 2456, name: 'Ogre II', quantity: 5 }],
      cargo: [{ id: 12625, name: 'Barrage S', quantity: 1000 }],
    })
    expect(eft).toContain('Ogre II x5')
    expect(eft).toContain('Barrage S x1000')
  })

  it('round-trips ship, fit name and module names through parse', () => {
    const modules: Module[] = [
      { typeId: 2929, name: '200mm AutoCannon II', slot: 'high', slotIndex: 0 },
      { typeId: 578, name: 'Small Armor Repairer II', slot: 'low', slotIndex: 0 },
    ]
    const eft = FitParser.toEFT({ ship: 'Rifter', shipId: 587, name: 'My Rifter', modules })
    const parsed = FitParser.parse(eft)[0]
    expect(parsed.shipName).toBe('Rifter')
    expect(parsed.fitName).toBe('My Rifter')
    expect(parsed.modules.map(m => m.name)).toEqual([
      '200mm AutoCannon II',
      'Small Armor Repairer II',
    ])
  })

  it('includes subsystem modules in the block', () => {
    const modules: Module[] = [
      { typeId: 45591, name: 'Loki Core - Augmented Nuclear Reactor', slot: 'subsystem', slotIndex: 0 },
    ]
    const eft = FitParser.toEFT({ ship: 'Loki', shipId: 29990, name: 'x', modules })
    expect(eft).toContain('Loki Core - Augmented Nuclear Reactor')
  })
})

describe('FitParser.parse', () => {
  it('preserves a module\'s loaded charge instead of dropping it', () => {
    const parsed = FitParser.parse('[Rifter, x]\n200mm AutoCannon II, Barrage S')[0]
    expect(parsed.modules).toHaveLength(1)
    expect(parsed.modules[0].name).toBe('200mm AutoCannon II')
    expect(parsed.modules[0].charge?.name).toBe('Barrage S')
  })

  it('marks offline modules via the /offline suffix (any case)', () => {
    const parsed = FitParser.parse('[Rifter, x]\nSmall Armor Repairer II /OFFLINE')[0]
    expect(parsed.modules[0].name).toBe('Small Armor Repairer II')
    expect(parsed.modules[0].state).toBe('passive')
  })

  it('collects every "Name xN" line as a quantity item (not as a drone)', () => {
    const parsed = FitParser.parse('[Ishtar, x]\n\nOgre II x5\n\nBarrage S x1000')[0]
    expect(parsed.quantityItems).toEqual([
      { name: 'Ogre II', quantity: 5 },
      { name: 'Barrage S', quantity: 1000 },
    ])
  })

  it('skips empty-slot placeholders', () => {
    const parsed = FitParser.parse('[Rifter, x]\n[Empty High slot]\n[Empty Subsystem slot]\nDamage Control II')[0]
    expect(parsed.modules.map(m => m.name)).toEqual(['Damage Control II'])
  })
})
