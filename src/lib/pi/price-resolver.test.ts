import { composePriceMap } from '@/lib/pi/price-resolver'
import type { MarketDepth } from '@/lib/market-prices'

function depth(sell: Array<[number, number]>, buy: Array<[number, number]>): MarketDepth {
  return {
    sell: sell.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    buy: buy.map(([price, volume]) => ({ price, volume, locationId: 0 })),
    updatedAt: Date.now(),
  }
}

const noDemand = new Map<number, number>()
const noSupply = new Map<number, number>()

describe('composePriceMap', () => {
  it('default (home_region, no structures) uses region top-of-book with Jita fallback', () => {
    const { priceMap, provenance } = composePriceMap(
      [1, 2],
      {
        regionDepth: { 1: depth([[100, 50]], [[90, 50]]) }, // type 2 absent → Jita
        jita: { 1: { buy: 80, sell: 110 }, 2: { buy: 5, sell: 7 } },
        sellSource: 'home_region',
      },
      noDemand,
      noSupply
    )
    expect(priceMap[1]).toMatchObject({ buy: 90, sell: 100 })
    expect(provenance[1]).toEqual({ buy: 'region', sell: 'region' })
    // type 2 has no region depth → falls back to Jita scalars
    expect(priceMap[2]).toMatchObject({ buy: 5, sell: 7 })
    expect(provenance[2]).toEqual({ buy: 'jita', sell: 'jita' })
  })

  it('buys inputs from the structure market when available', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: { 1: depth([[100, 50]], [[90, 50]]) },
        jita: { 1: { buy: 80, sell: 110 } },
        buyStructureDepth: { 1: depth([[70, 40]], [[65, 40]]) },
        sellSource: 'home_region',
      },
      new Map([[1, 30]]),
      noSupply
    )
    // buy (bid) comes from the structure book, not region
    expect(priceMap[1]!.buy).toBe(65)
    expect(provenance[1]!.buy).toBe('structure')
    // instant buy walks the structure's asks
    expect(priceMap[1]!.weightedAsk).toBe(70)
    // sell still from region
    expect(priceMap[1]!.sell).toBe(100)
  })

  it('sells at Jita split when configured', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: { 1: depth([[100, 50]], [[90, 50]]) },
        jita: { 1: { buy: 80, sell: 120 } },
        sellSource: 'jita_split',
      },
      noDemand,
      noSupply
    )
    expect(priceMap[1]!.sell).toBe((80 + 120) / 2)
    expect(provenance[1]!.sell).toBe('jita')
  })

  it('falls back to the manual reference price when no market has orders', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: {},
        sellSource: 'home_region',
        referencePrices: { 1: 4200 },
      },
      noDemand,
      noSupply
    )
    expect(priceMap[1]).toMatchObject({ buy: 4200, sell: 4200 })
    expect(provenance[1]).toEqual({ buy: 'reference', sell: 'reference' })
  })
})

// Flag PI_HUB_SOURCING ON → escolha por preço (c503a29d). Regressão: estes testes
// existentes continuam passando quando a flag é passada explicitamente ligada.
describe('composePriceMap — hub sourcing by price ON (Entrega 3, Tarefa 1)', () => {
  const ON = true

  // 1. Cheapest in Jita, with stock in both → Jita wins.
  it('picks the cheapest hub when both cover the demand (Jita cheaper → Jita)', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: { 1: { buy: 70, sell: 80 } },
        buyStructureDepth: { 1: depth([[100, 1000]], [[95, 1000]]) }, // pricier structure
        sellSource: 'home_region',
      },
      new Map([[1, 50]]),
      noSupply,
      ON
    )
    expect(priceMap[1]!.weightedAsk).toBe(80) // Jita's 80 beats the structure's 100
    expect(provenance[1]!.buy).toBe('jita')
    expect(priceMap[1]!.buy).toBe(70)
  })

  // 2. Cheapest hub can't cover the demand → skip it, use one that can.
  // (Jita is scalar/assumed-deep, so the "out of stock" hub is a walkable depth.)
  it('skips a cheaper hub that cannot cover the demand and uses one that can', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: { 1: depth([[80, 10]], [[75, 10]]) }, // cheap but only 10 units
        jita: {},
        buyStructureDepth: { 1: depth([[100, 1000]], [[95, 1000]]) }, // pricier, deep
        sellSource: 'home_region',
      },
      new Map([[1, 50]]), // need 50; region covers only 10
      noSupply,
      ON
    )
    expect(provenance[1]!.buy).toBe('structure')
    expect(priceMap[1]!.weightedAsk).toBe(100)
  })

  // 3. Item exists only in the structure → structure wins (current behavior kept).
  it('uses the only hub that has a book', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: {},
        buyStructureDepth: { 1: depth([[90, 100]], [[85, 100]]) },
        sellSource: 'home_region',
      },
      new Map([[1, 20]]),
      noSupply,
      ON
    )
    expect(provenance[1]!.buy).toBe('structure')
    expect(priceMap[1]!.weightedAsk).toBe(90)
    expect(priceMap[1]!.buy).toBe(85)
  })

  // 4. No hub has a book but a reference price exists → use it, provenance 'reference'.
  it('falls back to the reference price when no hub has a book', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      { regionDepth: {}, jita: {}, sellSource: 'home_region', referencePrices: { 1: 4200 } },
      new Map([[1, 20]]),
      noSupply,
      ON
    )
    expect(priceMap[1]!.buy).toBe(4200)
    expect(priceMap[1]!.weightedAsk).toBe(4200)
    expect(provenance[1]!.buy).toBe('reference')
  })

  // 5. No hub, no reference → zero + provenance 'none' (never invent a value).
  it('yields zero with provenance none when there is no book and no reference', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      { regionDepth: {}, jita: {}, sellSource: 'home_region' },
      new Map([[1, 20]]),
      noSupply,
      ON
    )
    expect(priceMap[1]!.buy).toBe(0)
    expect(priceMap[1]!.weightedAsk).toBe(0)
    expect(provenance[1]!.buy).toBe('none')
  })

  // The secondary structure is now a real candidate, not display-only.
  it('brings the secondary structure into the decision (cheapest structure wins)', () => {
    const { priceMap } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: {},
        buyStructureDepth: { 1: depth([[120, 1000]], [[110, 1000]]) }, // primary pricier
        secondaryStructureDepth: { 1: depth([[90, 1000]], [[85, 1000]]) }, // secondary cheaper
        sellSource: 'home_region',
      },
      new Map([[1, 50]]),
      noSupply,
      ON
    )
    expect(priceMap[1]!.weightedAsk).toBe(90) // secondary's 90 beats primary's 120
  })
})

