/**
 * Buffers: estoque projetado, contagem regressiva e status por store.
 *
 * Porte de `buffer-sim.ts` (Fase A + Fase B1), com a limpeza que o v2 permite:
 * aqui a projeção e o vocabulário `degraded` estão SEMPRE ligados. No v1 os dois
 * viviam atrás de `projectionEnabled` porque o módulo rodava em produção; o v2
 * inteiro já está atrás da flag `PI_V2`, então os ramos duplicados sumiram.
 *
 * Duas regras que este arquivo carrega, e que existem por causa de bug real:
 *
 *  1. **Store de passagem não é store parado.** Um buffer com estoque 0 que
 *     continua sendo alimentado (in > 0) é uma cadeia balanceada em regime, não
 *     uma parada. Só é parada de verdade quando está vazio E sem nenhuma entrada.
 *  2. **Buffer só-import vazio dentro da cadência não é fome.** O insumo comprado
 *     tem `in=0` na ESI porque o jogador repõe à mão. Se a idade do snapshot ainda
 *     cabe na cadência de visita, ele está no ritmo — o que se mostra é
 *     "reabastecer em Xh", não um alarme vermelho.
 */

import type { PiColonyLayout } from '@/lib/pi-v2/esi'
import type { CommodityBalance } from '@/lib/pi-v2/demand'
import { incomingThroughput, outgoingThroughput, type ThroughputByPin } from '@/lib/pi-v2/routes'
import { buildStoreNodes, type StoreNode } from '@/lib/pi-v2/stores'
import { getCommodityName, getCommodityVolume, type StoreRole } from '@/lib/pi-v2/sde'
import { projectStock } from '@/lib/pi-v2/projection'

/**
 * Vocabulário de status. `stalled` significa **a saída morreu** — nada sai da
 * colônia. `degraded` é "algum caminho ainda produz, mas algum pin está seco":
 * atenção, não catástrofe. Colapsar tudo no pior pin foi o que transformou
 * gargalo pontual em 23 alarmes vermelhos e retreinou o usuário a ignorar.
 */
export type BufferStatusKind =
  | 'running'
  | 'starving_soon'
  | 'degraded'
  | 'stalled'
  | 'overflow_soon'
  | 'full'

/** Cadência de visita default quando o usuário não configurou nenhuma. */
export const DEFAULT_VISIT_CADENCE_HRS = 24

export function resolveCadenceHrs(visitCadenceHrs: number | undefined): number {
  return visitCadenceHrs != null && Number.isFinite(visitCadenceHrs) && visitCadenceHrs > 0
    ? visitCadenceHrs
    : DEFAULT_VISIT_CADENCE_HRS
}

export interface CommodityFlow {
  typeId: number
  name: string
  /** Estoque projetado até agora. Igual ao medido quando a projeção está suspensa. */
  amount: number
  /** Estoque cru do snapshot da ESI. Nunca sobrescrever — é a única medição real. */
  amountMeasured: number
  /** true quando `amount` foi avançado além do snapshot. A UI DEVE distinguir. */
  projected: boolean
  inPerHour: number
  outPerHour: number
  netPerHour: number
  /** Horas até zerar, contadas a partir de AGORA (não do snapshot). */
  timeToEmptyHrs?: number
}

export interface StoreBufferStatus {
  pinId: number
  typeId: number
  role: StoreRole
  label: string
  capacityM3: number
  /** m³ recalculados sobre o estoque PROJETADO — o volume também tinha que andar. */
  usedM3: number
  freeM3: number
  flows: CommodityFlow[]
  /**
   * Inventário PROJETADO completo do store — inclusive o que está parado sem
   * rota, que não aparece em `flows`. É o estoque "em mãos" que a lista de
   * compra desconta: comprar o consumo bruto ignorando o que já está no
   * launchpad superestima a compra.
   */
  projectedContents: Array<{ typeId: number; amount: number }>
  timeToFullHrs?: number
  timeToEmptyHrs?: number
  limitingEmptyTypeId?: number
  /**
   * Horizonte de reposição (cadência − idade do snapshot) de um buffer só-import
   * que está no ritmo. Presente NO LUGAR do falso "vazio". undefined quando não
   * se aplica.
   */
  restockDueHrs?: number
  status: BufferStatusKind
}

