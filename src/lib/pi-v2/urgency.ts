/**
 * Urgência e ação — a ordenação da tela e o contador honesto.
 *
 * Duas regras de produto vivem aqui:
 *
 *  1. **A lista ordena por urgência de ação, não por ISK.** O jogador abre o PI
 *     para saber o que fazer agora; qual planeta rende mais é a pergunta 3, que
 *     ele faz uma vez por mês. Ordenar por ISK/h enterra o planeta parado (que
 *     por estar parado rende pouco) no fim da lista — exatamente onde ele não
 *     pode estar.
 *  2. **O contador separa parado de degradado de "reabastecer em breve".**
 *     Colapsar os três em "26 parados" foi o que retreinou o usuário a ignorar o
 *     número. Cada balde só conta o que ele realmente significa.
 */

import type { ColonyProjection } from '@/lib/pi-v2/project-colony'
import { isProblem, mostUrgentEvent, type ColonyEvent } from '@/lib/pi-v2/events'

/**
 * Baldes do contador, do mais grave ao normal.
 *
 *  - `stalled`      — a saída morreu. Nada sai da colônia.
 *  - `losing`       — está perdendo produção AGORA (store lotado).
 *  - `degraded`     — produz abaixo do desenhado; algum caminho ainda entrega.
 *  - `attention`    — vai quebrar antes da próxima visita, ou extrator vencido,
 *                     ou o dado passou de 72h e não dá para afirmar nada.
 *  - `restock_soon` — no ritmo. A reposição declarada vence em breve.
 *  - `running`      — nada a fazer.
 */
export type ColonyBucket =
  | 'stalled'
  | 'losing'
  | 'degraded'
  | 'attention'
  | 'restock_soon'
  | 'running'

/** Menor = mais urgente. Define a ordem da lista do portfólio. */
export const BUCKET_RANK: Record<ColonyBucket, number> = {
  stalled: 0,
  losing: 1,
  degraded: 2,
  attention: 3,
  restock_soon: 4,
  running: 5,
}

/** O que o jogador precisa FAZER. A tela mostra isto, não o diagnóstico cru. */
export type ColonyActionKind =
  /** Abrir a colônia no jogo — só isso destrava o dado (ESI é read-only). */
  | 'open_in_game'
  /** Refazer o survey do extrator. */
  | 'restart_extractor'
  /** Levar insumo até o planeta. */
  | 'restock'
  /** Recolher o produto antes que o store lote e a produção se perca. */
  | 'collect'
  /**
   * A colônia consome mais de um intermediário do que fabrica. Não se resolve
   * comprando — é rebalancear a cadeia (mais fábricas a montante, ou rotas).
   */
  | 'rebalance_production'
  /** Nada a fazer agora. */
  | 'none'

export interface ColonyAction {
  kind: ColonyActionKind
  /** Horas até o prazo. <= 0 = já venceu. undefined = sem prazo definido. */
  dueInHours?: number
  /** O insumo/produto em questão, quando a ação é sobre um item específico. */
  typeId?: number
  typeName?: string
  /** O pin em questão, quando a ação é sobre um storage/launchpad específico. */
  pinId?: number
  pinLabel?: string
}

export interface ColonyUrgency {
  bucket: ColonyBucket
  rank: number
  action: ColonyAction
  /** O evento que justifica o balde e a ação. undefined quando está tudo bem. */
  driver?: ColonyEvent
}

/**
 * Classifica uma colônia. Combina o status agregado (que já sabe distinguir
 * saída morta de caminho degradado) com os eventos (que trazem a hora e o pin).
 */
export function classifyColony(
  projection: ColonyProjection,
  events: ColonyEvent[]
): ColonyUrgency {
  const driver = mostUrgentEvent(events)
  const status = projection.status.status

  // Dado suspenso vence tudo: com o snapshot passado de 72h não dá para afirmar
  // que a colônia está parada nem que está rodando. A única ação honesta é
  // pedir que o jogador abra a colônia no jogo para destravar a leitura.
  if (!projection.confidence.projectionApplied && projection.confidence.ageHours > 72) {
    return {
      bucket: 'attention',
      rank: BUCKET_RANK.attention,
      action: { kind: 'open_in_game' },
      driver,
    }
  }

  const bucket = resolveBucket(status, events)
  return {
    bucket,
    rank: BUCKET_RANK[bucket],
    action: resolveAction(bucket, projection, events),
    driver,
  }
}

function resolveBucket(
  status: ColonyProjection['status']['status'],
  events: ColonyEvent[]
): ColonyBucket {
  if (status === 'stalled') return 'stalled'
  if (status === 'full') return 'losing'
  if (status === 'degraded') return 'degraded'

  // Intermediário local em déficit é degradação da cadeia, não "atenção" genérica.
  if (events.some((e) => e.kind === 'degraded' && isProblem(e))) return 'degraded'

  // Só evento com severidade real conta como atenção — ou seja, só o que quebra
  // dentro do último terço da cadência. O que quebra além disso é ritmo normal
  // (severity 'info') e não pode empurrar uma colônia saudável para o balde de
  // problema: era isso que fazia 32 de 35 colônias aparecerem em âmbar.
  if (events.some(isProblem)) return 'attention'

  // Sobrou só informação. Insumo comprado a caminho de acabar (mesmo fora do
  // limiar) ainda é uma compra a fazer — vira "reabastecer em breve", não
  // "rodando", senão o card diz "nada a fazer" com o buffer descendo.
  if (events.some((e) => e.kind === 'restock_due' || e.kind === 'supply_out')) {
    return 'restock_soon'
  }
  return 'running'
}

