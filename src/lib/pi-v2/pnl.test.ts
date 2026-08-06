/**
 * P&L por colônia — a conta que responde "quanto isso rende".
 *
 * Os valores-base do imposto são os do SDE, confirmados in-game em 21/07/2026
 * (UALX-3, Skyhook a 2%): P4 = 1.200.000, P3 = 60.000, P1 = 400. Os testes usam
 * tipos reais e afirmam o tier, para nenhum número aqui depender de suposição.
 */

import { computeColonyPnl, sumPnl, type ColonyPnl } from '@/lib/pi-v2/pnl'
import { buildShoppingList } from '@/lib/pi-v2/shopping'
import { chooseHub, quoteHubs, type HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
import { getCommodityTier, getCommodityVolume } from '@/lib/pi-v2/sde'
import type { CommodityBalance } from '@/lib/pi-v2/demand'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import {
  ANCHOR_ISO,
  TYPE_WATER,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { MarketDepth } from '@/lib/market-prices'

const STERILE_CONDUITS = 2875 // P4, 50 m³
const SMARTFAB = 2351 // P3, 3 m³
const TAX = 0.02

function balance(over: Partial<CommodityBalance> & { typeId: number }): CommodityBalance {
  return {
    name: `Type ${over.typeId}`,
    tier: getCommodityTier(over.typeId),
    demandPerHour: 0,
    extractionPerHour: 0,
    productionPerHour: 0,
    localSupplyPerHour: 0,
    importNeededPerHour: 0,
    surplusPerHour: 0,
    exportedPerHour: 0,
    wastedPerHour: 0,
    isImported: false,
    isExportable: false,
    ...over,
  }
}

/** Um P4 exportado a 10/h e um P1 comprado a 100/h — números redondos de propósito. */
const BALANCES = [
  balance({ typeId: STERILE_CONDUITS, exportedPerHour: 10, isExportable: true }),
  balance({ typeId: TYPE_WATER, importNeededPerHour: 100, isImported: true }),
]

const PRICES: Record<number, number> = { [STERILE_CONDUITS]: 1_500_000 }
const INPUT_COST: Record<number, number> = { [TYPE_WATER]: 600 }

function pnl(over: Partial<Parameters<typeof computeColonyPnl>[0]> = {}): ColonyPnl {
  return computeColonyPnl({
    balances: BALANCES,
    sellUnitPrice: (typeId) => PRICES[typeId] ?? 0,
    inputCost: (typeId) =>
      INPUT_COST[typeId] != null
        ? { effectiveUnitPrice: INPUT_COST[typeId]!, hubKey: '60003760', hubLabel: 'UALX-3' }
        : null,
    volumePerUnit: getCommodityVolume,
    exportTaxRate: TAX,
    importTaxRate: TAX,
    outboundRatePerM3: 0,
    ...over,
  })
}

describe('os tipos do teste são os que eu penso que são', () => {
  it('Sterile Conduits é P4 de 50 m³ e Water é P1 de 0,19 m³', () => {
    expect(getCommodityTier(STERILE_CONDUITS)).toBe(4)
    expect(getCommodityVolume(STERILE_CONDUITS)).toBe(50)
    expect(getCommodityTier(TYPE_WATER)).toBe(1)
    expect(getCommodityVolume(TYPE_WATER)).toBeCloseTo(0.19, 6)
    expect(getCommodityTier(SMARTFAB)).toBe(3)
  })
})

describe('teste 1 — NET = receita − export tax − insumo − import tax − frete de saída', () => {
  const result = pnl()

  it('a receita bruta é unidades × preço de venda', () => {
    // 10 × 1.500.000
    expect(result.exportGrossPerHour).toBe(15_000_000)
  })

  it('o imposto de export sai do valor-base do tier, não do mercado', () => {
    // 10 × 1.200.000 (base P4) × 2% = 240.000. Sobre o mercado daria 300.000.
    expect(result.exportTaxPerHour).toBe(240_000)
  })

  it('o custo de insumo é unidades × preço EFETIVO (mercadoria + frete de entrada)', () => {
    // 100 × 600
    expect(result.inputCostPerHour).toBe(60_000)
  })

  it('o imposto de import é metade da alíquota, sobre o valor-base', () => {
    // 100 × 400 (base P1) × 2% × 0,5 = 400
    expect(result.importTaxPerHour).toBe(400)
  })

  it('vendendo no lugar, o frete de saída é 0', () => {
    expect(result.outboundFreightPerHour).toBe(0)
  })

  it('o NET fecha', () => {
    // 15.000.000 − 240.000 − 60.000 − 400 = 14.699.600
    expect(result.netPerHour).toBe(14_699_600)
    expect(result.netPerHour).toBe(
      result.exportGrossPerHour -
        result.exportTaxPerHour -
        result.inputCostPerHour -
        result.importTaxPerHour -
        result.outboundFreightPerHour
    )
  })

  it('a decomposição guarda o hub de compra — o mesmo da lista', () => {
    expect(result.inputLines[0]).toMatchObject({ hubKey: '60003760', hubLabel: 'UALX-3' })
  })
})

describe('teste 4 — vender em outro hub traz o frete de saída para o NET', () => {
  it('o frete é o volume exportado × ISK/m³ até o hub de venda', () => {
    // 10 un × 50 m³ = 500 m³/h × 800 = 400.000
    const result = pnl({ outboundRatePerM3: 800 })
    expect(result.exportVolumeM3PerHour).toBe(500)
    expect(result.outboundFreightPerHour).toBe(400_000)
    expect(result.netPerHour).toBe(14_699_600 - 400_000)
  })

  it('vender no lugar rende mais que vender fora ao mesmo preço', () => {
    // Enquanto o preço de venda não varia por destino, mover carga só tira ISK —
    // e é isso que a tela precisa dizer em vez de sugerir que exportar compensa.
    expect(pnl({ outboundRatePerM3: 800 }).netPerHour).toBeLessThan(pnl().netPerHour)
  })
})

describe('teste 5 — imposto de POCO pelo valor-base do tier', () => {
  it('import é exatamente metade do export para a mesma quantidade e alíquota', () => {
    const exportOnly = computeColonyPnl({
      balances: [balance({ typeId: SMARTFAB, exportedPerHour: 100, isExportable: true })],
      sellUnitPrice: () => 100_000,
      inputCost: () => null,
      volumePerUnit: getCommodityVolume,
      exportTaxRate: TAX,
      importTaxRate: TAX,
      outboundRatePerM3: 0,
    })
    const importOnly = computeColonyPnl({
      balances: [balance({ typeId: SMARTFAB, importNeededPerHour: 100, isImported: true })],
      sellUnitPrice: () => 0,
      inputCost: () => ({ effectiveUnitPrice: 100_000 }),
      volumePerUnit: getCommodityVolume,
      exportTaxRate: TAX,
      importTaxRate: TAX,
      outboundRatePerM3: 0,
    })
    // 100 × 60.000 (base P3) × 2% = 120.000 no export; metade no import.
    expect(exportOnly.exportTaxPerHour).toBe(120_000)
    expect(importOnly.importTaxPerHour).toBe(60_000)
    expect(importOnly.importTaxPerHour).toBe(exportOnly.exportTaxPerHour / 2)
  })

  it('alíquota 0 não cobra imposto nenhum', () => {
    const result = pnl({ exportTaxRate: 0, importTaxRate: 0 })
    expect(result.exportTaxPerHour).toBe(0)
    expect(result.importTaxPerHour).toBe(0)
  })
})

describe('teste 6 — sem book de venda não há receita atribuível', () => {
  const result = pnl({ sellUnitPrice: () => 0 })

  it('a receita não aparece, e o item sai rotulado', () => {
    expect(result.exportGrossPerHour).toBe(0)
    expect(result.unpricedExportTypeIds).toEqual([STERILE_CONDUITS])
    expect(result.exportLines).toHaveLength(0)
  })

  it('não cobra imposto de export sem receita atrás', () => {
    // Imposto sem receita seria pior que não mostrar nada: um custo inventado.
    expect(result.exportTaxPerHour).toBe(0)
  })

  it('não conta frete de saída sobre carga que não sabemos vender', () => {
    const comFrete = pnl({ sellUnitPrice: () => 0, outboundRatePerM3: 800 })
    expect(comFrete.exportVolumeM3PerHour).toBe(0)
    expect(comFrete.outboundFreightPerHour).toBe(0)
  })

  it('o custo do insumo continua contando — o NET fica negativo, não otimista', () => {
    expect(result.inputCostPerHour).toBe(60_000)
    expect(result.netPerHour).toBe(-60_400)
  })

  it('insumo sem hub nem preço sai rotulado em vez de virar lucro', () => {
    const semInsumo = pnl({ inputCost: () => null })
    expect(semInsumo.inputCostPerHour).toBe(0)
    expect(semInsumo.unpricedInputTypeIds).toEqual([TYPE_WATER])
    // O NET fica ALTO justamente porque falta custo — por isso a tela é obrigada
    // a dizer que está incompleto.
    expect(semInsumo.netPerHour).toBe(15_000_000 - 240_000)
  })
})

describe('totais do portfólio são a soma dos por-colônia', () => {
  it('somam termo a termo, sem uma segunda conta por cima', () => {
    const a = pnl()
    const b = pnl({ outboundRatePerM3: 800 })
    const totals = sumPnl([a, b])
    expect(totals.colonyCount).toBe(2)
    expect(totals.netPerHour).toBe(a.netPerHour + b.netPerHour)
    expect(totals.exportGrossPerHour).toBe(a.exportGrossPerHour + b.exportGrossPerHour)
    expect(totals.outboundFreightPerHour).toBe(400_000)
    expect(totals.coloniesWithUnpriced).toBe(0)
  })

  it('conta quantas colônias têm item sem preço — o agregado herda a incerteza', () => {
    expect(sumPnl([pnl(), pnl({ sellUnitPrice: () => 0 })]).coloniesWithUnpriced).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// A garantia número um: o P&L e a lista de compra não podem divergir.
// ---------------------------------------------------------------------------

const depth = (levels: Array<[number, number]>): MarketDepth => ({
  sell: levels.map(([price, volume]) => ({ price, volume, locationId: 1 })),
  buy: [],
  updatedAt: Date.now(),
})

function colony(): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO)
  const layout = sterileConduitsColony({ waterAmount: 0, smartfabAmount: 0, vaccinesAmount: 0 })
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId: 1,
    characterName: 'Zeca Setaum',
    planetId: 11,
    planetName: 'P11',
    solarSystemId: 1,
    solarSystemName: 'SYS',
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    projection,
    events,
    urgency: classifyColony(projection, events),
    grid: computeColonyGrid(layout, 5),
  }
}

describe('teste 2 — o custo de insumo do P&L é o da lista de compra', () => {
  const STATION = '60003760'
  // Estação barata com frete; Jita cara sem frete. O hub escolhido tem que ser o
  // mesmo nos dois caminhos, e o preço efetivo idêntico ao centavo.
  const books = new Map<number, HubBooks>([
    [
      TYPE_WATER,
      {
        stations: [
          { id: STATION, label: 'UALX-3', book: depth([[400, 9_999_999]]), freightPerM3: 800 },
        ],
        jita: { buy: 900, sell: 1000 },
      },
    ],
    [SMARTFAB, { jita: { buy: 9000, sell: 9200 } }],
    [28974, { jita: { buy: 11_000, sell: 11_500 } }],
  ])

  const list = buildShoppingList({ colonies: [colony()], periodHours: 24, booksByType: books })

  it('a mesma função, a mesma quantidade e os mesmos books dão o MESMO número', () => {
    for (const line of list.lines) {
      if (!line.chosen) continue
      const bookForType = books.get(line.typeId)!
      // O P&L cota com `quoteHubs`/`chooseHub` — exatamente o que a lista usou.
      const quote = chooseHub(
        quoteHubs(bookForType, line.quantity, line.volumePerUnit),
        bookForType.reference
      )!
      expect(quote.effectiveUnitPrice).toBe(line.chosen.effectiveUnitPrice)
      expect(quote.stationId).toBe(line.chosen.stationId)
      expect(quote.origin).toBe(line.chosen.origin)
    }
  })

  it('o custo total do P&L fecha com o da lista quando a quantidade é a mesma', () => {
    // Prova ao centavo: alimentar o P&L com a quantidade DA LISTA reproduz o
    // `goodsCost + frete linear` dela, termo a termo.
    const quotes = new Map(
      list.lines
        .filter((l) => l.chosen)
        .map((l) => [l.typeId, chooseHub(quoteHubs(books.get(l.typeId)!, l.quantity, l.volumePerUnit))!])
    )
    const asBalances = list.lines
      .filter((l) => l.chosen)
      .map((l) =>
        balance({ typeId: l.typeId, importNeededPerHour: l.quantity, isImported: true })
      )

    const result = computeColonyPnl({
      balances: asBalances,
      sellUnitPrice: () => 0,
      inputCost: (typeId) => {
        const q = quotes.get(typeId)
        return q ? { effectiveUnitPrice: q.effectiveUnitPrice } : null
      },
      volumePerUnit: getCommodityVolume,
      exportTaxRate: 0,
      importTaxRate: 0,
      outboundRatePerM3: 0,
    })

    const listCost = list.lines
      .filter((l) => l.chosen)
      .reduce((sum, l) => sum + l.quantity * l.chosen!.effectiveUnitPrice, 0)
    expect(result.inputCostPerHour).toBeCloseTo(listCost, 6)
  })

  it('teste 7 — a escolha de hub da lista segue intacta', () => {
    // O Water vem da estação (487→400 + frete 152 = 552) e não de Jita (1000).
    const water = list.lines.find((l) => l.typeId === TYPE_WATER)!
    expect(water.chosen!.stationId).toBe(STATION)
    expect(water.chosen!.effectiveUnitPrice).toBeCloseTo(552, 6)
  })
})

describe('teste 3 — o setup real: vende no lugar, a preço jita_split', () => {
  const c = colony()
  // jita_split de um P4: (buy + sell) / 2. Sem mover carga: saída 0.
  const JITA_BUY = 1_400_000
  const JITA_SELL = 1_600_000
  const split = (JITA_BUY + JITA_SELL) / 2

  const result = computeColonyPnl({
    balances: c.projection.balances.designed,
    sellUnitPrice: (typeId) => (typeId === STERILE_CONDUITS ? split : 0),
    inputCost: (typeId) => ({ effectiveUnitPrice: typeId === TYPE_WATER ? 552 : 9_200 }),
    volumePerUnit: getCommodityVolume,
    exportTaxRate: TAX,
    importTaxRate: TAX,
    outboundRatePerM3: 0,
  })

  it('a colônia exporta o P4 e o P&L o precifica pelo split', () => {
    const line = result.exportLines.find((l) => l.typeId === STERILE_CONDUITS)!
    expect(line).toBeDefined()
    expect(line.unitPrice).toBe(1_500_000)
    expect(result.exportGrossPerHour).toBeCloseTo(line.unitsPerHour * split, 6)
  })

  it('sem saída configurada não há frete de saída — e isso é 0 de verdade', () => {
    expect(result.outboundFreightPerHour).toBe(0)
    expect(result.exportVolumeM3PerHour).toBeGreaterThan(0)
  })

  it('o NET é positivo e fecha com a decomposição mostrada na tela', () => {
    const somaLinhas =
      result.exportLines.reduce((s, l) => s + l.grossPerHour - l.taxPerHour, 0) -
      result.inputLines.reduce((s, l) => s + l.grossPerHour + l.taxPerHour, 0)
    expect(result.netPerHour).toBeCloseTo(somaLinhas, 6)
    expect(result.netPerHour).toBeGreaterThan(0)
  })

  it('nada fica sem preço neste cenário', () => {
    expect(result.unpricedInputTypeIds).toEqual([])
    expect(result.unpricedExportTypeIds).toEqual([])
  })
})