export interface ColonyBufferStatus {
  status: BufferStatusKind
  timeToStopHrs?: number
  timeToFullHrs?: number
  /** Menor horizonte de reposição entre os stores só-import no ritmo. */
  restockDueHrs?: number
  limitingTypeId?: number
  limitingPinId?: number
}

/**
 * Tempo honesto (horas) até um buffer zerar, ou undefined quando não há evento de
 * drenagem a reportar. É o portão anti-falso-stall:
 *
 *  - net não-negativo (in >= out) → nunca esvazia sozinho → undefined
 *  - drenando com estoque na mão   → contagem a partir do estoque atual
 *  - vazio E sem nenhuma entrada   → parado de verdade agora (0h)
 *  - vazio mas ainda alimentado    → a commodity passa PELO store em regime
 *    (um AIF alimentando um HTIF na mesma taxa mantém o intermediário em ~0).
 *    Não é parada e não é contagem honesta → undefined. Sub-oferta parcial
 *    sustentada é problema de desenho, que o modelo de demanda expõe via
 *    `importNeededPerHour` — não um cronômetro fabricado aqui.
 */
export function computeTimeToEmptyHrs(
  amount: number,
  inPerHour: number,
  outPerHour: number
): number | undefined {
  if (inPerHour - outPerHour >= 0) return undefined
  if (amount > 0) return amount / (outPerHour - inPerHour)
  if (inPerHour <= 0) return 0
  return undefined
}

export function deriveStatus(
  timeToEmptyHrs: number | undefined,
  timeToFullHrs: number | undefined,
  cadenceHrs: number = DEFAULT_VISIT_CADENCE_HRS
): BufferStatusKind {
  if (timeToEmptyHrs != null && timeToEmptyHrs <= 0) return 'stalled'
  if (timeToEmptyHrs != null && timeToEmptyHrs < cadenceHrs) return 'starving_soon'
  if (timeToFullHrs != null && timeToFullHrs <= 0) return 'full'
  if (timeToFullHrs != null && timeToFullHrs < cadenceHrs) return 'overflow_soon'
  return 'running'
}

/**
 * Distribui o déficit de import do planeta entre os stores que alimentam as
 * fábricas, proporcionalmente ao quanto cada um entrega. Sem isto, o insumo
 * comprado não apareceria como entrada em store nenhum.
 */
function distributeImportToStores(
  balances: CommodityBalance[],
  assumeImports: boolean,
  outgoing: ThroughputByPin
): ThroughputByPin {
  const importByPin: ThroughputByPin = new Map()
  if (!assumeImports) return importByPin

  for (const balance of balances) {
    if (balance.importNeededPerHour <= 0) continue

    const pinOutRates: Array<{ pinId: number; rate: number }> = []
    for (const [pinId, byType] of outgoing) {
      const rate = byType.get(balance.typeId) ?? 0
      if (rate > 0) pinOutRates.push({ pinId, rate })
    }
    if (pinOutRates.length === 0) continue

    const totalOut = pinOutRates.reduce((s, p) => s + p.rate, 0)
    for (const { pinId, rate } of pinOutRates) {
      const share = (rate / totalOut) * balance.importNeededPerHour
      const byType = importByPin.get(pinId) ?? new Map<number, number>()
      byType.set(balance.typeId, (byType.get(balance.typeId) ?? 0) + share)
      importByPin.set(pinId, byType)
    }
  }

  return importByPin
}

