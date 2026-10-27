/**
 * Eventos com hora — "o que vai quebrar, e quando".
 *
 * É a matéria-prima da pergunta 1. A projeção diz onde a colônia está agora; os
 * eventos dizem o que acontece a seguir e em quanto tempo. Consumidos por dois
 * lados: a UI (card e detalhe) e o scheduler (alerta com o app fechado).
 *
 * **Três camadas de cobertura** (padrão do Industrial EVE, o único concorrente
 * que cobre as três): insumo acabando, espaço acabando e extrator expirando. A
 * maioria das ferramentas só alerta extrator — e fábrica travada por falta de
 * insumo é justamente a dor do perfil-fábrica.
 *
 * A quarta camada é nossa: `restock_due` não é problema, é o ritmo normal. Ela
 * existe para o contador honesto poder separar "reabastecer em breve" de
 * "parado" em vez de pintar tudo de vermelho.
 */

import type { ColonyProjection } from '@/lib/pi-v2/project-colony'
import { getCommodityName } from '@/lib/pi-v2/sde'

export type ColonyEventKind =
  /**
   * Camada 1: um buffer de insumo COMPRADO vai zerar (ou já zerou).
   * Só para o que o jogador repõe indo ao mercado — "restockar" o que a própria
   * colônia fabrica não é uma ação que exista.
   */
  | 'supply_out'
  /**
   * Intermediário LOCAL cujo consumo supera a produção. Não é falta de compra: é
   * a cadeia a montante não acompanhando a de jusante. Reusa o vocabulário
   * `degraded` da Fase B1 — produz abaixo do desenhado, não parou.
   */
  | 'degraded'
  /** Camada 2: um store vai lotar (ou já lotou) e a produção se perde. */
  | 'space_out'
  /** Camada 3: o programa do extrator vai vencer (ou já venceu). */
  | 'extractor_expiry'
  /** Ritmo normal: a reposição declarada vence em Xh. Informativo. */
  | 'restock_due'
  /** O dado passou de 72h: não dá para projetar nada. Abrir a colônia no jogo. */
  | 'data_suspended'

export type EventSeverity = 'info' | 'amber' | 'red'

export interface ColonyEvent {
  kind: ColonyEventKind
  severity: EventSeverity
  /** Horas a partir de agora. <= 0 significa que já aconteceu. */
  inHours: number
  /** Instante absoluto do evento. */
  atMs: number
  pinId?: number
  pinLabel?: string
  typeId?: number
  typeName?: string
}

/**
 * Antecedência default do aviso de reposição. Distinta do horizonte de problema
 * de propósito — ver `DeriveEventsOptions`.
 */
export const DEFAULT_RESTOCK_LEAD_HRS = 6

/**
 * O limiar de atenção é a cadência dividida por isto: com visita a cada 24h, só
 * vira âmbar o que acaba em menos de 8h.
 *
 * **Derivado da cadência, nunca uma constante de horas chutada** — quem visita a
 * cada 48h ganha 16h de antecedência, e a régua continua sendo a mesma fração do
 * ciclo de quem opera o planeta.
 *
 * Nomeado (e não inline) porque é o número que decide o quanto o contador grita:
 * é candidato natural a virar configuração quando a Etapa 4 chegar.
 */
export const ATTENTION_DIVISOR = 3

/** Última fração da cadência em que um evento futuro passa a exigir ação. */
export function attentionThresholdHrs(cadenceHrs: number): number {
  return cadenceHrs / ATTENTION_DIVISOR
}

export interface DeriveEventsOptions {
  /**
   * Até onde os eventos são REPORTADOS. Default: a cadência de visita — o que
   * cai além dela é futuro, não planejamento desta visita. Reportar não é
   * alarmar: dentro deste horizonte, quem decide a cor é o limiar de atenção
   * (`ATTENTION_DIVISOR`); o que fica entre os dois aparece como informação.
   */
  horizonHrs?: number
  /**
   * Antecedência do aviso de REPOSIÇÃO no ritmo. Precisa ser menor que o
   * horizonte, senão o evento dispara o tempo todo: o horizonte de reposição é
   * `cadência − idade`, que por definição cabe sempre dentro da cadência. Com
   * lead time próprio, "reabastecer em breve" volta a significar *em breve*.
   */
  restockLeadHrs?: number
}

const HOUR_MS = 3_600_000

/**
 * Severidade pelo **último terço da cadência**.
 *
 *  - já aconteceu                       → vermelho
 *  - acaba dentro do limiar de atenção  → âmbar: precisa de ação
 *  - acaba depois do limiar             → info: está no ritmo
 *
 * `inHours` já é relativo a AGORA (a projeção avançou o estoque até aqui), então
 * a idade do snapshot está embutida — somá-la de novo contaria duas vezes.
 *
 * Substituiu a régua anterior, que era "antes da próxima visita"
 * (`cadência − idade`). Aquela parecia certa no papel e falhou na tela: com
 * cadência de 24h o limiar ficava em ~22,5h e **32 de 35 colônias apareciam em
 * âmbar**. Um contador que acusa quase tudo não informa nada — é o mesmo mal dos
 * "26 stalled" com outra cor. Avisar no último terço dá tempo de agir e mantém o
 * número pequeno o bastante para ser lido.
 */
function severityFor(inHours: number, attentionHrs: number): EventSeverity {
  if (inHours <= 0) return 'red'
  return inHours <= attentionHrs ? 'amber' : 'info'
}

function push(
  events: ColonyEvent[],
  nowMs: number,
  horizonHrs: number,
  attentionHrs: number,
  event: Omit<ColonyEvent, 'atMs' | 'severity'> & { severity?: EventSeverity }
): void {
  if (!Number.isFinite(event.inHours)) return
  if (event.inHours > horizonHrs) return // ainda longe: não é urgência, é futuro
  events.push({
    ...event,
    severity: event.severity ?? severityFor(event.inHours, attentionHrs),
    atMs: nowMs + event.inHours * HOUR_MS,
  })
}

