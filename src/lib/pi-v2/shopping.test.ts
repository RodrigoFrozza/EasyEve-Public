/**
 * Lista de compra — validada contra a tabela manual do Rodrigo.
 *
 * Os números vêm da rodada real de 21-23/07/2026, conferida contra o order book
 * e contra o que foi efetivamente pago em jogo (quatro compras de bilhões, desvio
 * máximo de +0,8%). Se um destes casos quebrar, o modelo econômico regrediu —
 * não "acerte" o valor esperado sem reconferir o book.
 *
 * Fonte: `Brain/05 Planos/Operação Atual - Listas de Compra.md` e
 * `Brain/03 Mercado/Validação do Modelo - Compras de 2026-07-21.md`.
 */

import {
  aggregateImportDemand,
  buildShoppingList,
  toCsv,
  toMultibuy,
  type ShoppingLine,
} from '@/lib/pi-v2/shopping'
import { chooseHub, quoteHubs, type HubBooks } from '@/lib/pi-v2/pricing/hub-quotes'
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

/** Frete real do Rodrigo: UALX na base (0), C-J6 de JF cheio (208), Jita por courier (800). */
const JITA_FREIGHT = 800

const depth = (levels: Array<[price: number, volume: number]>): MarketDepth => ({
  sell: levels.map(([price, volume]) => ({ price, volume, locationId: 1 })),
  buy: [],
  updatedAt: Date.now(),
})

const station = (
  id: string,
  label: string,
  levels: Array<[number, number]>,
  freightPerM3 = 0
) => ({ id, label, book: depth(levels), freightPerM3 })

describe('Water — o caso que prova por que o frete entra no critério', () => {
  // Rodada de 21/07: precisava de 208.850 Water.
  //   UALX-3: 1ª linha tem 154.380 a 486,49; o resto vem da 2ª a 490,00.
  //           Efetivo medido: 487,41 (+0,19% sobre a 1ª linha).
  //   Jita:   468,00 de mercadoria + 800 ISK/m³ × 0,19 m³ = 152 de frete = 620,00.
  // A mercadoria é MAIS BARATA em Jita. O frete inverte a decisão.
  const DEMAND = 208_850
  const books: HubBooks = {
    stations: [
      station('60003760', 'UALX-3', [
        [486.49, 154_380],
        [490.0, 200_000],
      ]),
    ],
    jita: { buy: 460, sell: 468 },
    jitaFreightPerM3: JITA_FREIGHT,
  }

  it('anda o book em vez de usar a primeira linha', () => {
    const ualx = quoteHubs(books, DEMAND, 0.19).find((q) => q.label === 'UALX-3')!
    // A tabela manual registra 487,41 e +0,19% sobre a primeira linha.
    expect(ualx.unitPrice).toBeCloseTo(487.41, 1)
    expect(ualx.unitPrice / 486.49 - 1).toBeCloseTo(0.0019, 4)
    expect(ualx.coversDemand).toBe(true)
  })

  it('Jita fica em 620,00 efetivos — 468 de mercadoria + 152 de frete', () => {
    const jita = quoteHubs(books, DEMAND, 0.19).find((q) => q.origin === 'jita')!
    expect(jita.unitPrice).toBe(468)
    expect(jita.freightPerUnit).toBeCloseTo(152, 6)
    expect(jita.effectiveUnitPrice).toBeCloseTo(620, 6)
  })

  it('teste 1 — escolhe UALX-3 (na lista, frete 0) apesar de a mercadoria ser mais cara lá', () => {
    const chosen = chooseHub(quoteHubs(books, DEMAND, 0.19))!
    expect(chosen.label).toBe('UALX-3')
    expect(chosen.stationId).toBe('60003760')
    // Sem frete, o motor escolheria Jita — e erraria.
    const semFrete = chooseHub(quoteHubs({ ...books, jitaFreightPerM3: 0 }, DEMAND, 0.19))!
    expect(semFrete.origin).toBe('jita')
  })

  it('a economia bate com os 27,7M da tabela manual', () => {
    const quotes = quoteHubs(books, DEMAND, 0.19)
    const ualx = quotes.find((q) => q.label === 'UALX-3')!
    const jita = quotes.find((q) => q.origin === 'jita')!
    const economia = (jita.effectiveUnitPrice - ualx.effectiveUnitPrice) * DEMAND
    expect(economia / 1_000_000).toBeCloseTo(27.7, 1)
  })
})

