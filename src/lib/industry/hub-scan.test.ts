import type { MarketDepth } from '@/lib/market-prices'
import type { IndustryHub } from '@/lib/industry/config-store'

const mockResolveNamesToTypes = jest.fn()
const mockResolveHubDepth = jest.fn()

jest.mock('@/lib/appraisal/resolve-names', () => ({
  resolveNamesToTypes: (...args: unknown[]) => mockResolveNamesToTypes(...args),
}))

jest.mock('@/lib/industry/market-depth', () => ({
  resolveHubDepth: (...args: unknown[]) => mockResolveHubDepth(...args),
}))

function hub(id: string, name: string): IndustryHub {
  return { kind: 'region', id, name }
}

function depth(sell: { price: number; volume: number }[], buy: { price: number; volume: number }[] = []): MarketDepth {
  return {
    sell: sell.map((l) => ({ ...l, locationId: 1 })),
    buy: buy.map((l) => ({ ...l, locationId: 1 })),
    updatedAt: Date.now(),
  }
}

describe('computeHubScan', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when zero hubs are configured, instead of returning a fake empty-success', async () => {
    const { computeHubScan } = await import('./hub-scan')
    await expect(
      computeHubScan({ text: 'Tritanium\t100', hubs: [], characterIds: [] })
    ).rejects.toThrow()
    expect(mockResolveNamesToTypes).not.toHaveBeenCalled()
  })

  it('throws when nothing parses from the pasted text', async () => {
    const { computeHubScan } = await import('./hub-scan')
    await expect(
      computeHubScan({ text: '   \n  \n', hubs: [hub('10000002', 'Jita')], characterIds: [] })
    ).rejects.toThrow()
  })

  it('aggregates duplicate pasted lines for the same item by typeId', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([
        ['tritanium', { typeId: 34, name: 'Tritanium', volume: 0.01, groupName: 'Mineral' }],
      ]),
      unresolved: [],
    })
    mockResolveHubDepth.mockResolvedValue({
      hubId: '10000002',
      hubName: 'Jita',
      depth: { 34: depth([{ price: 5, volume: 1000 }]) },
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100\nTritanium\t50',
      hubs: [hub('10000002', 'Jita')],
      characterIds: [],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.quantity).toBe(150)
    // resolveHubDepth is called with the aggregated typeId list, once per hub.
    expect(mockResolveHubDepth).toHaveBeenCalledTimes(1)
    expect(mockResolveHubDepth).toHaveBeenCalledWith(hub('10000002', 'Jita'), [], [34])
  })

  it('flags a hub with insufficient stock as sufficient:false while still showing the partial fill', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }]]),
      unresolved: [],
    })
    mockResolveHubDepth.mockResolvedValue({
      hubId: '10000002',
      hubName: 'Jita',
      depth: { 34: depth([{ price: 5, volume: 40 }]) }, // only 40 available, need 100
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100',
      hubs: [hub('10000002', 'Jita')],
      characterIds: [],
    })

    const [item] = result.items
    const [hubResult] = item!.hubs
    expect(hubResult!.buy.sufficient).toBe(false)
    expect(hubResult!.buy.filledQty).toBe(40)
    expect(hubResult!.buy.avgUnitPrice).toBe(5)
  })

  it('returns a valid empty fill (not a crash) when a hub has zero orders for the item', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }]]),
      unresolved: [],
    })
    mockResolveHubDepth.mockResolvedValue({
      hubId: '10000002',
      hubName: 'Jita',
      depth: {}, // no depth entry at all for typeId 34
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100',
      hubs: [hub('10000002', 'Jita')],
      characterIds: [],
    })

    const [hubResult] = result.items[0]!.hubs
    expect(hubResult!.buy).toEqual({
      requestedQty: 100,
      filledQty: 0,
      sufficient: false,
      avgUnitPrice: 0,
      bestUnitPrice: 0,
    })
    expect(result.items[0]!.cheapestBuyHubId).toBeNull()
    expect(result.items[0]!.anySufficient).toBe(false)
  })

  it('picks the lowest avg-cost hub that can FULLY fill the order as cheapestBuyHubId, ignoring a cheaper-but-insufficient hub', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }]]),
      unresolved: [],
    })
    mockResolveHubDepth.mockImplementation(async (h: IndustryHub) => {
      if (h.id === 'cheap-thin') {
        // Cheapest price but can't fill the full 100 units needed.
        return { hubId: h.id, hubName: h.name, depth: { 34: depth([{ price: 1, volume: 10 }]) } }
      }
      // More expensive but fully covers the order.
      return { hubId: h.id, hubName: h.name, depth: { 34: depth([{ price: 5, volume: 1000 }]) } }
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100',
      hubs: [hub('cheap-thin', 'Thin Hub'), hub('deep', 'Deep Hub')],
      characterIds: [],
    })

    expect(result.items[0]!.anySufficient).toBe(true)
    expect(result.items[0]!.cheapestBuyHubId).toBe('deep')
  })

  it('falls back sanely to the best partial-fill hub (with all hub data still shown) when no hub can fully fill the order', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }]]),
      unresolved: [],
    })
    mockResolveHubDepth.mockImplementation(async (h: IndustryHub) => {
      if (h.id === 'hub-a') {
        return { hubId: h.id, hubName: h.name, depth: { 34: depth([{ price: 10, volume: 20 }]) } }
      }
      return { hubId: h.id, hubName: h.name, depth: { 34: depth([{ price: 8, volume: 30 }]) } }
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100',
      hubs: [hub('hub-a', 'Hub A'), hub('hub-b', 'Hub B')],
      characterIds: [],
    })

    const item = result.items[0]!
    expect(item.anySufficient).toBe(false)
    // Both hubs are partial fills; hub-b has the cheaper avg unit price (8 < 10).
    expect(item.cheapestBuyHubId).toBe('hub-b')
    // Every configured hub's data is still present, not truncated.
    expect(item.hubs).toHaveLength(2)
  })

  it('surfaces unresolved pasted names without dropping them or blocking resolved items', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }]]),
      unresolved: ['Definitely Not A Real Item'],
    })
    mockResolveHubDepth.mockResolvedValue({
      hubId: '10000002',
      hubName: 'Jita',
      depth: { 34: depth([{ price: 5, volume: 1000 }]) },
    })

    const result = await computeHubScan({
      text: 'Tritanium\t100\nDefinitely Not A Real Item\t1',
      hubs: [hub('10000002', 'Jita')],
      characterIds: [],
    })

    expect(result.unresolvedNames).toEqual(['Definitely Not A Real Item'])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]!.name).toBe('Tritanium')
  })

  it('fetches every hub in parallel (one resolveHubDepth call per hub, not per item×hub)', async () => {
    const { computeHubScan } = await import('./hub-scan')
    mockResolveNamesToTypes.mockResolvedValue({
      resolved: new Map([
        ['tritanium', { typeId: 34, name: 'Tritanium', volume: null, groupName: null }],
        ['pyerite', { typeId: 35, name: 'Pyerite', volume: null, groupName: null }],
      ]),
      unresolved: [],
    })
    mockResolveHubDepth.mockImplementation(async (h: IndustryHub) => ({
      hubId: h.id,
      hubName: h.name,
      depth: { 34: depth([{ price: 5, volume: 1000 }]), 35: depth([{ price: 10, volume: 1000 }]) },
    }))

    const hubs = [hub('h1', 'Hub 1'), hub('h2', 'Hub 2'), hub('h3', 'Hub 3')]
    const result = await computeHubScan({
      text: 'Tritanium\t100\nPyerite\t50',
      hubs,
      characterIds: [],
    })

    // Exactly one call per hub — never one per (item, hub) pair.
    expect(mockResolveHubDepth).toHaveBeenCalledTimes(hubs.length)
    expect(result.hubsScanned).toEqual([
      { hubId: 'h1', hubName: 'Hub 1' },
      { hubId: 'h2', hubName: 'Hub 2' },
      { hubId: 'h3', hubName: 'Hub 3' },
    ])
    expect(result.items).toHaveLength(2)
    expect(result.items.every((i) => i.hubs.length === hubs.length)).toBe(true)
  })
})