function resolveAction(
  bucket: ColonyBucket,
  projection: ColonyProjection,
  events: ColonyEvent[]
): ColonyAction {
  // A ação sai de um PROBLEMA; o ciclo normal ('info') não gera tarefa. A única
  // exceção é `restock_due`, que É o ciclo normal e vira a ação do balde dele.
  const find = (kind: ColonyEvent['kind']) =>
    events.find((e) => e.kind === kind && (isProblem(e) || kind === 'restock_due'))

  // Extrator vencido/vencendo é sempre a ação mais específica que existe: sem o
  // resurvey a cadeia inteira morre, e nenhuma outra ação adianta.
  const extractor = find('extractor_expiry')
  if (extractor && (bucket === 'attention' || bucket === 'stalled')) {
    return {
      kind: 'restart_extractor',
      dueInHours: extractor.inHours,
      typeId: extractor.typeId,
      typeName: extractor.typeName,
      pinId: extractor.pinId,
    }
  }

  if (bucket === 'losing') {
    const space = find('space_out')
    return {
      kind: 'collect',
      dueInHours: space?.inHours ?? 0,
      pinId: space?.pinId,
      pinLabel: space?.pinLabel,
    }
  }

  const supply = find('supply_out')
  if (supply && (bucket === 'stalled' || bucket === 'degraded' || bucket === 'attention')) {
    return {
      kind: 'restock',
      dueInHours: supply.inHours,
      typeId: supply.typeId,
      typeName: supply.typeName,
      pinId: supply.pinId,
      pinLabel: supply.pinLabel,
    }
  }

  const space = find('space_out')
  if (space && bucket === 'attention') {
    return {
      kind: 'collect',
      dueInHours: space.inHours,
      pinId: space.pinId,
      pinLabel: space.pinLabel,
    }
  }

  // Déficit de intermediário local. Vem DEPOIS de repor/recolher de propósito:
  // quase sempre a produção caiu porque um insumo COMPRADO acabou, e nesse caso
  // a ação útil é a compra, não redesenhar o planeta.
  const local = find('degraded')
  if (local) {
    return {
      kind: 'rebalance_production',
      dueInHours: local.inHours,
      typeId: local.typeId,
      typeName: local.typeName,
      pinId: local.pinId,
      pinLabel: local.pinLabel,
    }
  }

  if (bucket === 'restock_soon') {
    // Prefere o insumo comprado que está de fato descendo: ele traz o item e o
    // prazo ("Repor Water · em 20h"). O `restock_due` genérico é o fallback,
    // porque só sabe dizer quando a visita vence, não o quê levar.
    const draining = events.find((e) => e.kind === 'supply_out')
    if (draining) {
      return {
        kind: 'restock',
        dueInHours: draining.inHours,
        typeId: draining.typeId,
        typeName: draining.typeName,
        pinId: draining.pinId,
        pinLabel: draining.pinLabel,
      }
    }
    const restock = find('restock_due')
    return {
      kind: 'restock',
      dueInHours: restock?.inHours ?? projection.status.restockDueHrs,
      pinId: restock?.pinId,
      pinLabel: restock?.pinLabel,
    }
  }

  // Parada sem evento que a explique (ex.: colônia sem nenhum fluxo ativo). Não
  // inventamos uma ação — mandar abrir no jogo é o que de fato resolve.
  if (bucket === 'stalled') return { kind: 'open_in_game' }

  return { kind: 'none' }
}

/** O contador honesto do topo do portfólio. */
export interface PortfolioCounters {
  total: number
  stalled: number
  losing: number
  degraded: number
  attention: number
  restockSoon: number
  running: number
}

export function countBuckets(buckets: ColonyBucket[]): PortfolioCounters {
  const counters: PortfolioCounters = {
    total: buckets.length,
    stalled: 0,
    losing: 0,
    degraded: 0,
    attention: 0,
    restockSoon: 0,
    running: 0,
  }
  for (const bucket of buckets) {
    switch (bucket) {
      case 'stalled':
        counters.stalled += 1
        break
      case 'losing':
        counters.losing += 1
        break
      case 'degraded':
        counters.degraded += 1
        break
      case 'attention':
        counters.attention += 1
        break
      case 'restock_soon':
        counters.restockSoon += 1
        break
      case 'running':
        counters.running += 1
        break
    }
  }
  return counters
}

/**
 * Ordena por urgência: balde primeiro, depois quem vence antes. O desempate
 * final é estável (planetId) para a lista não dançar entre polls de 60s.
 */
export function compareUrgency(
  a: { urgency: ColonyUrgency; planetId: number },
  b: { urgency: ColonyUrgency; planetId: number }
): number {
  if (a.urgency.rank !== b.urgency.rank) return a.urgency.rank - b.urgency.rank
  const aDue = a.urgency.action.dueInHours ?? Number.POSITIVE_INFINITY
  const bDue = b.urgency.action.dueInHours ?? Number.POSITIVE_INFINITY
  if (aDue !== bDue) return aDue - bDue
  return a.planetId - b.planetId
}
