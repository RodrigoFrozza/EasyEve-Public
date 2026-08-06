/**
 * Regressão do bug "Restock Hermetic Membranes" (achado na validação da Etapa 2).
 *
 * A 6-IAFR IX mostrava **"Restock Hermetic Membranes · in 2h 1m"** no topo — mas
 * Hermetic Membranes é FABRICADA no planeta e CONSUMIDA no planeta; import = 0.
 * Não existe "repor" o que a colônia faz sozinha: a ação era impossível de
 * executar, e uma ação impossível é pior que nenhuma ação.
 *
 * A regra que estes testes travam: **"reposição" só se aplica ao que se COMPRA.**
 * Intermediário local que esvazia é sinal de produção, não de compra.
 */

import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import {
  ANCHOR_ISO,
  HOUR_MS,
  PIN_IX_HM_STORAGE,
  TYPE_CAMERA_DRONES,
  TYPE_GEN_ENH_LIVESTOCK,
  TYPE_HERMETIC_MEMBRANES,
  TYPE_NUCLEAR_REACTORS,
  TYPE_POLYARAMIDS,
  selfHarmonizingColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

function analyze(layout: PiColonyLayout, hoursAfterSnapshot: number, cadence = 24) {
  const nowMs = Date.parse(ANCHOR_ISO) + hoursAfterSnapshot * HOUR_MS
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout,
    contract: { visitCadenceHrs: cadence },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return { projection, events, urgency: classifyColony(projection, events) }
}

const eventsFor = (r: ReturnType<typeof analyze>, typeId: number) =>
  r.events.filter((e) => e.typeId === typeId)

describe('a fixture reproduz o desenho da 6-IAFR IX', () => {
  it('Hermetic Membranes é produzida e consumida no planeta, import 0', () => {
    const hm = analyze(selfHarmonizingColony(), 1).projection.balances.designed.find(
      (b) => b.typeId === TYPE_HERMETIC_MEMBRANES
    )!
    expect(hm.productionPerHour).toBeCloseTo(48, 6)
    expect(hm.demandPerHour).toBeCloseTo(48, 6)
    expect(hm.importNeededPerHour).toBe(0)
    expect(hm.isImported).toBe(false)
  })

  it('os quatro insumos comprados têm import > 0', () => {
    const designed = analyze(selfHarmonizingColony(), 1).projection.balances.designed
    for (const typeId of [
      TYPE_POLYARAMIDS,
      TYPE_GEN_ENH_LIVESTOCK,
      TYPE_CAMERA_DRONES,
      TYPE_NUCLEAR_REACTORS,
    ]) {
      const b = designed.find((x) => x.typeId === typeId)!
      expect(b.importNeededPerHour).toBeGreaterThan(0)
      expect(b.isImported).toBe(true)
    }
  })
})

describe('supply_out só para o que se COMPRA', () => {
  it('teste 1 — commodity importada esvaziando continua gerando supply_out', () => {
    // Regressão: o caminho legítimo não pode ter sido levado junto no conserto.
    const r = analyze(selfHarmonizingColony({ importedAmount: 200 }), 1)
    const bought = r.events.filter((e) => e.kind === 'supply_out')
    expect(bought.length).toBeGreaterThan(0)
    expect(bought.every((e) => e.typeId !== TYPE_HERMETIC_MEMBRANES)).toBe(true)
  })

  it('teste 4 — a 6-IAFR IX NÃO pede restock de Hermetic Membranes', () => {
    // O critério de aceite do bug, em uma linha.
    const r = analyze(selfHarmonizingColony(), 1)
    expect(eventsFor(r, TYPE_HERMETIC_MEMBRANES).some((e) => e.kind === 'supply_out')).toBe(false)
    expect(r.urgency.action.typeId).not.toBe(TYPE_HERMETIC_MEMBRANES)
  })

  it('teste 4b — os restocks legítimos continuam aparecendo', () => {
    const r = analyze(selfHarmonizingColony({ importedAmount: 200 }), 1)
    const restockables = new Set(
      r.events.filter((e) => e.kind === 'supply_out').map((e) => e.typeId)
    )
    // Pelo menos um dos comprados tem que estar lá; nenhum local pode estar.
    expect(
      [...restockables].every((id) =>
        [
          TYPE_POLYARAMIDS,
          TYPE_GEN_ENH_LIVESTOCK,
          TYPE_CAMERA_DRONES,
          TYPE_NUCLEAR_REACTORS,
        ].includes(id as number)
      )
    ).toBe(true)
    expect(restockables.size).toBeGreaterThan(0)
  })
})

describe('intermediário local: produção, não compra', () => {
  it('teste 2 — intermediário balanceado NÃO drena (net ~0) e não gera evento', () => {
    // O coração do conserto do item 3: 16 AIF entregam 48 HM/h e 8 HTIF consomem
    // 48 HM/h. O store tem que ficar parado. Antes do fix o motor creditava só
    // metade da entrega (24/h) e fabricava um "empty in 2h" que não existe.
    const r = analyze(selfHarmonizingColony(), 1)
    const flow = r.projection.stores
      .find((s) => s.pinId === PIN_IX_HM_STORAGE)!
      .flows.find((f) => f.typeId === TYPE_HERMETIC_MEMBRANES)!

    expect(flow.inPerHour).toBeCloseTo(48, 6)
    expect(flow.outPerHour).toBeCloseTo(48, 6)
    expect(flow.netPerHour).toBeCloseTo(0, 6)
    expect(flow.timeToEmptyHrs).toBeUndefined()
    expect(eventsFor(r, TYPE_HERMETIC_MEMBRANES)).toEqual([])
  })

  it('teste 3 — local com produção < consumo drena de verdade e vira `degraded`', () => {
    // 8 AIF (24 HM/h) alimentando 8 HTIF (48 HM/h): déficit real de produção.
    // Aqui o net negativo é legítimo — o fix não pode ter escondido isto também.
    const r = analyze(selfHarmonizingColony({ membraneFactories: 8 }), 1)
    const flow = r.projection.stores
      .find((s) => s.pinId === PIN_IX_HM_STORAGE)!
      .flows.find((f) => f.typeId === TYPE_HERMETIC_MEMBRANES)!
    expect(flow.netPerHour).toBeLessThan(0)

    const hm = eventsFor(r, TYPE_HERMETIC_MEMBRANES)
    expect(hm.some((e) => e.kind === 'supply_out')).toBe(false)
    expect(hm.some((e) => e.kind === 'degraded')).toBe(true)
  })

  it('o déficit local classifica a colônia como degradada e pede rebalanceamento', () => {
    const r = analyze(selfHarmonizingColony({ membraneFactories: 8 }), 1)
    expect(r.urgency.bucket).toBe('degraded')
    expect(r.urgency.action.kind).toBe('rebalance_production')
    expect(r.urgency.action.typeName).toBe('Hermetic Membranes')
  })

  it('quando um insumo COMPRADO também está acabando, a compra vem primeiro', () => {
    // O déficit local quase sempre é sintoma: a fábrica a montante parou porque
    // o insumo comprado dela acabou. A ação útil é a compra, não redesenhar.
    const r = analyze(
      selfHarmonizingColony({ membraneFactories: 8, importedAmount: 200 }),
      1
    )
    expect(r.urgency.action.kind).toBe('restock')
  })
})
