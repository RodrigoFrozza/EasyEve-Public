/**
 * Paridade v1 ↔ v2 — o portão da Etapa 1.
 *
 * O núcleo do v2 é um PORTE do núcleo já validado em produção contra o jogo, não
 * uma reescrita. Este arquivo é a prova disso: as mesmas entradas passam pelo
 * `src/lib/pi` (com o motor de projeção e a Fase B1 ligados) e pelo
 * `src/lib/pi-v2`, e os números têm que bater exatamente.
 *
 * Se um destes testes quebrar, ou o porte regrediu, ou alguém mudou o v1 sem
 * mudar o v2 — em qualquer dos casos, a divergência tem que ser explicada antes
 * de seguir, nunca "acertada" mexendo no valor esperado.
 *
 * As duas divergências INTENCIONAIS estão registradas no fim do arquivo.
 */

import { computeDemandModel as computeDemandModelV1 } from '@/lib/pi/demand-model'
import {
  simulateBufferStatus as simulateBufferStatusV1,
  simulatePinBufferStatuses as simulatePinBufferStatusesV1,
} from '@/lib/pi/buffer-sim'
import { buildRouteEdges as buildRouteEdgesV1 } from '@/lib/pi/route-graph'

import { computeDemandModel } from '@/lib/pi-v2/demand'
import {
  aggregateColonyStatus,
  isExportProductionActive,
  simulateStoreBuffers,
} from '@/lib/pi-v2/buffers'
import { resolveConfidence } from '@/lib/pi-v2/projection'

