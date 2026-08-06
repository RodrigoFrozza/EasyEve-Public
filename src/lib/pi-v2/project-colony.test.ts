import { projectColonyState } from '@/lib/pi-v2/project-colony'
import {
  ANCHOR_ISO,
  ANCHOR_MS,
  HOUR_MS,
  PIN_EXPORT_LAUNCHPAD,
  PIN_IMPORT_LAUNCHPAD,
  TYPE_STERILE_CONDUITS,
  TYPE_WATER,
  extractionColony,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'

const summary = summaryWithLastUpdate(ANCHOR_ISO)

function project(layout = sterileConduitsColony(), hoursAfterSnapshot = 21, cadence = 24) {
  return projectColonyState({
    summary,
    layout,
    contract: { visitCadenceHrs: cadence },
    nowMs: ANCHOR_MS + hoursAfterSnapshot * HOUR_MS,
  })
}

function waterFlow(state: ReturnType<typeof project>) {
  const store = state.stores.find((s) => s.pinId === PIN_IMPORT_LAUNCHPAD)
  return store!.flows.find((f) => f.typeId === TYPE_WATER)!
}

describe('projectColonyState — o caso âncora da 6-IAFR I', () => {
  it('deriva −200/h de Water das rotas, sem nenhuma configuração', () => {
    expect(waterFlow(project()).outPerHour).toBeCloseTo(200, 6)
    expect(waterFlow(project()).inPerHour).toBe(0)
  })

  it('avança o estoque do snapshot até agora: 4.600 → ~400 em 21h', () => {
    const flow = waterFlow(project())
    expect(flow.amountMeasured).toBe(4600)
    expect(flow.amount).toBeCloseTo(400, 6)
    expect(flow.projected).toBe(true)
  })

  it('o volume ocupado também anda — a launchpad não fica presa em 75%', () => {
    const snapshot = project(sterileConduitsColony(), 0)
    const projected = project(sterileConduitsColony(), 21)
    const at = (s: typeof snapshot) => s.stores.find((x) => x.pinId === PIN_IMPORT_LAUNCHPAD)!
    expect(at(projected).usedM3).toBeLessThan(at(snapshot).usedM3)
    expect(at(projected).freeM3).toBeGreaterThan(at(snapshot).freeM3)
  })

  it('"esvazia em Xh" é relativo a AGORA, não ao snapshot', () => {
    // 400 restantes a −200/h = 2h, não as 23h que o snapshot cru sugeriria.
    expect(waterFlow(project()).timeToEmptyHrs).toBeCloseTo(2, 6)
  })

  it('elapsed 0 → nada projetado, tudo igual ao medido', () => {
    const flow = waterFlow(project(sterileConduitsColony(), 0))
    expect(flow.amount).toBe(flow.amountMeasured)
    expect(flow.projected).toBe(false)
  })

  it('acima de 72h suspende a projeção e mostra o snapshot cru', () => {
    const state = project(sterileConduitsColony(), 100)
    const flow = waterFlow(state)
    expect(state.confidence.band).toBe('suspended')
    expect(state.confidence.projectionApplied).toBe(false)
    expect(flow.amount).toBe(flow.amountMeasured)
    expect(flow.projected).toBe(false)
  })

  it('sem last_update não projeta e diz que não projetou', () => {
    const state = projectColonyState({
      summary: summaryWithLastUpdate(undefined),
      layout: sterileConduitsColony(),
      nowMs: ANCHOR_MS + 21 * HOUR_MS,
    })
    expect(state.confidence.projectionApplied).toBe(false)
    expect(waterFlow(state).projected).toBe(false)
  })
})

describe('selo de confiança', () => {
  it.each([
    [0.5, 'live'],
    [5, 'estimated'],
    [48, 'diverging'],
    [100, 'suspended'],
  ])('idade de %ph → banda %s', (hours, band) => {
    const state = project(sterileConduitsColony(), hours as number)
    expect(state.confidence.band).toBe(band)
    expect(state.confidence.ageHours).toBeCloseTo(hours as number, 6)
    expect(state.confidence.anchorIso).toBe(ANCHOR_ISO)
  })
})

describe('Fase B1 — buffer só-import respeita a cadência', () => {
  it('no ritmo: buffer que aguenta a cadência não vira alarme, vira "reabastecer em Xh"', () => {
    // 5.000 de Water a −200/h = 25h de autonomia contra cadência de 24h.
    const state = project(sterileConduitsColony({ waterAmount: 5000 }), 21, 24)
    const flow = waterFlow(state)
    expect(flow.timeToEmptyHrs).toBeUndefined()
    expect(state.status.restockDueHrs).toBeCloseTo(3, 6)
    expect(state.status.status).not.toBe('stalled')
  })

  it('sub-provisionado: buffer que nem cheio aguenta a cadência continua alertando', () => {
    // 4.600 a −200/h = 23h de autonomia, abaixo da cadência de 24h. O horizonte
    // de reposição dos OUTROS insumos (folgados) não pode silenciar este.
    const state = project(sterileConduitsColony({ waterAmount: 4600 }), 21, 24)
    expect(waterFlow(state).timeToEmptyHrs).toBeCloseTo(2, 6)
    expect(state.status.timeToStopHrs).toBeCloseTo(2, 6)
    expect(state.status.status).toBe('starving_soon')
  })

  it('atrasado: idade acima da cadência mantém o alerta real', () => {
    // Idade 30h > cadência 24h: nenhum buffer só-import ganha perdão, nem os
    // folgados — a reposição venceu para todos.
    const state = project(sterileConduitsColony({ waterAmount: 5000 }), 30, 24)
    expect(waterFlow(state).timeToEmptyHrs).toBeCloseTo(0, 6)
    expect(state.status.restockDueHrs).toBeUndefined()
  })

  it('atrasado E com projeção suspensa (>72h) continua sendo atraso, não "no ritmo"', () => {
    // A regressão que o porte quase introduziu: acima de 72h o avanço de estoque
    // zera, mas a IDADE do snapshot continua dizendo que a reposição venceu.
    const state = project(sterileConduitsColony({ waterAmount: 5000 }), 100, 24)
    expect(state.confidence.projectionApplied).toBe(false)
    expect(state.status.restockDueHrs).toBeUndefined()
  })
})

describe('vocabulário de status', () => {
  it('colônia entregando produção à saída é degradada, nunca parada', () => {
    // Com 21h de drenagem o insumo secou, mas as 5 fábricas seguem exportando.
    const state = project(sterileConduitsColony({ waterAmount: 4600 }), 23.1, 24)
    expect(state.status.status).toBe('degraded')
  })

  it('colônia sem nada saindo continua parada', () => {
    // Sem rota de export não há produção entregue → volta a ser catástrofe real.
    const layout = sterileConduitsColony({ waterAmount: 4600 })
    layout.routes = layout.routes.filter((r) => r.content_type_id !== TYPE_STERILE_CONDUITS)
    const state = project(layout, 23.1, 24)
    expect(state.status.status).toBe('stalled')
  })
})

describe('derivação a partir do layout', () => {
  it('classifica planeta-fábrica e planeta com extrator sem configuração', () => {
    expect(project().colonyRole).toBe('factory_only')
    expect(project(extractionColony()).colonyRole).toBe('integrated')
  })

  it('deriva a produção desenhada de 5 Sterile Conduits/h das rotas + schematics', () => {
    const designed = project().balances.designed
    const output = designed.find((b) => b.typeId === TYPE_STERILE_CONDUITS)
    expect(output?.productionPerHour).toBeCloseTo(5, 6)
    expect(output?.exportedPerHour).toBeCloseTo(5, 6)
  })

  it('marca os três insumos como importados (a lista de compra sai daqui)', () => {
    const imported = project()
      .balances.designed.filter((b) => b.isImported)
      .map((b) => b.typeId)
      .sort((a, b) => a - b)
    expect(imported).toEqual([2351, 3645, 28974])
  })

  it('a launchpad de saída acumula produto ao longo do tempo', () => {
    const at = (hours: number) =>
      project(sterileConduitsColony(), hours)
        .stores.find((s) => s.pinId === PIN_EXPORT_LAUNCHPAD)!
        .flows.find((f) => f.typeId === TYPE_STERILE_CONDUITS)!.amount
    expect(at(0)).toBe(0)
    expect(at(10)).toBeCloseTo(50, 6) // 5/h × 10h
  })

  it('extrator vencido reporta 0 corrente e a hora do vencimento', () => {
    const state = projectColonyState({
      summary,
      layout: extractionColony(),
      nowMs: Date.parse('2026-07-24T00:00:00Z'),
    })
    const extractor = state.extractors[0]
    expect(extractor.isExpired).toBe(true)
    expect(extractor.currentUnitsPerHour).toBe(0)
    expect(extractor.designedUnitsPerHour).toBeGreaterThan(0)
    expect(extractor.expiresInHrs).toBeLessThan(0)
  })
})