/**
 * Escala o throughput DESENHADO das rotas para o teto real por commodity,
 * distribuindo o teto entre os pins pela participação de cada um. Teto 0 zera o
 * fluxo. Muta o mapa no lugar.
 *
 * **ESCOPO (corrige um bug herdado do v1).** O rateio só pode considerar os pins
 * que estão em `scopePinIds` — os STORES. O mapa de entrada contém também as
 * rotas que chegam a FÁBRICAS, que são a fábrica PUXANDO o próprio insumo:
 * consumo, não entrega ao buffer. Contá-las no denominador dilui o teto e credita
 * a entrega pela metade.
 *
 * Medido na 6-IAFR IX (Hermetic Membranes, produção 54/h): sem o escopo, o
 * denominador virava 30 (store #7) + 24 (store #21) + 54 (as 9 HTIF puxando) =
 * 108, fator 54/108 = 0,5 → os stores recebiam 15 e 12 em vez de 30 e 24, e um
 * intermediário perfeitamente balanceado aparecia drenando a −15/h e −12/h.
 *
 * É a mesma restrição que `computeOverflowFractionByType` (demand.ts) já
 * documenta e aplica; este caminho a tinha esquecido.
 */
function scaleThroughputByCap(
  throughput: ThroughputByPin,
  capByType: Map<number, number>,
  scopePinIds: Set<number>
): void {
  const designedTotalByType = new Map<number, number>()
  for (const [pinId, byType] of throughput) {
    if (!scopePinIds.has(pinId)) continue
    for (const [typeId, rate] of byType) {
      designedTotalByType.set(typeId, (designedTotalByType.get(typeId) ?? 0) + rate)
    }
  }
  for (const [pinId, byType] of throughput) {
    if (!scopePinIds.has(pinId)) continue
    for (const [typeId, rate] of byType) {
      const designedTotal = designedTotalByType.get(typeId) ?? 0
      const cap = Math.max(0, capByType.get(typeId) ?? 0)
      byType.set(typeId, rate * (designedTotal > 0 ? Math.min(1, cap / designedTotal) : 0))
    }
  }
}

function hasActiveFlows(flows: CommodityFlow[]): boolean {
  return flows.some((f) => f.inPerHour > 0 || f.outPerHour > 0)
}

export interface SimulateStoreBuffersInput {
  layout: PiColonyLayout
  balances: CommodityBalance[]
  /** true na visão "desenho" (o insumo comprado chega), false na "agora". */
  assumeImports: boolean
  /**
   * Teto de ENTRADA por commodity = produção/extração corrente. O throughput da
   * rota é a taxa DESENHADA; sem este teto, uma colônia ociosa ainda reportaria
   * entrada e um "enche em Nh" fantasma. Omitir na visão de desenho.
   */
  inflowCapByType?: Map<number, number>
  /** Teto de SAÍDA = consumo corrente, para buffer não "drenar" sem ninguém puxando. */
  outflowCapByType?: Map<number, number>
  /** Horas entre as visitas de reabastecimento. Omitir usa o default de 24h. */
  visitCadenceHrs?: number
  /**
   * Horas que a projeção pode avançar. Vem de
   * `resolveConfidence().effectiveElapsedHrs` — já é 0 quando a projeção está
   * suspensa (>72h) ou não há âncora.
   */
  projectionHours: number
  /**
   * Idade CRUA do snapshot. Distinta de `projectionHours` de propósito: acima de
   * 72h a projeção se suspende (não avança estoque), mas a idade continua sendo o
   * que diz se o reabastecimento está atrasado. Confundir as duas faria uma
   * colônia parada há 5 dias aparecer como "no ritmo".
   */
  snapshotAgeHours: number
}

export function simulateStoreBuffers(input: SimulateStoreBuffersInput): StoreBufferStatus[] {
  const { layout, balances, assumeImports, projectionHours, snapshotAgeHours } = input
  const cadenceHrs = resolveCadenceHrs(input.visitCadenceHrs)

  const incoming = incomingThroughput(layout)
  const outgoing = outgoingThroughput(layout)

  // Os stores são o escopo do rateio: só o que ENTREGA a um buffer conta para
  // dividir o teto de produção. `outgoing` já nasce restrito a stores (só rotas
  // com origem em store), então o filtro é inócuo lá — passa por simetria.
  const stores = buildStoreNodes(layout)
  const storePinIds = new Set(stores.map((s) => s.pinId))
  if (input.inflowCapByType) scaleThroughputByCap(incoming, input.inflowCapByType, storePinIds)
  if (input.outflowCapByType) scaleThroughputByCap(outgoing, input.outflowCapByType, storePinIds)

  const importByPin = distributeImportToStores(balances, assumeImports, outgoing)
  const importedTypes = new Set(balances.filter((b) => b.isImported).map((b) => b.typeId))

  return stores.map((store) =>
    simulateOneStore({
      store,
      incoming: incoming.get(store.pinId) ?? new Map<number, number>(),
      outgoing: outgoing.get(store.pinId) ?? new Map<number, number>(),
      imports: importByPin.get(store.pinId) ?? new Map<number, number>(),
      importedTypes,
      cadenceHrs,
      projectionHours,
      snapshotAgeHours,
    })
  )
}

