/**
 * Entrega — o que levar para cada personagem e para cada planeta dele.
 *
 * O que estes testes travam:
 *
 *  1. A quantidade é **bruta**: ignora o desconto de estoque que a lista de
 *     compra aplica. Compra e entrega são perguntas diferentes.
 *  2. O arredondamento é **por destino, para cima** — planeta não recebe fração,
 *     e receber de menos deixa a colônia seca.
 *  3. O agregado do personagem é o material dele somado, não a soma dos
 *     arredondamentos por planeta.
 */

import { buildDelivery, toDeliveryCsv } from '@/lib/pi-v2/delivery'
import { toMultibuy } from '@/lib/pi-v2/shopping-format'
import { buildShoppingList } from '@/lib/pi-v2/shopping'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { DemandBreakdown, ShoppingLine } from '@/lib/pi-v2/shopping-types'
import {
  ANCHOR_ISO,
  TYPE_WATER,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

/** Uma linha de compra reduzida ao que a entrega consome. */
function line(
  partial: Pick<ShoppingLine, 'typeId' | 'name'> &
    Partial<ShoppingLine> & { breakdown: DemandBreakdown[] }
): ShoppingLine {
  return {
    tier: 0,
    quantity: 0,
    grossQuantity: 0,
    onHandQuantity: 0,
    coveredByStock: false,
    volumePerUnit: 1,
    totalVolumeM3: 0,
    chosen: null,
    quotes: [],
    totalCost: 0,
    short: false,
    ...partial,
  }
}

function at(
  characterId: number,
  characterName: string,
  planetId: number,
  planetName: string,
  quantity: number
): DemandBreakdown {
  return { characterId, characterName, planetId, planetName, quantity, onHandQuantity: 0 }
}

describe('agrupamento por destino', () => {
  const lines = [
    line({
      typeId: TYPE_WATER,
      name: 'Water',
      volumePerUnit: 0.38,
      breakdown: [
        at(1, 'Zeca Setaum', 11, 'Planeta A', 1000),
        at(1, 'Zeca Setaum', 12, 'Planeta B', 500),
        at(2, 'Alt Dois', 21, 'Planeta C', 200),
      ],
    }),
    line({
      typeId: 2390,
      name: 'Biocells',
      tier: 1,
      volumePerUnit: 1.5,
      breakdown: [at(1, 'Zeca Setaum', 11, 'Planeta A', 40)],
    }),
  ]

  const delivery = buildDelivery(lines)

  it('um bloco por personagem, em ordem previsível', () => {
    expect(delivery.map((c) => c.characterName)).toEqual(['Alt Dois', 'Zeca Setaum'])
  })

  it('cada personagem traz os planetas dele — e só os dele', () => {
    const zeca = delivery.find((c) => c.characterId === 1)!
    expect(zeca.planets.map((p) => p.planetId)).toEqual([11, 12])
    const alt = delivery.find((c) => c.characterId === 2)!
    expect(alt.planets.map((p) => p.planetId)).toEqual([21])
  })

  it('o planeta recebe só o que ele consome', () => {
    const zeca = delivery.find((c) => c.characterId === 1)!
    const planetaA = zeca.planets.find((p) => p.planetId === 11)!
    expect(planetaA.items.map((i) => [i.name, i.quantity])).toEqual([
      ['Water', 1000],
      ['Biocells', 40],
    ])
    const planetaB = zeca.planets.find((p) => p.planetId === 12)!
    expect(planetaB.items.map((i) => [i.name, i.quantity])).toEqual([['Water', 500]])
  })

  it('o agregado do personagem soma os planetas dele — a carga de uma ida só', () => {
    const zeca = delivery.find((c) => c.characterId === 1)!
    expect(zeca.items.find((i) => i.typeId === TYPE_WATER)!.quantity).toBe(1500)
  })

  it('o volume acompanha, para caber na nave', () => {
    const zeca = delivery.find((c) => c.characterId === 1)!
    const planetaA = zeca.planets.find((p) => p.planetId === 11)!
    // 1.000 × 0,38 + 40 × 1,5 = 440 m³
    expect(planetaA.totalVolumeM3).toBeCloseTo(440, 6)
  })
})

describe('arredondamento', () => {
  it('cada destino sobe para a unidade inteira — planeta não recebe fração', () => {
    const delivery = buildDelivery([
      line({
        typeId: TYPE_WATER,
        name: 'Water',
        breakdown: [
          at(1, 'Zeca Setaum', 11, 'A', 0.2),
          at(1, 'Zeca Setaum', 12, 'B', 0.3),
        ],
      }),
    ])
    const zeca = delivery[0]
    expect(zeca.planets.map((p) => p.items[0].quantity)).toEqual([1, 1])
    // O agregado arredonda uma vez, sobre o cru: 0,5 → 1. Não é a soma dos
    // arredondamentos (2). São duas perguntas, e a tela mostra as duas.
    expect(zeca.items[0].quantity).toBe(1)
  })

  it('destino com consumo zero não vira linha', () => {
    const delivery = buildDelivery([
      line({
        typeId: TYPE_WATER,
        name: 'Water',
        breakdown: [at(1, 'Zeca Setaum', 11, 'A', 0)],
      }),
    ])
    expect(delivery).toEqual([])
  })
})

describe('a entrega é BRUTA — não herda o desconto da compra', () => {
  it('linha coberta pelo estoque ainda entrega: o planeta consome mesmo assim', () => {
    // A lista de compra diria "não compre" (já tem em casa). A entrega diz "leve"
    // apenas se o planeta consome — e ele consome. São perguntas diferentes.
    const delivery = buildDelivery([
      line({
        typeId: TYPE_WATER,
        name: 'Water',
        quantity: 0,
        grossQuantity: 1000,
        onHandQuantity: 1000,
        coveredByStock: true,
        breakdown: [at(1, 'Zeca Setaum', 11, 'A', 1000)],
      }),
    ])
    expect(delivery[0].planets[0].items[0].quantity).toBe(1000)
  })
})

describe('saídas', () => {
  const delivery = buildDelivery([
    line({
      typeId: TYPE_WATER,
      name: 'Water',
      volumePerUnit: 0.38,
      breakdown: [at(1, 'Zeca Setaum', 11, 'A', 1000)],
    }),
  ])
  const items = delivery[0].planets[0].items

  it('o multibuy da entrega é o mesmo formato do jogo', () => {
    expect(toMultibuy(items)).toBe('Water\t1000')
  })

  it('o CSV traz quantidade e volume', () => {
    expect(toDeliveryCsv(items)).toBe('item,tier,quantidade,volume_m3\nWater,0,1000,380')
  })
})

describe('integração — a entrega sai da mesma demanda que a lista de compra', () => {
  function colony(
    layout: PiColonyLayout,
    ids: { characterId: number; characterName: string; planetId: number }
  ): PortfolioColony {
    const nowMs = Date.parse(ANCHOR_ISO)
    const projection = projectColonyState({
      summary: summaryWithLastUpdate(ANCHOR_ISO),
      layout,
      contract: { visitCadenceHrs: 24 },
      nowMs,
    })
    const events = deriveColonyEvents(projection, nowMs)
    return {
      ...ids,
      planetName: `Planeta ${ids.planetId}`,
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

  // Duas colônias iguais, personagens diferentes: 200 Water/h cada, 5h = 1.000.
  const list = buildShoppingList({
    colonies: [
      colony(sterileConduitsColony({ waterAmount: 0 }), {
        characterId: 1,
        characterName: 'Zeca Setaum',
        planetId: 11,
      }),
      colony(sterileConduitsColony({ waterAmount: 0 }), {
        characterId: 2,
        characterName: 'Alt Dois',
        planetId: 21,
      }),
    ],
    periodHours: 5,
    booksByType: new Map(),
  })

  it('cada personagem leva o que os planetas dele consomem', () => {
    const delivery = buildDelivery(list.lines)
    const water = (name: string) =>
      delivery.find((c) => c.characterName === name)!.items.find((i) => i.typeId === TYPE_WATER)!
        .quantity
    expect(water('Zeca Setaum')).toBe(1000)
    expect(water('Alt Dois')).toBe(1000)
  })

  it('a soma das entregas cobre o consumo bruto da lista', () => {
    const delivery = buildDelivery(list.lines)
    const entregue = delivery.reduce(
      (sum, c) => sum + (c.items.find((i) => i.typeId === TYPE_WATER)?.quantity ?? 0),
      0
    )
    const bruto = list.lines.find((l) => l.typeId === TYPE_WATER)!.quantity
    // Nunca abaixo do bruto: o arredondamento por destino só pode sobrar.
    expect(entregue).toBeGreaterThanOrEqual(bruto)
  })
})
