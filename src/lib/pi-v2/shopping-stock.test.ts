/**
 * A lista de compra NÃO desconta o estoque projetado no launchpad.
 *
 * Já foi assim (compre o que falta, não o que consome), mas o desconto virou
 * risco real: a ESI de PI só recalcula a colônia quando o jogador ABRE o
 * planeta no jogo. Colônias que ficam dias sem serem abertas carregam um
 * `last_update` velho, e acima de 72h a projeção suspende e devolve o estoque
 * MEDIDO cru — que pode ser de uma launchpad que estava cheia da última vez
 * que foi vista e está vazia agora. Confirmado contra o jogo em 05/ago/2026:
 * a lista pedia para comprar quase nada de Water em várias colônias que não
 * tinham nenhum Water real no launchpad.
 *
 * `stockOnHandByType` continua existindo em `ColonyProjection` (é a base do
 * "tempo até vazio" e dos badges de status), só não alimenta mais a lista de
 * compra.
 */

import { buildShoppingList, aggregateImportDemand } from '@/lib/pi-v2/shopping'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
import {
  ANCHOR_ISO,
  HOUR_MS,
  PIN_EXPORT_LAUNCHPAD,
  TYPE_HERMETIC_MEMBRANES,
  TYPE_WATER,
  selfHarmonizingColony,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'
import type { MarketDepth } from '@/lib/market-prices'

const depth = (levels: Array<[price: number, volume: number]>): MarketDepth => ({
  sell: levels.map(([price, volume]) => ({ price, volume, locationId: 1 })),
  buy: [],
  updatedAt: Date.now(),
})

function colony(
  layout: PiColonyLayout,
  hoursAfterSnapshot = 0,
  ids: { characterId?: number; characterName?: string; planetId?: number } = {}
): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO) + hoursAfterSnapshot * HOUR_MS
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId: ids.characterId ?? 1,
    characterName: ids.characterName ?? 'Zeca Setaum',
    planetId: ids.planetId ?? 11,
    planetName: 'Planeta 11',
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

/** Book fundo e barato para o teste não depender de escolha de hub. */
const station = (price: number) => ({
  id: '60003760',
  label: 'UALX-3',
  book: depth([[price, 9_999_999]]),
  freightPerM3: 0,
})
const books = new Map<number, HubBooks>([
  [TYPE_WATER, { stations: [station(400)] }],
  [2351, { stations: [station(9000)] }],
  [28974, { stations: [station(11_000)] }],
])

const waterLine = (list: ReturnType<typeof buildShoppingList>) =>
  list.lines.find((l) => l.typeId === TYPE_WATER)!

describe('a projeção continua expondo o estoque em mãos (usado pelo status/badges, não pela compra)', () => {
  it('soma o inventário projetado de todos os stores, por commodity', () => {
    const c = colony(sterileConduitsColony({ waterAmount: 4600 }), 0)
    expect(c.projection.stockOnHandByType[TYPE_WATER]).toBeCloseTo(4600, 6)
  })

  it('inclui o que está parado sem rota — estoque é estoque', () => {
    const layout = sterileConduitsColony({ waterAmount: 4600 })
    const exportPad = layout.pins.find((p) => p.pin_id === PIN_EXPORT_LAUNCHPAD)!
    exportPad.contents = [...(exportPad.contents ?? []), { type_id: 2321, amount: 777 }]

    const projection = colony(layout, 0).projection
    const store = projection.stores.find((s) => s.pinId === PIN_EXPORT_LAUNCHPAD)!
    expect(store.flows.some((f) => f.typeId === 2321)).toBe(false)
    expect(projection.stockOnHandByType[2321]).toBe(777)
  })
})