function simulateOneStore(input: {
  store: StoreNode
  incoming: Map<number, number>
  outgoing: Map<number, number>
  imports: Map<number, number>
  importedTypes: Set<number>
  cadenceHrs: number
  projectionHours: number
  snapshotAgeHours: number
}): StoreBufferStatus {
  const {
    store,
    incoming,
    outgoing,
    imports,
    importedTypes,
    cadenceHrs,
    projectionHours,
    snapshotAgeHours,
  } = input

  const flowTypeIds = new Set<number>([...incoming.keys(), ...outgoing.keys(), ...imports.keys()])
  const measuredByType = new Map(store.contents.map((c) => [c.typeId, c.amount]))

  const netForType = (typeId: number): number =>
    (incoming.get(typeId) ?? 0) + (imports.get(typeId) ?? 0) - (outgoing.get(typeId) ?? 0)

  // Avança TODO tipo presente — os que têm fluxo e os que só estão parados no
  // store (sem rota). Estoque parado não se move, mas precisa entrar no m³.
  const projectedByType = new Map<number, number>()
  for (const typeId of new Set<number>([...flowTypeIds, ...measuredByType.keys()])) {
    const measured = measuredByType.get(typeId) ?? 0
    projectedByType.set(typeId, projectStock(measured, netForType(typeId), projectionHours))
  }

  const flows: CommodityFlow[] = []
  /** Menor horizonte de reposição entre os buffers só-import no ritmo. */
  let restockDueHrs: number | undefined

  for (const typeId of flowTypeIds) {
    const inPerHour = (incoming.get(typeId) ?? 0) + (imports.get(typeId) ?? 0)
    const outPerHour = outgoing.get(typeId) ?? 0
    if (inPerHour <= 0 && outPerHour <= 0) continue

    const amountMeasured = measuredByType.get(typeId) ?? 0
    const amount = projectedByType.get(typeId) ?? amountMeasured
    let timeToEmptyHrs = computeTimeToEmptyHrs(amount, inPerHour, outPerHour)

    // Buffer só-import (nenhuma produção local a montante, reposto à mão): a
    // idade do snapshot governa o alerta, não a contagem crua.
    if (importedTypes.has(typeId) && inPerHour === 0 && outPerHour > 0) {
      const autonomyFromSnapshotHrs = amountMeasured / outPerHour
      if (snapshotAgeHours >= cadenceHrs) {
        // Atrasado: a reposição venceu → mantém a contagem real (alerta legítimo).
      } else if (autonomyFromSnapshotHrs < cadenceHrs) {
        // Sub-provisionado: nem cheio o buffer aguenta a cadência → mantém a
        // contagem real (vira starving_soon); o usuário precisa pôr mais insumo.
      } else {
        // No ritmo: a reposição chega antes de o buffer secar de verdade.
        timeToEmptyHrs = undefined
        const due = Math.max(0, cadenceHrs - snapshotAgeHours)
        if (restockDueHrs == null || due < restockDueHrs) restockDueHrs = due
      }
    }

    flows.push({
      typeId,
      name: getCommodityName(typeId),
      amount,
      amountMeasured,
      projected: amount !== amountMeasured,
      inPerHour,
      outPerHour,
      netPerHour: inPerHour - outPerHour,
      timeToEmptyHrs,
    })
  }

  flows.sort((a, b) => a.name.localeCompare(b.name))

  const active = hasActiveFlows(flows)
  // O volume ocupado também é projetado: era ele que mostrava launchpad a 75%
  // quando o jogo mostrava 4%.
  const usedM3 = store.contents.reduce(
    (sum, c) => sum + (projectedByType.get(c.typeId) ?? c.amount) * getCommodityVolume(c.typeId),
    0
  )
  const freeM3 = Math.max(0, store.capacityM3 - usedM3)

  let timeToFullHrs: number | undefined
  if (active && store.capacityM3 > 0) {
    if (freeM3 <= 0) {
      timeToFullHrs = 0
    } else {
      let netInflowM3 = 0
      for (const flow of flows) {
        if (flow.netPerHour > 0) netInflowM3 += flow.netPerHour * getCommodityVolume(flow.typeId)
      }
      if (netInflowM3 > 0) timeToFullHrs = freeM3 / netInflowM3
    }
  }

  let timeToEmptyHrs: number | undefined
  let limitingEmptyTypeId: number | undefined
  if (active) {
    for (const flow of flows) {
      if (flow.timeToEmptyHrs == null) continue
      if (timeToEmptyHrs == null || flow.timeToEmptyHrs < timeToEmptyHrs) {
        timeToEmptyHrs = flow.timeToEmptyHrs
        limitingEmptyTypeId = flow.typeId
      }
    }
  }

  return {
    pinId: store.pinId,
    typeId: store.typeId,
    role: store.role,
    label: store.label,
    capacityM3: store.capacityM3,
    usedM3,
    freeM3,
    flows,
    // Todo o conteúdo do store, já projetado — inclusive o parado sem rota, que
    // não gera fluxo mas é estoque real na mão do jogador.
    projectedContents: store.contents.map((c) => ({
      typeId: c.typeId,
      amount: projectedByType.get(c.typeId) ?? c.amount,
    })),
    timeToFullHrs,
    timeToEmptyHrs,
    limitingEmptyTypeId,
    restockDueHrs,
    status: active ? deriveStatus(timeToEmptyHrs, timeToFullHrs, cadenceHrs) : 'running',
  }
}