describe('teste 2 — qualquer número de estações concorre', () => {
  const DEMAND = 10_000
  const books: HubBooks = {
    stations: [
      station('1', 'UALX-3', [[500, 999_999]], 0),
      station('2', 'C-J6MT', [[420, 999_999]], 208),
      station('3', 'Terceira', [[450, 999_999]], 50),
    ],
    region: depth([[600, 999_999]]),
    regionFreightPerM3: 0,
    jita: { buy: 380, sell: 400 },
    jitaFreightPerM3: 800,
  }

  it('cota as 3 estações + região + Jita', () => {
    const quotes = quoteHubs(books, DEMAND, 1)
    expect(quotes).toHaveLength(5)
    expect(quotes.filter((q) => q.origin === 'structure')).toHaveLength(3)
    expect(quotes.map((q) => q.label)).toContain('Terceira')
  })

  it('escolhe a de menor custo efetivo, não a de menor preço de etiqueta', () => {
    // Etiqueta: Jita 400 < C-J6 420 < Terceira 450 < UALX 500 < região 600.
    // Efetivo (1 m³/un): Jita 1200 · C-J6 628 · Terceira 500 · UALX 500 · região 600.
    const chosen = chooseHub(quoteHubs(books, DEMAND, 1))!
    expect(chosen.effectiveUnitPrice).toBeCloseTo(500, 6)
    expect(['UALX-3', 'Terceira']).toContain(chosen.label)
  })

  it('teste 5 — mudar o frete de uma estação recomputa a escolha', () => {
    const antes = chooseHub(quoteHubs(books, DEMAND, 1))!
    expect(antes.effectiveUnitPrice).toBeCloseTo(500, 6)

    // C-J6 passa a ser frete 0 (mudou a logística): 420 vira o melhor efetivo.
    const depois = chooseHub(
      quoteHubs(
        {
          ...books,
          stations: books.stations!.map((s) =>
            s.label === 'C-J6MT' ? { ...s, freightPerM3: 0 } : s
          ),
        },
        DEMAND,
        1
      )
    )!
    expect(depois.label).toBe('C-J6MT')
    expect(depois.effectiveUnitPrice).toBeCloseTo(420, 6)
  })

  it('teste 3 — estação sem book não vira cotação (nem preço inventado)', () => {
    const quotes = quoteHubs(
      {
        stations: [
          { id: '9', label: 'Sem mercado', book: null, freightPerM3: 0 },
          station('1', 'UALX-3', [[500, 999_999]]),
        ],
      },
      DEMAND,
      1
    )
    expect(quotes).toHaveLength(1)
    expect(quotes[0]!.label).toBe('UALX-3')
  })

  it('estação com book vazio também fica de fora', () => {
    const quotes = quoteHubs(
      { stations: [{ id: '9', label: 'Vazia', book: depth([]), freightPerM3: 0 }] },
      DEMAND,
      1
    )
    expect(quotes).toHaveLength(0)
  })
})

describe('sinaliza quando o hub não cobre a quantidade', () => {
  it('book raso é escolhido mas marcado — avisar, não mentir', () => {
    const books: HubBooks = { stations: [station('2', 'C-J6', [[5500, 6542]], 208)] }
    const quotes = quoteHubs(books, 35_365, 0.75)
    expect(quotes[0]!.coversDemand).toBe(false)
    expect(quotes[0]!.filledQty).toBe(6542)
  })

  it('prefere o hub que cobre, mesmo mais caro por unidade', () => {
    const books: HubBooks = {
      stations: [station('2', 'C-J6', [[5500, 100]])], // barato e raso
      jita: { buy: 5900, sell: 6000 }, // caro e fundo
    }
    const chosen = chooseHub(quoteHubs(books, 35_365, 0.75))!
    expect(chosen.origin).toBe('jita')
  })

  it('sem book em lugar nenhum, cai no preço de referência manual', () => {
    const chosen = chooseHub([], 12_345)!
    expect(chosen.origin).toBe('reference')
    expect(chosen.effectiveUnitPrice).toBe(12_345)
  })

  it('sem book e sem referência não inventa preço', () => {
    expect(chooseHub([])).toBeNull()
  })
})

// --- lista completa sobre colônias reais ------------------------------------

/**
 * Colônia com os launchpads VAZIOS de propósito: este arquivo testa preço, hub e
 * agrupamento, e estoque em mãos entraria como segunda variável. O desconto tem
 * suíte própria em `shopping-stock.test.ts`.
 */
function portfolioColony(
  characterId: number,
  characterName: string,
  planetId: number
): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO)
  const layout = sterileConduitsColony({
    waterAmount: 0,
    smartfabAmount: 0,
    vaccinesAmount: 0,
  })
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId,
    characterName,
    planetId,
    planetName: `Planeta ${planetId}`,
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

