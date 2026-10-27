import { deriveColonyEvents, eventKey, mostUrgentEvent } from '@/lib/pi-v2/events'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import {
  BUCKET_RANK,
  classifyColony,
  compareUrgency,
  countBuckets,
  type ColonyBucket,
} from '@/lib/pi-v2/urgency'
import {
  ANCHOR_ISO,
  HOUR_MS,
  PIN_EXPORT_LAUNCHPAD,
  TYPE_STERILE_CONDUITS,
  TYPE_WATER,
  extractionColony,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

/**
 * `lastUpdate` é parametrizável porque "extrator vencido" e "dado velho demais"
 * são situações DIFERENTES que a âncora única confundia: para ver um extrator
 * vencido com dado fresco é preciso um snapshot mais recente que o install.
 */
function analyze(
  layout: PiColonyLayout,
  hoursAfterSnapshot: number,
  cadence = 24,
  lastUpdate = ANCHOR_ISO
) {
  const nowMs = Date.parse(lastUpdate) + hoursAfterSnapshot * HOUR_MS
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(lastUpdate),
    layout,
    contract: { visitCadenceHrs: cadence },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return { projection, events, urgency: classifyColony(projection, events), nowMs }
}

/** Snapshot recente o bastante para o extrator (expiry 23/07) ainda estar vivo. */
const FRESH_EXTRACTOR_ANCHOR = '2026-07-22T12:00:00Z'

describe('deriveColonyEvents — as três camadas de cobertura', () => {
  it('camada 1: insumo acabando vira evento com hora e commodity', () => {
    const { events, nowMs } = analyze(sterileConduitsColony(), 21)
    const supply = events.find((e) => e.kind === 'supply_out')
    expect(supply).toBeDefined()
    expect(supply!.typeId).toBe(TYPE_WATER)
    expect(supply!.inHours).toBeCloseTo(2, 6) // 400 restantes a −200/h
    expect(supply!.atMs).toBeCloseTo(nowMs + 2 * HOUR_MS, -2)
    expect(supply!.severity).toBe('amber')
  })

  it('camada 2: espaço acabando vira evento no pin de saída', () => {
    // 100 Sterile Conduits × 50 m³ = 5.000 de 10.000 m³. A 5/h (250 m³/h) a
    // launchpad de saída lota em 20h — dentro da cadência de 24h.
    const { events } = analyze(sterileConduitsColony({ sterileConduitsAmount: 100 }), 0)
    const space = events.find((e) => e.kind === 'space_out')
    expect(space).toBeDefined()
    expect(space!.pinId).toBe(PIN_EXPORT_LAUNCHPAD)
    expect(space!.inHours).toBeCloseTo(20, 6)
  })

  it('não inventa urgência: saída vazia não lota dentro do horizonte', () => {
    const { events } = analyze(sterileConduitsColony({ sterileConduitsAmount: 0 }), 1)
    expect(events.some((e) => e.kind === 'space_out')).toBe(false)
  })

  it('camada 3: extrator expirando vira evento com o produto', () => {
    // Snapshot 22/07 12:00, agora +2h; o extrator expira em 23/07 00:00 → 10h.
    // Reportado, mas ainda INFO: 10h está fora do limiar de atenção (24h ÷ 3 = 8h).
    const { events } = analyze(extractionColony(), 2, 24, FRESH_EXTRACTOR_ANCHOR)
    const expiry = events.find((e) => e.kind === 'extractor_expiry')
    expect(expiry).toBeDefined()
    expect(expiry!.inHours).toBeCloseTo(10, 6)
    expect(expiry!.severity).toBe('info')
  })

  it('camada 3: dentro do último terço da cadência, o extrator vira âmbar', () => {
    // Agora +6h → expira em 6h, abaixo do limiar de 8h.
    const { events, urgency } = analyze(extractionColony(), 6, 24, FRESH_EXTRACTOR_ANCHOR)
    const expiry = events.find((e) => e.kind === 'extractor_expiry')
    expect(expiry!.inHours).toBeCloseTo(6, 6)
    expect(expiry!.severity).toBe('amber')
    expect(urgency.bucket).toBe('attention')
    expect(urgency.action.kind).toBe('restart_extractor')
  })

  it('extrator já vencido é vermelho, não âmbar', () => {
    const { events } = analyze(extractionColony(), 16, 24, FRESH_EXTRACTOR_ANCHOR)
    const expiry = events.find((e) => e.kind === 'extractor_expiry')
    expect(expiry?.inHours).toBeLessThanOrEqual(0)
    expect(expiry?.severity).toBe('red')
  })

  it('não reporta evento além do horizonte — futuro distante não é urgência', () => {
    // 20.000 Water = 100h de autonomia (e 3.800 m³, que ainda cabem).
    const { events } = analyze(sterileConduitsColony({ waterAmount: 20_000 }), 1, 24)
    expect(events.some((e) => e.kind === 'supply_out')).toBe(false)
  })

  it('reposição no ritmo é info, não alarme', () => {
    const { events } = analyze(sterileConduitsColony({ waterAmount: 5000 }), 21, 24)
    const restock = events.find((e) => e.kind === 'restock_due')
    expect(restock?.severity).toBe('info')
    expect(restock?.inHours).toBeCloseTo(3, 6)
  })

  it('dado passado de 72h vira evento próprio — nada mais na tela é afirmável', () => {
    const { events } = analyze(sterileConduitsColony(), 100)
    const suspended = events.find((e) => e.kind === 'data_suspended')
    expect(suspended?.severity).toBe('red')
  })

  it('ordena por proximidade e o mais urgente é o problema, não o informativo', () => {
    // Water sub-provisionada seca em 2h (problema); os outros dois insumos estão
    // no ritmo e publicam reposição em 3h (informativo). O problema tem que ganhar.
    const { events } = analyze(sterileConduitsColony({ waterAmount: 4600 }), 21, 24)
    expect(events.map((e) => e.inHours)).toEqual(
      [...events.map((e) => e.inHours)].sort((a, b) => a - b)
    )
    expect(events.some((e) => e.kind === 'restock_due')).toBe(true)
    expect(mostUrgentEvent(events)?.kind).toBe('supply_out')
  })

  it('evento que cai DEPOIS da próxima visita é ciclo normal, não alarme', () => {
    // Visita em 3h (cadência 24 − idade 21); a launchpad de saída só lota em 19h.
    const { events } = analyze(sterileConduitsColony({ waterAmount: 5000 }), 21, 24)
    const space = events.find((e) => e.kind === 'space_out')
    expect(space?.severity).toBe('info')
  })

  it('agrupa por tipo+pin para o anti-spam (não por commodity)', () => {
    const { events } = analyze(sterileConduitsColony(), 21)
    const keys = events.filter((e) => e.kind === 'supply_out').map(eventKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('classifyColony — a ordenação é por urgência de ação, não por ISK', () => {
  it('saída morta → parado', () => {
    const layout = sterileConduitsColony({ waterAmount: 4600 })
    layout.routes = layout.routes.filter((r) => r.content_type_id !== TYPE_STERILE_CONDUITS)
    expect(analyze(layout, 23.1).urgency.bucket).toBe('stalled')
  })

  it('produzindo com pin seco → degradado, e a ação é repor o insumo que falta', () => {
    const { urgency } = analyze(sterileConduitsColony({ waterAmount: 4600 }), 23.1)
    expect(urgency.bucket).toBe('degraded')
    expect(urgency.action.kind).toBe('restock')
    expect(urgency.action.typeId).toBe(TYPE_WATER)
  })

  it('vai secar antes da visita → atenção com prazo', () => {
    const { urgency } = analyze(sterileConduitsColony({ waterAmount: 4600 }), 21)
    expect(urgency.bucket).toBe('attention')
    expect(urgency.action.kind).toBe('restock')
    expect(urgency.action.dueInHours).toBeCloseTo(2, 6)
  })

  it('no ritmo → reabastecer em breve, nunca alarme', () => {
    const { urgency } = analyze(sterileConduitsColony({ waterAmount: 5000 }), 21)
    expect(urgency.bucket).toBe('restock_soon')
    expect(urgency.action.kind).toBe('restock')
    expect(urgency.action.dueInHours).toBeCloseTo(3, 6)
  })

  it('tudo folgado → rodando, sem ação', () => {
    const { urgency } = analyze(sterileConduitsColony({ waterAmount: 20_000 }), 1)
    expect(urgency.bucket).toBe('running')
    expect(urgency.action.kind).toBe('none')
  })

  it('extrator vencido pede resurvey — a ação mais específica vence as outras', () => {
    // Dado FRESCO (8h) com extrator vencido há 4h: a ação é o resurvey, não
    // "abra no jogo" — só o dado velho demais justifica aquela.
    const { projection, urgency } = analyze(extractionColony(), 16, 24, FRESH_EXTRACTOR_ANCHOR)
    expect(projection.confidence.projectionApplied).toBe(true)
    expect(urgency.bucket).toBe('attention')
    expect(urgency.action.kind).toBe('restart_extractor')
  })

  it('dado suspenso pede abrir a colônia no jogo — a única ação honesta', () => {
    const { urgency } = analyze(sterileConduitsColony({ waterAmount: 4600 }), 100)
    expect(urgency.action.kind).toBe('open_in_game')
    expect(urgency.bucket).toBe('attention')
  })
})

describe('contador honesto do portfólio', () => {
  it('separa parado, degradado e reabastecer em vez de colapsar tudo em vermelho', () => {
    const counters = countBuckets([
      'stalled',
      'degraded',
      'degraded',
      'restock_soon',
      'restock_soon',
      'restock_soon',
      'running',
      'attention',
      'losing',
    ])
    expect(counters).toEqual({
      total: 9,
      stalled: 1,
      losing: 1,
      degraded: 2,
      attention: 1,
      restockSoon: 3,
      running: 1,
    })
  })

  it('portfólio inteiro no ritmo conta ZERO parados', () => {
    // A regressão que a Fase B1 existe para impedir: 35 planetas reabastecidos a
    // cada 24h, lidos 21h depois, não podem somar 35 "parados".
    const buckets: ColonyBucket[] = Array.from({ length: 35 }, () => {
      const { urgency } = analyze(sterileConduitsColony({ waterAmount: 5000 }), 21)
      return urgency.bucket
    })
    const counters = countBuckets(buckets)
    expect(counters.stalled).toBe(0)
    expect(counters.restockSoon).toBe(35)
  })
})

describe('compareUrgency', () => {
  const at = (rank: number, dueInHours: number | undefined, planetId: number) => ({
    planetId,
    urgency: {
      bucket: 'attention' as ColonyBucket,
      rank,
      action: { kind: 'restock' as const, dueInHours },
    },
  })

  it('balde mais grave primeiro', () => {
    expect(compareUrgency(at(BUCKET_RANK.stalled, 10, 1), at(BUCKET_RANK.running, 0, 2))).toBeLessThan(0)
  })

  it('dentro do balde, quem vence antes vem primeiro', () => {
    expect(compareUrgency(at(3, 2, 1), at(3, 10, 2))).toBeLessThan(0)
  })

  it('sem prazo vai para o fim do balde', () => {
    expect(compareUrgency(at(3, undefined, 1), at(3, 99, 2))).toBeGreaterThan(0)
  })

  it('desempate estável: a lista não dança entre polls', () => {
    expect(compareUrgency(at(3, 5, 10), at(3, 5, 2))).toBeGreaterThan(0)
  })
})
