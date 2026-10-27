/**
 * O frete do contrato no total do hub — e o que ele NÃO pode afetar.
 *
 * A separação que estes testes travam (e que a Etapa 8 preservou ao reorganizar o
 * courier dentro do modelo de pernas):
 *
 *  - **Escolha de hub por item** usa a taxa MARGINAL (ISK/m³). Se o teto do full
 *    load entrasse aqui, um item mudaria de origem conforme o resto da lista
 *    crescesse — a compra de Water dependeria de quanto Polyaramid você levou.
 *  - **Total do hub** usa o custo completo do envio, com teto e piso. É o dinheiro
 *    que sai de fato.
 */

import { buildShoppingList } from '@/lib/pi-v2/shopping'
import type { CourierLeg, ResolvedLeg } from '@/lib/pi-v2/pricing/freight-model'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
import type { ContractFreight } from '@/lib/pi-v2/pricing/freight'
import {
  ANCHOR_ISO,
  TYPE_WATER,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { MarketDepth } from '@/lib/market-prices'

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

const STATION_ID = '60003760'
/** Estação barata com frete marginal; Jita cara sem frete, para o hub ser decidível. */
const books = new Map<number, HubBooks>([
  [
    TYPE_WATER,
    {
      stations: [
        { id: STATION_ID, label: 'C-J6MT', book: depth([[400, 9_999_999]]), freightPerM3: 800 },
      ],
      jita: { buy: 900, sell: 1000 },
    },
  ],
  [2351, { jita: { buy: 9000, sell: 9200 } }],
  [28974, { jita: { buy: 11_000, sell: 11_500 } }],
])

/** O contrato da Parte A, agora como perna de ENTRADA do hub daquela estação. */
const build = (contract?: ContractFreight) => {
  const leg: CourierLeg | undefined = contract ? { method: 'courier', ...contract } : undefined
  const legs: Map<string, ResolvedLeg> | undefined = leg
    ? new Map([[STATION_ID, { leg }]])
    : undefined
  return buildShoppingList({
    colonies: [colony()],
    periodHours: 24,
    booksByType: books,
    legs,
  })
}

const stationBucket = (list: ReturnType<typeof buildShoppingList>) =>
  list.byHub.find((b) => b.stationId === STATION_ID)!

describe('teste 4 — o contrato NÃO mexe na escolha de hub por item', () => {
  const semContrato = build()
  // Full load ridiculamente barato: se o teto vazasse para a escolha por item,
  // esta estação ficaria "de graça" e roubaria itens de outros hubs.
  const comTetoBarato = build({ transporter: 'ITL', perM3Rate: 800, fullLoadReward: 1 })

  it('o hub escolhido para Water é o mesmo com e sem contrato', () => {
    const a = semContrato.lines.find((l) => l.typeId === TYPE_WATER)!
    const b = comTetoBarato.lines.find((l) => l.typeId === TYPE_WATER)!
    expect(b.chosen!.stationId).toBe(a.chosen!.stationId)
    expect(b.chosen!.effectiveUnitPrice).toBeCloseTo(a.chosen!.effectiveUnitPrice, 6)
  })

  it('o preço efetivo por item segue sendo mercadoria + frete marginal', () => {
    const water = semContrato.lines.find((l) => l.typeId === TYPE_WATER)!
    // 400 de mercadoria + 800 ISK/m³ × 0,19 m³ = 152 → 552.
    expect(water.chosen!.effectiveUnitPrice).toBeCloseTo(552, 6)
  })
})

describe('o total do hub usa o reward completo', () => {
  it('sem contrato, o total cai no frete linear', () => {
    const bucket = stationBucket(build())
    expect(bucket.freight).toBeUndefined()
    expect(bucket.freightCost).toBeCloseTo(bucket.linearFreight, 6)
    expect(bucket.cost).toBeCloseTo(bucket.goodsCost + bucket.linearFreight, 6)
  })

  it('com teto de carga cheia, o total para de escalar — e diz por quê', () => {
    const bucket = stationBucket(build({ transporter: 'ITL', perM3Rate: 800, fullLoadReward: 1000 }))
    expect(bucket.freight!.binding).toBe('full_load')
    expect(bucket.freightCost).toBe(1000)
    expect(bucket.freightCost).toBeLessThan(bucket.linearFreight)
  })

  it('com piso de collateral, o total sobe — e diz por quê', () => {
    const bucket = stationBucket(
      build({ transporter: 'ITL', perM3Rate: 800, collateralRate: 0.5 })
    )
    expect(bucket.freight!.binding).toBe('collateral')
    expect(bucket.freightCost).toBeCloseTo(bucket.goodsCost * 0.5, 6)
  })

  it('contrato em branco não zera o frete: cai no linear, marcado', () => {
    const bucket = stationBucket(build({ transporter: 'ITL' }))
    expect(bucket.freight!.unpriced).toBe(true)
    expect(bucket.freightCost).toBeCloseTo(bucket.linearFreight, 6)
  })

  it('o total da lista é mercadoria + frete real, e fecha com os hubs', () => {
    const list = build({ transporter: 'ITL', perM3Rate: 800, fullLoadReward: 1000 })
    expect(list.totalCost).toBeCloseTo(list.goodsCost + list.freightCost, 4)
    expect(list.goodsCost).toBeCloseTo(
      list.byHub.reduce((s, b) => s + b.goodsCost, 0),
      4
    )
    expect(list.freightCost).toBeCloseTo(
      list.byHub.reduce((s, b) => s + b.freightCost, 0),
      4
    )
  })

  it('cada estação tem o seu contrato — o de uma não vaza para a outra', () => {
    const list = build({ transporter: 'ITL', perM3Rate: 800, fullLoadReward: 1000 })
    const jita = list.byHub.find((b) => b.origin === 'jita')!
    expect(jita.freight).toBeUndefined()
    expect(jita.freightCost).toBeCloseTo(jita.linearFreight, 6)
  })
})