describe('a lista de compra pede sempre o consumo bruto', () => {
  it('demanda 1000, qualquer estoque no launchpad → compra 1000 do mesmo jeito', () => {
    // 5 fábricas × 40 Water/h = 200/h. Período de 5h = 1.000 de consumo.
    const semEstoque = buildShoppingList({
      colonies: [colony(sterileConduitsColony({ waterAmount: 0 }), 0)],
      periodHours: 5,
      booksByType: books,
    })
    const cheia = buildShoppingList({
      colonies: [colony(sterileConduitsColony({ waterAmount: 100_000 }), 0)],
      periodHours: 5,
      booksByType: books,
    })
    expect(waterLine(semEstoque).quantity).toBe(1000)
    expect(waterLine(cheia).quantity).toBe(1000)
  })

  it('projeção suspensa (>72h, snapshot velho) não muda a quantidade pedida', () => {
    // Acima de 72h o motor suspende e o estoque em mãos vira o medido cru — é
    // justamente o caso em que confiar nesse número é mais perigoso, porque o
    // snapshot pode ser de dias atrás. A lista ignora esse número por completo.
    const stale = colony(sterileConduitsColony({ waterAmount: 4600 }), 100)
    expect(stale.projection.confidence.projectionApplied).toBe(false)

    const list = buildShoppingList({
      colonies: [stale],
      periodHours: 5,
      booksByType: books,
    })
    expect(waterLine(list).quantity).toBe(1000)
  })

  it('insumo produzido no planeta não entra na lista — não se compra o que a colônia faz', () => {
    // Hermetic Membranes é fabricada na 6-IAFR IX: import 0. Ela TEM estoque em
    // mãos (dado do projection engine), mas não vira linha de compra.
    const c = colony(selfHarmonizingColony({ hermeticMembranesAmount: 500 }), 0)
    expect(c.projection.stockOnHandByType[TYPE_HERMETIC_MEMBRANES]).toBe(500)

    const list = buildShoppingList({ colonies: [c], periodHours: 24, booksByType: new Map() })
    expect(list.lines.some((l) => l.typeId === TYPE_HERMETIC_MEMBRANES)).toBe(false)
    expect(aggregateImportDemand([c], 24).has(TYPE_HERMETIC_MEMBRANES)).toBe(false)
  })

  it('soma a demanda bruta de várias colônias, sem descontar estoque de nenhuma', () => {
    const list = buildShoppingList({
      colonies: [
        colony(sterileConduitsColony({ waterAmount: 300 }), 0, { planetId: 11 }),
        colony(sterileConduitsColony({ waterAmount: 100_000 }), 0, { planetId: 12 }),
      ],
      periodHours: 5,
      booksByType: books,
    })
    const water = waterLine(list)
    expect(water.quantity).toBe(2000) // 2 colônias × 1.000, nenhuma abatida
  })

  it('preço e hub não dependem do estoque no launchpad — só da quantidade bruta', () => {
    const a = waterLine(
      buildShoppingList({
        colonies: [colony(sterileConduitsColony({ waterAmount: 0 }), 0)],
        periodHours: 5,
        booksByType: books,
      })
    )
    const b = waterLine(
      buildShoppingList({
        colonies: [colony(sterileConduitsColony({ waterAmount: 100_000 }), 0)],
        periodHours: 5,
        booksByType: books,
      })
    )
    expect(a.quantity).toBe(b.quantity)
    expect(a.chosen!.effectiveUnitPrice).toBeCloseTo(b.chosen!.effectiveUnitPrice, 6)
    expect(a.totalCost).toBeCloseTo(b.totalCost, 6)
  })
})

describe('desconto opcional pelo Armazém de PI (esi-assets, não projeção)', () => {
  const oneColony = () => [colony(sterileConduitsColony({ waterAmount: 0 }), 0)]

  it('warehouseQuantity aparece mesmo sem netOfWarehouse — é só informativo por padrão', () => {
    const list = buildShoppingList({
      colonies: oneColony(),
      periodHours: 5,
      booksByType: books,
      warehouseStock: { [TYPE_WATER]: 300 },
    })
    const water = waterLine(list)
    expect(water.warehouseQuantity).toBe(300)
    expect(water.grossQuantity).toBe(1000)
    // Sem netOfWarehouse, a quantidade a comprar continua o bruto — o armazém
    // não desconta sozinho.
    expect(water.quantity).toBe(1000)
    expect(water.coveredByStock).toBe(false)
  })

  it('netOfWarehouse: true desconta — demanda 1000, armazém 300 → compra 700', () => {
    const list = buildShoppingList({
      colonies: oneColony(),
      periodHours: 5,
      booksByType: books,
      warehouseStock: { [TYPE_WATER]: 300 },
      netOfWarehouse: true,
    })
    const water = waterLine(list)
    expect(water.grossQuantity).toBe(1000)
    expect(water.warehouseQuantity).toBe(300)
    expect(water.quantity).toBe(700)
    expect(water.coveredByStock).toBe(false)
  })

  it('netOfWarehouse: true com armazém cobrindo tudo → compra 0, coberto', () => {
    const list = buildShoppingList({
      colonies: oneColony(),
      periodHours: 5,
      booksByType: books,
      warehouseStock: { [TYPE_WATER]: 1200 },
      netOfWarehouse: true,
    })
    const water = waterLine(list)
    expect(water.quantity).toBe(0)
    expect(water.coveredByStock).toBe(true)
    expect(water.totalCost).toBe(0)
  })

  it('cota o preço pela quantidade líquida, não pela bruta, quando netOfWarehouse', () => {
    // Book com faixas de preço: os primeiros 700 saem a 400, o resto sobe.
    const tiered = new Map<number, HubBooks>([
      [
        TYPE_WATER,
        {
          stations: [
            {
              id: '60003760',
              label: 'UALX-3',
              book: depth([
                [400, 700],
                [900, 9_999_999],
              ]),
              freightPerM3: 0,
            },
          ],
        },
      ],
    ])

    const net = waterLine(
      buildShoppingList({
        colonies: oneColony(),
        periodHours: 5,
        booksByType: tiered,
        warehouseStock: { [TYPE_WATER]: 300 }, // compra líquida = 700, cabe todo a 400
        netOfWarehouse: true,
      })
    )
    const gross = waterLine(
      buildShoppingList({
        colonies: oneColony(),
        periodHours: 5,
        booksByType: tiered,
        warehouseStock: { [TYPE_WATER]: 300 }, // compra bruta = 1000, estoura a faixa de 400
      })
    )
    expect(net.quantity).toBe(700)
    expect(net.chosen!.effectiveUnitPrice).toBeCloseTo(400, 6)
    expect(gross.quantity).toBe(1000)
    expect(gross.chosen!.effectiveUnitPrice).toBeGreaterThan(net.chosen!.effectiveUnitPrice)
  })
})