/** Um evento que exige ação — descarta o ciclo normal e o meramente informativo. */
export function isProblem(event: ColonyEvent): boolean {
  return event.severity !== 'info'
}

/**
 * Deriva os eventos de uma colônia projetada. Puro: não lê relógio nem rede — o
 * `nowMs` é o mesmo instante usado para projetar, senão o evento e o estoque
 * exibido descrevem momentos diferentes.
 */
export function deriveColonyEvents(
  projection: ColonyProjection,
  nowMs: number,
  options: DeriveEventsOptions = {}
): ColonyEvent[] {
  const horizonHrs = options.horizonHrs ?? projection.cadenceHrs
  const restockLeadHrs = Math.min(
    options.restockLeadHrs ?? DEFAULT_RESTOCK_LEAD_HRS,
    horizonHrs
  )
  // O limiar de atenção: o último terço da cadência. Só o que quebra dentro dele
  // vira âmbar e entra no contador; o resto é ritmo normal.
  const attentionHrs = attentionThresholdHrs(projection.cadenceHrs)
  const events: ColonyEvent[] = []

  // Dado velho demais para projetar. Vem primeiro porque invalida a leitura de
  // tudo o mais: os cronômetros abaixo passam a ser do snapshot, não de agora.
  if (!projection.confidence.projectionApplied && projection.confidence.ageHours > 0) {
    push(events, nowMs, horizonHrs, attentionHrs, {
      kind: 'data_suspended',
      severity: 'red',
      inHours: 0,
    })
  }

  // "Isto se compra ou se fabrica aqui?" — a pergunta que decide se cabe pedir
  // uma reposição. Vem do balanço de DESENHO, que é o mesmo que a UI mostra na
  // tabela de commodities; nada é recalculado aqui.
  const balanceByType = new Map(projection.balances.designed.map((b) => [b.typeId, b]))

  for (const store of projection.stores) {
    // Camada 1 — buffer esvaziando. O rótulo depende da ORIGEM da commodity:
    // comprada → reposição; fabricada aqui → problema de produção.
    if (store.timeToEmptyHrs != null && store.limitingEmptyTypeId != null) {
      const typeId = store.limitingEmptyTypeId
      const balance = balanceByType.get(typeId)
      const where = {
        inHours: store.timeToEmptyHrs,
        pinId: store.pinId,
        pinLabel: store.label,
        typeId,
        typeName: getCommodityName(typeId),
      }
      const isBought = balance != null && balance.isImported && balance.importNeededPerHour > 0

      if (isBought) {
        push(events, nowMs, horizonHrs, attentionHrs, { kind: 'supply_out', ...where })
      } else if (balance != null && balance.localSupplyPerHour < balance.demandPerHour) {
        // Produzida aqui e a produção não cobre o consumo: a cadeia a montante é
        // o gargalo. Não há o que repor comprando — é âmbar de produção.
        push(events, nowMs, horizonHrs, attentionHrs, { kind: 'degraded', ...where })
      }
      // Produzida aqui e balanceada (produz >= consome): o buffer passa em regime.
      // Nenhum evento — inventar urgência aqui é o ruído que a tela existe para
      // não ter. Se ainda assim o estoque drena, o problema é do motor, não do
      // alerta: um intermediário balanceado não pode esvaziar.
    }

    // Camada 2 — espaço acabando. Store cheio não adia entrega: perde produção,
    // porque fábrica e extrator não guardam a própria saída.
    if (store.timeToFullHrs != null) {
      push(events, nowMs, horizonHrs, attentionHrs, {
        kind: 'space_out',
        inHours: store.timeToFullHrs,
        pinId: store.pinId,
        pinLabel: store.label,
      })
    }

    // Ritmo normal — a reposição declarada vence. Não é problema, e por isso
    // usa a antecedência de aviso, não o horizonte de problema.
    if (store.restockDueHrs != null) {
      push(events, nowMs, restockLeadHrs, attentionHrs, {
        kind: 'restock_due',
        severity: 'info',
        inHours: store.restockDueHrs,
        pinId: store.pinId,
        pinLabel: store.label,
      })
    }
  }

  // Camada 3 — extrator expirando. A ESI é read-only: não dá para reiniciar por
  // aqui, só avisar. É a dor nº 1 dos jogadores e é estruturalmente insolúvel
  // por terceiros — avisar a tempo é tudo o que se pode fazer.
  for (const extractor of projection.extractors) {
    if (extractor.expiresInHrs == null) continue
    push(events, nowMs, horizonHrs, attentionHrs, {
      kind: 'extractor_expiry',
      inHours: extractor.expiresInHrs,
      pinId: extractor.pinId,
      typeId: extractor.productTypeId > 0 ? extractor.productTypeId : undefined,
      typeName: extractor.productTypeId > 0 ? extractor.productName : undefined,
    })
  }

  return events.sort((a, b) => a.inHours - b.inHours)
}

/** O evento mais urgente: um problema real se houver, senão o próximo qualquer. */
export function mostUrgentEvent(events: ColonyEvent[]): ColonyEvent | undefined {
  const problems = events.filter(isProblem)
  return (problems.length > 0 ? problems : events)[0]
}

/**
 * Chave de agrupamento anti-spam: um evento por tipo+pin, não um por commodity.
 * Sem isto, um planeta com 5 insumos secando manda 5 notificações e o usuário
 * aprende a ignorar todas — o mesmo mal dos "26 stalled".
 */
export function eventKey(event: ColonyEvent): string {
  return `${event.kind}:${event.pinId ?? 0}`
}