import {
  ANCHOR_ISO,
  ANCHOR_MS,
  HOUR_MS,
  PIN_IX_HM_STORAGE,
  TYPE_HERMETIC_MEMBRANES,
  extractionColony,
  selfHarmonizingColony,
  sterileConduitsColony,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

const CADENCE_HRS = 24

/** −0 e +0 são o mesmo número aqui; só a diferença de valor interessa. */
const num = (n: number | undefined): number | undefined =>
  n === undefined ? undefined : n === 0 ? 0 : n

interface BalanceShape {
  typeId: number
  demandPerHour: number
  extractionPerHour: number
  productionPerHour: number
  localSupplyPerHour: number
  importNeededPerHour: number
  surplusPerHour: number
  exportedPerHour: number
  wastedPerHour: number
  isImported: boolean
  isExportable: boolean
}

const normalizeBalances = (balances: BalanceShape[]) =>
  balances
    .map((b) => ({
      typeId: b.typeId,
      demandPerHour: num(b.demandPerHour),
      extractionPerHour: num(b.extractionPerHour),
      productionPerHour: num(b.productionPerHour),
      localSupplyPerHour: num(b.localSupplyPerHour),
      importNeededPerHour: num(b.importNeededPerHour),
      surplusPerHour: num(b.surplusPerHour),
      exportedPerHour: num(b.exportedPerHour),
      wastedPerHour: num(b.wastedPerHour),
      isImported: b.isImported,
      isExportable: b.isExportable,
    }))
    .sort((a, b) => a.typeId - b.typeId)

interface FlowShape {
  typeId: number
  amount: number
  amountMeasured: number
  projected: boolean
  inPerHour: number
  outPerHour: number
  netPerHour: number
  timeToEmptyHrs?: number
}

interface StoreShape {
  pinId: number
  capacityM3: number
  usedM3: number
  freeM3: number
  timeToFullHrs?: number
  timeToEmptyHrs?: number
  limitingEmptyTypeId?: number
  restockDueHrs?: number
  status: string
  flows: FlowShape[]
}

/** Compara só o que é numérico/estado — o rótulo do pin muda de propósito no v2. */
const normalizeStores = (stores: StoreShape[]) =>
  stores
    .map((s) => ({
      pinId: s.pinId,
      capacityM3: num(s.capacityM3),
      usedM3: num(s.usedM3),
      freeM3: num(s.freeM3),
      timeToFullHrs: num(s.timeToFullHrs),
      timeToEmptyHrs: num(s.timeToEmptyHrs),
      limitingEmptyTypeId: s.limitingEmptyTypeId,
      restockDueHrs: num(s.restockDueHrs),
      status: s.status,
      flows: s.flows
        .map((f) => ({
          typeId: f.typeId,
          amount: num(f.amount),
          amountMeasured: num(f.amountMeasured),
          projected: f.projected,
          inPerHour: num(f.inPerHour),
          outPerHour: num(f.outPerHour),
          netPerHour: num(f.netPerHour),
          timeToEmptyHrs: num(f.timeToEmptyHrs),
        }))
        .sort((a, b) => a.typeId - b.typeId),
    }))
    .sort((a, b) => a.pinId - b.pinId)

/** Reproduz, no v1, exatamente a pipeline que o v2 roda em projectColonyState. */
function runV1(layout: PiColonyLayout, nowMs: number) {
  const demand = computeDemandModelV1(layout as never, nowMs)
  const inflowCapByType = new Map(
    demand.current.map((b) => [
      b.typeId,
      Math.max(0, b.productionPerHour, b.extractionPerHour, b.exportedPerHour),
    ])
  )
  const outflowCapByType = new Map(
    demand.current.map((b) => [b.typeId, Math.max(0, b.demandPerHour)])
  )
  const shared = {
    layout: layout as never,
    balances: demand.current,
    assumeImports: false,
    inflowCapByType,
    outflowCapByType,
    visitCadenceHrs: CADENCE_HRS,
    projectionEnabled: true,
    nowMs,
    lastUpdate: ANCHOR_ISO,
  }
  return {
    demand,
    stores: simulatePinBufferStatusesV1(shared),
    status: simulateBufferStatusV1({ ...shared, edges: buildRouteEdgesV1(layout as never) }),
  }
}

function runV2(layout: PiColonyLayout, nowMs: number) {
  const demand = computeDemandModel(layout, nowMs)
  const confidence = resolveConfidence(ANCHOR_ISO, nowMs)
  const inflowCapByType = new Map(
    demand.current.map((b) => [
      b.typeId,
      Math.max(0, b.productionPerHour, b.extractionPerHour, b.exportedPerHour),
    ])
  )
  const outflowCapByType = new Map(
    demand.current.map((b) => [b.typeId, Math.max(0, b.demandPerHour)])
  )
  const stores = simulateStoreBuffers({
    layout,
    balances: demand.current,
    assumeImports: false,
    inflowCapByType,
    outflowCapByType,
    visitCadenceHrs: CADENCE_HRS,
    projectionHours: confidence.effectiveElapsedHrs,
    snapshotAgeHours: confidence.ageHours,
  })
  return {
    demand,
    stores,
    status: aggregateColonyStatus(stores, CADENCE_HRS, {
      exportProductionActive: isExportProductionActive(demand.current),
    }),
  }
}

/**
 * **O baseline da comparação exige um v1 COM a Fase B1.**
 *
 * O v2 nasceu com a B1 incorporada (vocabulário `degraded` + buffer só-import
 * respeitando a cadência). Enquanto essa fase não estiver na `main`, o v1 não tem
 * com o que ser comparado: a comparação estaria confrontando comportamentos
 * deliberadamente diferentes e acusaria "regressão" onde há evolução.
 *
 * Detectamos em tempo de execução e PULAMOS o bloco, em vez de afrouxar as
 * asserções para caber nos dois mundos. Um teste que passa comparando menos é
 * pior que um teste explicitamente pulado: o primeiro mente sobre a cobertura, o
 * segundo aparece como `skipped` na saída e cobra a decisão. No dia em que a B1
 * entrar na `main`, a comparação volta sozinha, sem ninguém lembrar de reativar.
 *
 * O que fica descoberto aqui está coberto direto no v2 por
 * `project-colony.test.ts` (no ritmo / sub-provisionado / atrasado / suspenso) e
 * por `urgency.test.ts` — nenhum comportamento da B1 fica sem teste.
 */
const v1HasPhaseB1 = (() => {
  // Sonda: um buffer só-import folgado, lido dentro da cadência. Com a B1, o v1
  // suprime o falso "vazio" e publica o horizonte de reposição; sem ela, não.
  const layout = sterileConduitsColony({ waterAmount: 5000 })
  const nowMs = ANCHOR_MS + 21 * HOUR_MS
  const demand = computeDemandModelV1(layout as never, nowMs)
  const stores = simulatePinBufferStatusesV1({
    layout: layout as never,
    balances: demand.current,
    assumeImports: false,
    visitCadenceHrs: CADENCE_HRS,
    projectionEnabled: true,
    nowMs,
    lastUpdate: ANCHOR_ISO,
  })
  return stores.some((s) => (s as { restockDueHrs?: number }).restockDueHrs != null)
})()

describe('baseline da paridade v1 ↔ v2', () => {
  it(
    v1HasPhaseB1
      ? 'v1 tem a Fase B1 — comparação ATIVA'
      : 'v1 ainda SEM a Fase B1 — comparação PULADA (baseline ausente, ver comentário)',
    () => {
      expect(typeof v1HasPhaseB1).toBe('boolean')
    }
  )
})

const parityEach = v1HasPhaseB1 ? describe.each : describe.skip.each

const scenarios: Array<{ name: string; layout: PiColonyLayout; hours: number }> = [
  {
    name: 'planeta-fábrica no caso âncora (21h de drenagem)',
    layout: sterileConduitsColony(),
    hours: 21,
  },
  {
    name: 'planeta-fábrica com snapshot fresco (sem projeção)',
    layout: sterileConduitsColony(),
    hours: 0,
  },
  {
    name: 'planeta-fábrica no ritmo da cadência (buffer folgado)',
    layout: sterileConduitsColony({ waterAmount: 5000 }),
    hours: 21,
  },
  {
    name: 'planeta-fábrica atrasado (idade acima da cadência)',
    layout: sterileConduitsColony({ waterAmount: 5000 }),
    hours: 30,
  },
  {
    name: 'planeta-fábrica com dado suspenso (>72h)',
    layout: sterileConduitsColony({ waterAmount: 5000 }),
    hours: 100,
  },
  {
    name: 'planeta-fábrica com produto já acumulado na saída',
    layout: sterileConduitsColony({ sterileConduitsAmount: 100 }),
    hours: 12,
  },
  {
    name: 'colônia integrada com extrator ativo',
    layout: extractionColony(),
    hours: 6,
  },
  {
    name: 'colônia integrada com extrator vencido',
    layout: extractionColony(),
    hours: 60,
  },
]

parityEach(scenarios)('paridade v1 ↔ v2 — $name', ({ layout, hours }) => {
  const nowMs = ANCHOR_MS + hours * HOUR_MS
  const v1 = runV1(layout, nowMs)
  const v2 = runV2(layout, nowMs)

  it('modelo de demanda "desenho" idêntico', () => {
    expect(normalizeBalances(v2.demand.designed)).toEqual(normalizeBalances(v1.demand.potential))
  })

  it('modelo de demanda "agora" idêntico', () => {
    expect(normalizeBalances(v2.demand.current)).toEqual(normalizeBalances(v1.demand.current))
  })

  it('estado dos stores idêntico (estoque projetado, volume, cronômetros, status)', () => {
    expect(normalizeStores(v2.stores)).toEqual(normalizeStores(v1.stores))
  })

  it('status da colônia idêntico', () => {
    expect({
      status: v2.status.status,
      timeToStopHrs: num(v2.status.timeToStopHrs),
      timeToFullHrs: num(v2.status.timeToFullHrs),
      limitingTypeId: v2.status.limitingTypeId,
      limitingPinId: v2.status.limitingPinId,
    }).toEqual({
      status: v1.status.status,
      timeToStopHrs: num(v1.status.timeToStopHrs),
      timeToFullHrs: num(v1.status.timeToFullHrs),
      limitingTypeId: v1.status.limitingTypeId,
      limitingPinId: v1.status.limitingPinId,
    })
  })
})

/**
 * Divergências INTENCIONAIS do porte — documentadas como teste para que não
 * passem despercebidas nem sejam "corrigidas" de volta por engano.
 */
describe('divergências intencionais do porte', () => {
  it('a idade crua governa a cadência mesmo com a projeção suspensa (v1 já fazia; o v2 preserva)', () => {
    // O v1 usava `elapsedHours` cru para a regra de cadência e o `effectiveElapsed`
    // para avançar estoque. O v2 recebe os dois separados (`snapshotAgeHours` e
    // `projectionHours`) em vez de recalcular — este teste trava esse contrato.
    const nowMs = ANCHOR_MS + 100 * HOUR_MS
    const layout = sterileConduitsColony({ waterAmount: 5000 })
    expect(runV2(layout, nowMs).status.restockDueHrs).toBeUndefined()
    expect(runV2(layout, nowMs).stores.every((s) => s.flows.every((f) => !f.projected))).toBe(true)
  })

  it('o v2 credita a entrega inteira num intermediário integrado; o v1 credita metade (BUG do v1)', () => {
    // Bug herdado do v1 e corrigido só no v2 (decisão do Rodrigo: o v1 vai ser
    // aposentado, não consertado). `scaleThroughputByCap` rateava o teto de
    // produção sobre TODAS as rotas da commodity, inclusive as store → fábrica,
    // que são consumo. O v2 restringe o denominador às rotas que entregam a um
    // store — a mesma restrição que `computeOverflowFractionByType` já fazia.
    //
    // Fixture = a 6-IAFR IX (16 AIF fazem 48 HM/h, 8 HTIF consomem 48 HM/h).
    //   denominador v1: 48 (entrega ao store) + 48 (as 8 HTIF puxando) = 96
    //   fator v1: 48/96 = 0,5  → entrega creditada como 24/h
    //   denominador v2: 48     → fator 1 → entrega creditada como 48/h
    //
    // ANTES (v1): in 24/h, out 48/h, net −24/h → "empty in 2h" num intermediário
    //             perfeitamente balanceado. É o número que apareceu na tela.
    // DEPOIS (v2): in 48/h, out 48/h, net 0 → não drena, nenhum evento.
    //
    // VERIFICADO CONTRA O JOGO: a colônia produz e consome Hermetic Membranes na
    // mesma taxa e o estoque dela não cai — o v2 é que descreve a realidade.
    const nowMs = ANCHOR_MS + 1 * HOUR_MS
    const layout = selfHarmonizingColony()
    const hmFlow = (stores: Array<{ pinId: number; flows: Array<{ typeId: number; inPerHour: number; outPerHour: number; netPerHour: number }> }>) =>
      stores
        .find((s) => s.pinId === PIN_IX_HM_STORAGE)!
        .flows.find((f) => f.typeId === TYPE_HERMETIC_MEMBRANES)!

    const before = hmFlow(runV1(layout, nowMs).stores)
    const after = hmFlow(runV2(layout, nowMs).stores)

    expect(before.inPerHour).toBeCloseTo(24, 6)
    expect(before.outPerHour).toBeCloseTo(48, 6)
    expect(before.netPerHour).toBeCloseTo(-24, 6)

    expect(after.inPerHour).toBeCloseTo(48, 6)
    expect(after.outPerHour).toBeCloseTo(48, 6)
    expect(after.netPerHour).toBeCloseTo(0, 6)
  })

  it('o v2 expõe restockDueHrs no agregado da colônia — o v1 só o tinha por pin', () => {
    // Adição, não mudança: o contador honesto do portfólio ("Z reabastecer em
    // breve") precisa do horizonte no nível da colônia.
    const nowMs = ANCHOR_MS + 21 * HOUR_MS
    const v2 = runV2(sterileConduitsColony({ waterAmount: 5000 }), nowMs)
    expect(v2.status.restockDueHrs).toBeCloseTo(3, 6)
  })
})
