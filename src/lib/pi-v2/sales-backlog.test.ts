import { buildSalesBacklog, type OwnOutstandingContract } from './sales-backlog'

const STERILE_CONDUITS = 2875
const INDUSTRIAL_EXPLOSIVES = 2360
const NOT_TRACKED = 34 // Tritanium — not PI at all, must never appear

describe('buildSalesBacklog', () => {
  it('sums container + contract quantity for the same item', () => {
    const contracts: OwnOutstandingContract[] = [
      { contractId: 1, characterId: 100, items: [{ typeId: STERILE_CONDUITS, quantity: 40 }] },
    ]
    const backlog = buildSalesBacklog({
      containerStock: { [STERILE_CONDUITS]: 60 },
      containerIncomplete: false,
      contracts,
      contractsIncomplete: false,
    })

    expect(backlog.items).toHaveLength(1)
    expect(backlog.items[0]).toMatchObject({
      typeId: STERILE_CONDUITS,
      containerQty: 60,
      contractQty: 40,
      totalQty: 100,
    })
    expect(backlog.incomplete).toBe(false)
  })

  it('includes an item present only in contracts, or only in a container', () => {
    const contracts: OwnOutstandingContract[] = [
      { contractId: 1, characterId: 100, items: [{ typeId: INDUSTRIAL_EXPLOSIVES, quantity: 10 }] },
    ]
    const backlog = buildSalesBacklog({
      containerStock: { [STERILE_CONDUITS]: 5 },
      containerIncomplete: false,
      contracts,
      contractsIncomplete: false,
    })

    const byType = new Map(backlog.items.map((i) => [i.typeId, i]))
    expect(byType.get(STERILE_CONDUITS)).toMatchObject({ containerQty: 5, contractQty: 0 })
    expect(byType.get(INDUSTRIAL_EXPLOSIVES)).toMatchObject({ containerQty: 0, contractQty: 10 })
  })

  it('drops items outside the closed sale-tracked list, from both sources', () => {
    const contracts: OwnOutstandingContract[] = [
      { contractId: 1, characterId: 100, items: [{ typeId: NOT_TRACKED, quantity: 999 }] },
    ]
    const backlog = buildSalesBacklog({
      containerStock: { [NOT_TRACKED]: 999 },
      containerIncomplete: false,
      contracts,
      contractsIncomplete: false,
    })

    expect(backlog.items).toHaveLength(0)
  })

  it('flags incomplete when a sell container failed to read', () => {
    const backlog = buildSalesBacklog({
      containerStock: {},
      containerIncomplete: true,
      contracts: [],
      contractsIncomplete: false,
    })
    expect(backlog.incomplete).toBe(true)
  })

  it('flags incomplete when a character contract fetch failed', () => {
    const backlog = buildSalesBacklog({
      containerStock: {},
      containerIncomplete: false,
      contracts: [],
      contractsIncomplete: true,
    })
    expect(backlog.incomplete).toBe(true)
  })

  it('sums quantities across multiple contracts of the same item', () => {
    const contracts: OwnOutstandingContract[] = [
      { contractId: 1, characterId: 100, items: [{ typeId: STERILE_CONDUITS, quantity: 20 }] },
      { contractId: 2, characterId: 200, items: [{ typeId: STERILE_CONDUITS, quantity: 15 }] },
    ]
    const backlog = buildSalesBacklog({
      containerStock: {},
      containerIncomplete: false,
      contracts,
      contractsIncomplete: false,
    })
    expect(backlog.items[0]).toMatchObject({ contractQty: 35, totalQty: 35 })
  })

  it('returns no items and incomplete=false for an empty backlog', () => {
    const backlog = buildSalesBacklog({
      containerStock: {},
      containerIncomplete: false,
      contracts: [],
      contractsIncomplete: false,
    })
    expect(backlog.items).toEqual([])
    expect(backlog.incomplete).toBe(false)
  })
})
