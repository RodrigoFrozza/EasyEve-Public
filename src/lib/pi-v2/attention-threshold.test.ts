/**
 * Régua do contador honesto: **âmbar só no último terço da cadência.**
 *
 * A régua anterior era "antes da próxima visita" (`cadência − idade`). Parecia
 * certa e falhou na tela: com cadência de 24h o limiar ficava em ~22,5h e **32
 * de 35 colônias apareciam em atenção**. Contador que acusa quase tudo não
 * informa nada — é o mesmo mal dos "26 stalled", com outra cor.
 *
 * O limiar é DERIVADO da cadência (÷ `ATTENTION_DIVISOR`), nunca um número de
 * horas chutado: quem visita a cada 48h ganha 16h de antecedência, e a régua
 * continua sendo a mesma fração do ciclo de quem opera o planeta.
 */

import {
  ATTENTION_DIVISOR,
  attentionThresholdHrs,
  deriveColonyEvents,
  isProblem,
} from '@/lib/pi-v2/events'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony, countBuckets } from '@/lib/pi-v2/urgency'
import {
  ANCHOR_ISO,
  HOUR_MS,
  TYPE_WATER,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'

describe('attentionThresholdHrs', () => {
  it('é a cadência dividida pelo divisor nomeado, não uma constante de horas', () => {
    expect(ATTENTION_DIVISOR).toBe(3)
    expect(attentionThresholdHrs(24)).toBeCloseTo(8, 6)
    expect(attentionThresholdHrs(48)).toBeCloseTo(16, 6)
    expect(attentionThresholdHrs(12)).toBeCloseTo(4, 6)
  })
})

/**
 * Monta uma colônia cujo insumo COMPRADO (Water) acaba em `hoursToEmpty`, para
 * um instante e uma cadência dados. Water sai a 200/h, então o estoque projetado
 * precisa valer `200 × horas` quando o relógio chegar em `nowMs`.
 *
 * O snapshot é lido no próprio instante da projeção (elapsed 0) de propósito: o
 * limiar não pode depender da idade do dado — ela já está embutida no `inHours`,
 * e somá-la de novo contaria duas vezes.
 */
function colonyEmptyingIn(hoursToEmpty: number, cadenceHrs: number) {
  const nowMs = Date.parse(ANCHOR_ISO)
  const projection = projectColonyState({
    summary: summaryWithLastUpdate(ANCHOR_ISO),
    layout: sterileConduitsColony({ waterAmount: 200 * hoursToEmpty }),
    contract: { visitCadenceHrs: cadenceHrs },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    projection,
    events,
    urgency: classifyColony(projection, events),
    water: events.find((e) => e.typeId === TYPE_WATER),
  }
}

describe('severidade pelo último terço da cadência', () => {
  it('teste 1 — cadência 24h, evento em 20h → info (fora do contador)', () => {
    const r = colonyEmptyingIn(20, 24)
    expect(r.water?.severity).toBe('info')
    expect(r.urgency.bucket).not.toBe('attention')
  })

  it('teste 2 — cadência 24h, evento em 7h → âmbar', () => {
    const r = colonyEmptyingIn(7, 24)
    expect(r.water?.severity).toBe('amber')
    expect(r.urgency.bucket).toBe('attention')
  })

  it('teste 3 — evento em 0h → vermelho', () => {
    const r = colonyEmptyingIn(0, 24)
    expect(r.water?.severity).toBe('red')
  })

  it('teste 4 — cadência 48h, evento em 12h → âmbar (limiar 16h)', () => {
    const r = colonyEmptyingIn(12, 48)
    expect(r.water?.severity).toBe('amber')
    expect(r.urgency.bucket).toBe('attention')
  })

  it('teste 5 — cadência 24h, evento em 9h → info (trava a fronteira dos 8h)', () => {
    const r = colonyEmptyingIn(9, 24)
    expect(r.water?.severity).toBe('info')
    expect(r.urgency.bucket).not.toBe('attention')
  })

  it('a fronteira é inclusiva no limiar exato', () => {
    expect(colonyEmptyingIn(8, 24).water?.severity).toBe('amber')
    expect(colonyEmptyingIn(8.01, 24).water?.severity).toBe('info')
  })
})

describe('o contador para de gritar', () => {
  it('35 colônias no ritmo somam ZERO em atenção', () => {
    // A regressão que este item existe para impedir: com a régua antiga, um
    // portfólio inteiro rodando normalmente marcava 32 de 35 em âmbar.
    const buckets = Array.from({ length: 35 }, () => colonyEmptyingIn(20, 24).urgency.bucket)
    const counters = countBuckets(buckets)
    expect(counters.attention).toBe(0)
    expect(counters.total).toBe(35)
  })

  it('só quem está no último terço entra no contador de atenção', () => {
    const buckets = [
      ...Array.from({ length: 30 }, () => colonyEmptyingIn(20, 24).urgency.bucket),
      ...Array.from({ length: 3 }, () => colonyEmptyingIn(5, 24).urgency.bucket),
    ]
    expect(countBuckets(buckets).attention).toBe(3)
  })

  it('informativo não é problema, mas continua visível no detalhe', () => {
    const r = colonyEmptyingIn(20, 24)
    expect(r.events.some((e) => !isProblem(e))).toBe(true)
    expect(r.events.some(isProblem)).toBe(false)
  })

  it('a colônia no ritmo ainda diz o que comprar, com o item e o prazo', () => {
    // "Nada a fazer" com o buffer descendo seria mentira por omissão.
    const r = colonyEmptyingIn(20, 24)
    expect(r.urgency.bucket).toBe('restock_soon')
    expect(r.urgency.action.kind).toBe('restock')
    expect(r.urgency.action.typeName).toBe('Water')
    expect(r.urgency.action.dueInHours).toBeCloseTo(20, 1)
  })
})

describe('o limiar não conta a idade do snapshot duas vezes', () => {
  it('mesma autonomia restante → mesma severidade, com dado fresco ou velho', () => {
    const cadence = 24
    // Dado fresco: 1.400 de Water a −200/h = 7h de autonomia.
    const fresh = colonyEmptyingIn(7, cadence)

    // Dado de 10h atrás: o snapshot tinha 3.400, a projeção já drenou 2.000 e
    // sobram as MESMAS 7h. A cor tem que ser a mesma.
    const nowMs = Date.parse(ANCHOR_ISO) + 10 * HOUR_MS
    const projection = projectColonyState({
      summary: summaryWithLastUpdate(ANCHOR_ISO),
      layout: sterileConduitsColony({ waterAmount: 3400 }),
      contract: { visitCadenceHrs: cadence },
      nowMs,
    })
    const aged = deriveColonyEvents(projection, nowMs).find((e) => e.typeId === TYPE_WATER)

    expect(aged?.inHours).toBeCloseTo(7, 6)
    expect(aged?.severity).toBe(fresh.water?.severity)
    expect(aged?.severity).toBe('amber')
  })
})