/**
 * Status da colônia a partir dos stores. **Status de colônia não é o pior pin —
 * é o estado da saída.** Quando algum store secou mas a colônia AINDA entrega
 * produção ao destino final, o resultado é `degraded`, não `stalled`.
 */
export function aggregateColonyStatus(
  stores: StoreBufferStatus[],
  visitCadenceHrs: number | undefined,
  options: { exportProductionActive: boolean }
): ColonyBufferStatus {
  let timeToStopHrs: number | undefined
  let limitingTypeId: number | undefined
  let timeToFullHrs: number | undefined
  let limitingPinId: number | undefined
  let restockDueHrs: number | undefined

  for (const store of stores) {
    if (store.restockDueHrs != null) {
      if (restockDueHrs == null || store.restockDueHrs < restockDueHrs) {
        restockDueHrs = store.restockDueHrs
      }
    }
    if (!hasActiveFlows(store.flows)) continue

    if (store.timeToEmptyHrs != null) {
      if (timeToStopHrs == null || store.timeToEmptyHrs < timeToStopHrs) {
        timeToStopHrs = store.timeToEmptyHrs
        limitingTypeId = store.limitingEmptyTypeId
        limitingPinId = store.pinId
      }
    }
    if (store.timeToFullHrs != null) {
      if (timeToFullHrs == null || store.timeToFullHrs < timeToFullHrs) {
        timeToFullHrs = store.timeToFullHrs
        if (timeToStopHrs == null || store.timeToFullHrs < timeToStopHrs) {
          limitingPinId = store.pinId
        }
      }
    }
  }

  const raw = deriveStatus(timeToStopHrs, timeToFullHrs, resolveCadenceHrs(visitCadenceHrs))
  const status: BufferStatusKind =
    raw === 'stalled' && options.exportProductionActive ? 'degraded' : raw

  return { status, timeToStopHrs, timeToFullHrs, restockDueHrs, limitingTypeId, limitingPinId }
}

/** A colônia ainda entrega alguma coisa à saída? É o que separa degradado de parado. */
export function isExportProductionActive(balances: CommodityBalance[]): boolean {
  return balances.some((b) => b.exportedPerHour > 0)
}