// Flag PI_HUB_SOURCING OFF (default) → comportamento pré-c503a29d: primeiro hub COM
// BOOK, por disponibilidade (structure → region → Jita → reference), NÃO por preço.
describe('composePriceMap — hub sourcing OFF (default, pré-c503a29d)', () => {
  // 1 + 3. Múltiplos hubs cobrem a demanda: escolhe o primeiro da ordem antiga
  // (structure), NÃO o mais barato (Jita). Prova byte a byte do comportamento antigo.
  it('escolhe o primeiro hub com book (structure), não o mais barato (Jita)', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: { 1: { buy: 70, sell: 80 } }, // mais barato, mas ignorado pela ordem
        buyStructureDepth: { 1: depth([[100, 1000]], [[95, 1000]]) },
        sellSource: 'home_region',
      },
      new Map([[1, 50]]),
      noSupply
      // sem 5º arg → flag OFF (default)
    )
    expect(provenance[1]!.buy).toBe('structure')
    expect(priceMap[1]!.buy).toBe(95) // bestBid da structure
    expect(priceMap[1]!.weightedAsk).toBe(100) // anda os asks da structure
  })

  // A estrutura secundária era display-only antes do c503a29d → OFF a ignora.
  it('ignora a estrutura secundária (era display-only)', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: {},
        buyStructureDepth: { 1: depth([[120, 1000]], [[110, 1000]]) }, // primária, mais cara
        secondaryStructureDepth: { 1: depth([[90, 1000]], [[85, 1000]]) }, // ignorada no OFF
        sellSource: 'home_region',
      },
      new Map([[1, 50]]),
      noSupply,
      false
    )
    expect(provenance[1]!.buy).toBe('structure')
    expect(priceMap[1]!.buy).toBe(110) // primária, não a secundária (85)
    expect(priceMap[1]!.weightedAsk).toBe(120)
  })

  // Sem structure nem region → cai para Jita por disponibilidade.
  it('cai para Jita quando structure e region não têm book', () => {
    const { priceMap, provenance } = composePriceMap(
      [1],
      { regionDepth: {}, jita: { 1: { buy: 80, sell: 110 } }, sellSource: 'home_region' },
      new Map([[1, 20]]),
      noSupply,
      false
    )
    expect(provenance[1]!.buy).toBe('jita')
    expect(priceMap[1]!.buy).toBe(80)
    expect(priceMap[1]!.weightedAsk).toBe(110)
  })

  // Mesma entrada da suíte ON teste 1: OFF e ON divergem (a flag realmente decide).
  it('diverge do modo ON para a mesma entrada (a flag decide qual roda)', () => {
    const sources = {
      regionDepth: {},
      jita: { 1: { buy: 70, sell: 80 } },
      buyStructureDepth: { 1: depth([[100, 1000]], [[95, 1000]]) },
      sellSource: 'home_region' as const,
    }
    const demand = new Map([[1, 50]])
    const off = composePriceMap([1], sources, demand, noSupply, false)
    const on = composePriceMap([1], sources, demand, noSupply, true)
    expect(off.provenance[1]!.buy).toBe('structure')
    expect(on.provenance[1]!.buy).toBe('jita')
    expect(off.priceMap[1]!.weightedAsk).not.toBe(on.priceMap[1]!.weightedAsk)
  })
})
