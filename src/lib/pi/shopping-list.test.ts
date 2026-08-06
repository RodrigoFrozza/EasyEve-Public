import { buildShoppingList, toMultibuyText } from '@/lib/pi/shopping-list'
import type { PiColonyAnalysis, PiCommodityBalance } from '@/lib/pi/types'

function balance(typeId: number, name: string, importNeededPerHour: number): PiCommodityBalance {
  return {
    typeId,
    name,
    tier: 2,
    demandPerHour: importNeededPerHour,
    extractionPerHour: 0,
    productionPerHour: 0,
    localSupplyPerHour: 0,
    importNeededPerHour,
    surplusPerHour: 0,
    exportedPerHour: 0,
    wastedPerHour: 0,
    isImported: importNeededPerHour > 0,
    isExportable: false,
  }
}

function colony(
  characterId: number,
  characterName: string,
  planetId: number,
  imports: PiCommodityBalance[]
): PiColonyAnalysis {
  return {
    characterId,
    characterName,
    planetId,
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    colonyRole: 'factory_only',
    solarSystemId: 1,
    solarSystemName: 'Sys',
    upgradeLevel: 5,
    numPins: 1,
    isStale: false,
    potentialNetIskPerHour: 0,
    currentNetIskPerHour: 0,
    exportRevenuePerHour: 0,
    importCostPerHour: 0,
    potentialExportRevenuePerHour: 0,
    potentialImportCostPerHour: 0,
    currentExportRevenuePerHour: 0,
    currentImportCostPerHour: 0,
    exitUnitPrice: 0,
    config: { planetId, surplusForSale: true },
    balances: { potential: imports, current: [] },
    pins: [],
    bufferStatus: { status: 'running' },
    bufferStatusCurrent: { status: 'running' },
    pinBuffers: { potential: [], current: [] },
    extractors: [],
    recipes: [],
    commodities: [],
    routing: { pins: [], routes: [] },
    warnings: [],
  }
}

describe('buildShoppingList', () => {
  it('sums imports per planet, per character, and total, scaled by period', () => {
    const colonies = [
      colony(1, 'Alice', 100, [balance(3693, 'Fertilizer', 240), balance(3695, 'Polytextiles', 240)]),
      colony(1, 'Alice', 101, [balance(3693, 'Fertilizer', 120)]),
      colony(2, 'Bob', 200, [balance(3695, 'Polytextiles', 60)]),
    ]

    const list = buildShoppingList(colonies, 24)

    // Total: Fertilizer 360/h -> 8640; Polytextiles 300/h -> 7200
    expect(list.total).toEqual([
      { typeId: 3693, name: 'Fertilizer', perHour: 360, quantity: 8640 },
      { typeId: 3695, name: 'Polytextiles', perHour: 300, quantity: 7200 },
    ])

    // Per character
    const alice = list.perCharacter.find((c) => c.characterId === 1)!
    expect(alice.items).toEqual([
      { typeId: 3693, name: 'Fertilizer', perHour: 360, quantity: 8640 },
      { typeId: 3695, name: 'Polytextiles', perHour: 240, quantity: 5760 },
    ])
    const bob = list.perCharacter.find((c) => c.characterId === 2)!
    expect(bob.items).toEqual([{ typeId: 3695, name: 'Polytextiles', perHour: 60, quantity: 1440 }])

    // Per planet
    expect(list.perPlanet).toHaveLength(3)
    expect(list.perPlanet[0]!.items.map((i) => i.name)).toContain('Fertilizer')
  })

  it('rounds fractional quantities up and skips planets with no imports', () => {
    const colonies = [
      colony(1, 'Alice', 100, [balance(3693, 'Fertilizer', 10.5)]),
      colony(1, 'Alice', 101, []), // exporter only
    ]
    const list = buildShoppingList(colonies, 3)
    expect(list.total).toEqual([{ typeId: 3693, name: 'Fertilizer', perHour: 10.5, quantity: 32 }])
    expect(list.perPlanet).toHaveLength(1)
  })

  it('never shows a raw planet id — falls back to system name, then type label', () => {
    const withName: PiColonyAnalysis = {
      ...colony(1, 'Alice', 100, [balance(3693, 'Fertilizer', 10)]),
      planetName: 'UALX-3 III',
    }
    const withoutName = colony(1, 'Alice', 101, [balance(3693, 'Fertilizer', 10)]) // planetName unresolved

    const list = buildShoppingList([withName, withoutName], 1)
    const labelFor = (planetId: number) =>
      list.perPlanet.find((p) => p.planetId === planetId)!.planetLabel

    expect(labelFor(100)).toBe('Barren — UALX-3 III')
    expect(labelFor(101)).toBe('Barren — Sys')
    expect(labelFor(101)).not.toMatch(/\d{4,}/) // no raw numeric planet id leaking through
  })

  it('keeps every character\'s planets adjacent in perPlanet, even when colonies arrive interleaved', () => {
    // Colonies come in interleaved by character (Alice, Bob, Alice) — perPlanet must
    // not mirror that order, or the Shopping List's "by planet" tab scatters a
    // character's planets apart instead of grouping them.
    const colonies = [
      colony(1, 'Alice', 100, [balance(3693, 'Fertilizer', 10)]),
      colony(2, 'Bob', 200, [balance(3693, 'Fertilizer', 10)]),
      colony(1, 'Alice', 101, [balance(3693, 'Fertilizer', 10)]),
    ]
    const list = buildShoppingList(colonies, 1)

    expect(list.perPlanet.map((p) => p.characterName)).toEqual(['Alice', 'Alice', 'Bob'])
  })

  it('formats Multibuy text as Name<TAB>Quantity per line', () => {
    const text = toMultibuyText([
      { typeId: 3693, name: 'Fertilizer', perHour: 360, quantity: 8640 },
      { typeId: 3695, name: 'Polytextiles', perHour: 300, quantity: 7200 },
    ])
    expect(text).toBe('Fertilizer\t8640\nPolytextiles\t7200')
  })
})