describe('aggregateImportDemand', () => {
  const colonies = [
    portfolioColony(1, 'Zeca Setaum', 11),
    portfolioColony(1, 'Zeca Setaum', 12),
    portfolioColony(2, 'Fleet Citizen 01', 21),
  ]

  it('deriva a quantidade das rotas — o jogador não digita consumo', () => {
    // Cada Sterile Conduits consome 40 Water/h; 3 colônias × 200/h × 24h.
    const demand = aggregateImportDemand(colonies, 24)
    expect(demand.get(TYPE_WATER)!.quantity).toBeCloseTo(3 * 200 * 24, 6)
  })

  it('escala com o período', () => {
    const d24 = aggregateImportDemand(colonies, 24).get(TYPE_WATER)!.quantity
    const d168 = aggregateImportDemand(colonies, 168).get(TYPE_WATER)!.quantity
    expect(d168 / d24).toBeCloseTo(7, 6)
  })

  it('guarda de onde veio cada pedaço — por personagem e planeta', () => {
    const water = aggregateImportDemand(colonies, 24).get(TYPE_WATER)!
    expect(water.breakdown).toHaveLength(3)
    expect(water.breakdown.filter((b) => b.characterId === 1)).toHaveLength(2)
    expect(water.breakdown.every((b) => b.quantity === 200 * 24)).toBe(true)
  })

  it('só entra o que é COMPRADO — intermediário local não vira linha', () => {
    // Sterile Conduits é produzido, não comprado: não pode aparecer na lista.
    const demand = aggregateImportDemand(colonies, 24)
    expect([...demand.keys()].sort((a, b) => a - b)).toEqual([2351, 3645, 28974])
  })
})

describe('buildShoppingList', () => {
  const colonies = [portfolioColony(1, 'Zeca Setaum', 11)]
  const booksByType = new Map<number, HubBooks>([
    [
      TYPE_WATER,
      {
        stations: [station('1', 'UALX-3', [[486.49, 999_999]])],
        jita: { buy: 460, sell: 468 },
        jitaFreightPerM3: JITA_FREIGHT,
      },
    ],
    [2351, { jita: { buy: 9000, sell: 9200 }, jitaFreightPerM3: JITA_FREIGHT }],
    [28974, { jita: { buy: 11_000, sell: 11_500 }, jitaFreightPerM3: JITA_FREIGHT }],
  ])

  const list = buildShoppingList({ colonies, periodHours: 24, booksByType })

  it('arredonda a quantidade para cima — não se compra 0,4 de um insumo', () => {
    const water = list.lines.find((l) => l.typeId === TYPE_WATER)!
    expect(Number.isInteger(water.quantity)).toBe(true)
    expect(water.quantity).toBe(200 * 24)
  })

  it('calcula custo e volume com o preço EFETIVO', () => {
    const water = list.lines.find((l) => l.typeId === TYPE_WATER)!
    expect(water.chosen!.label).toBe('UALX-3')
    expect(water.totalCost).toBeCloseTo(water.quantity * 486.49, 4)
    expect(water.totalVolumeM3).toBeCloseTo(water.quantity * 0.19, 6)
  })

  it('agrupa por hub — a compra é executada uma ida por hub', () => {
    expect(list.byHub.length).toBeGreaterThan(1)
    const total = list.byHub.reduce((s, b) => s + b.cost, 0)
    expect(total).toBeCloseTo(list.totalCost, 4)
  })

  it('ordena por gasto: onde escolher errado custa mais', () => {
    const costs = list.lines.map((l) => l.totalCost)
    expect(costs).toEqual([...costs].sort((a, b) => b - a))
  })

  it('item sem book e sem referência aparece, mas sem custo inventado', () => {
    const semBook = buildShoppingList({
      colonies,
      periodHours: 24,
      booksByType: new Map(),
    })
    expect(semBook.totalCost).toBe(0)
    expect(semBook.unpricedTypeIds.length).toBeGreaterThan(0)
    expect(semBook.lines.every((l) => l.chosen === null)).toBe(true)
  })
})

describe('saídas', () => {
  const lines: ShoppingLine[] = [
    {
      typeId: 3645,
      name: 'Water',
      tier: 1,
      quantity: 208_850,
      volumePerUnit: 0.19,
      totalVolumeM3: 39_681.5,
      chosen: {
        origin: 'structure',
        label: 'UALX-3',
        unitPrice: 487.41,
        freightPerUnit: 0,
        effectiveUnitPrice: 487.41,
        topBid: 460,
        coversDemand: true,
        filledQty: 208_850,
      },
      quotes: [],
      totalCost: 101_795_578.5,
      short: false,
      breakdown: [],
    },
  ]

  it('multibuy sai no formato que o jogo aceita: Nome<TAB>Qtd', () => {
    expect(toMultibuy(lines)).toBe('Water\t208850')
  })

  it('CSV carrega a decomposição inteira, não só o total', () => {
    const csv = toCsv(lines)
    const [header, row] = csv.split('\n')
    expect(header).toContain('preco_unitario')
    expect(header).toContain('frete_unitario')
    expect(header).toContain('efetivo_unitario')
    expect(row).toContain('UALX-3')
    expect(row).toContain('487.41')
    expect(row).toContain('sim')
  })

  it('CSV escapa nome com vírgula em vez de quebrar a coluna', () => {
    const tricky = [{ ...lines[0]!, name: 'Item, com vírgula' }]
    expect(toCsv(tricky).split('\n')[1]).toContain('"Item, com vírgula"')
  })
})
