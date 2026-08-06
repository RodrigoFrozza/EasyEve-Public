import { getCommodityName, getCommodityVolume, getPinRole } from '@/lib/pi/pi-static-data'
import {
  computeIncomingRouteThroughput,
  computeOutgoingRouteThroughput,
  type PiCommodityBalance,
} from '@/lib/pi/demand-model'
import { buildPinNodes, isExportStoreRole } from '@/lib/pi/pin-fill'
import {
  bandAllowsProjection,
  elapsedHoursSince,
  projectStock,
  stalenessBand,
} from '@/lib/pi/project-forward'
import type { RouteEdge } from '@/lib/pi/route-graph'
import type { PiColonyLayout, PiPinBufferStatus, PiPinCommodityFlow, PiRoutingView } from '@/lib/pi/types'

export type PiBufferStatusKind =
  | 'running'
  | 'starving_soon'
  | 'degraded'
  | 'stalled'
  | 'overflow_soon'
  | 'full'

export interface PiBufferStatus {
  status: PiBufferStatusKind
  timeToStopHrs?: number
  timeToFullHrs?: number
  limitingTypeId?: number
  limitingPinId?: number
}

// Re-exported for backward compatibility — buildPinNodes/PiPinNode now live in
// pin-fill.ts (moved there to break a circular import: demand-model.ts also
// needs buildPinNodes, and this file already imports from demand-model.ts).
export { buildPinNodes } from '@/lib/pi/pin-fill'
export type { PiPinNode } from '@/lib/pi/pin-fill'

/**
 * Default visit cadence when the user hasn't configured one. The
 * `starving_soon`/`overflow_soon` thresholds are relative to how often the user
 * restocks a planet: a buffer that won't last until the next visit is the alert,
 * not one that merely dips under a fixed 24h.
 */
export const DEFAULT_VISIT_CADENCE_HRS = 24

/** Coerce a user-supplied cadence into a positive finite number, else default. */
function resolveCadenceHrs(visitCadenceHrs: number | undefined): number {
  return visitCadenceHrs != null && Number.isFinite(visitCadenceHrs) && visitCadenceHrs > 0
    ? visitCadenceHrs
    : DEFAULT_VISIT_CADENCE_HRS
}

/**
 * Honest time (hours) for a store's buffer of one commodity to reach zero, or
 * undefined when there is no drain event to report. This is the anti-false-stall
 * gate: an empty store that is still being fed is NOT stalled.
 *
 *  - Net non-negative (in >= out) -> never empties on its own -> undefined.
 *  - Draining with stock on hand (amount > 0) -> countdown from current amount.
 *  - Empty AND no inflow at all (in <= 0) -> genuinely stalled right now (0h).
 *  - Empty but still fed (in > 0, in < out) -> the commodity flows THROUGH the
 *    store in steady state (a balanced chain, e.g. an AIF feeding an HTIF at the
 *    same rate, holds its intermediate storage at ~0). Not a stall and not an
 *    honest countdown -> undefined. A sustained partial under-supply is a
 *    throughput/design issue the demand model surfaces via importNeeded, not a
 *    buffer-drain timer to fabricate here.
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

export function derivePinStatus(
  timeToEmptyHrs: number | undefined,
  timeToFullHrs: number | undefined,
  cadenceHrs: number = DEFAULT_VISIT_CADENCE_HRS
): PiBufferStatusKind {
  let status: PiBufferStatusKind = 'running'
  if (timeToEmptyHrs != null && timeToEmptyHrs <= 0) status = 'stalled'
  else if (timeToEmptyHrs != null && timeToEmptyHrs < cadenceHrs) status = 'starving_soon'
  else if (timeToFullHrs != null && timeToFullHrs <= 0) status = 'full'
  else if (timeToFullHrs != null && timeToFullHrs < cadenceHrs) status = 'overflow_soon'
  return status
}

function distributeImportToPins(
  balances: PiCommodityBalance[],
  assumeImports: boolean,
  outgoing: Map<number, Map<number, number>>
): Map<number, Map<number, number>> {
  const importByPin = new Map<number, Map<number, number>>()
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

function resolvePinLabel(pinId: number, routing?: PiRoutingView): string {
  const pin = routing?.pins.find((p) => p.pinId === pinId)
  if (pin?.label) return pin.label
  if (pin?.structureName) return `${pin.structureName} #${pinId}`
  return `Pin ${pinId}`
}

function pinHasActiveFlows(flows: PiPinCommodityFlow[]): boolean {
  return flows.some((f) => f.inPerHour > 0 || f.outPerHour > 0)
}

/**
 * Scale designed per-pin route throughput down to an actual per-commodity cap,
 * distributing the cap across pins by their share. A cap of 0 zeroes the flow.
 * Mutates the throughput map in place.
 */
function scaleThroughputByCap(
  throughput: Map<number, Map<number, number>>,
  capByType: Map<number, number>
): void {
  const designedTotalByType = new Map<number, number>()
  for (const byType of throughput.values()) {
    for (const [typeId, rate] of byType) {
      designedTotalByType.set(typeId, (designedTotalByType.get(typeId) ?? 0) + rate)
    }
  }
  for (const byType of throughput.values()) {
    for (const [typeId, rate] of byType) {
      const designedTotal = designedTotalByType.get(typeId) ?? 0
      const cap = Math.max(0, capByType.get(typeId) ?? 0)
      const factor = designedTotal > 0 ? Math.min(1, cap / designedTotal) : 0
      byType.set(typeId, rate * factor)
    }
  }
}

export function simulatePinBufferStatuses(input: {
  layout: PiColonyLayout
  balances: PiCommodityBalance[]
  assumeImports: boolean
  routing?: PiRoutingView
  /**
   * Per-commodity cap on store INflow = the CURRENT actual output rate. Route
   * throughput is the DESIGNED rate, so without this an idle colony (expired
   * extractors / stalled factories) still reports inflow and a bogus "full in".
   * Pass current-mode rates to gate it; omit for the potential view.
   */
  inflowCapByType?: Map<number, number>
  /**
   * Per-commodity cap on store OUTflow = the current actual consumption, so a
   * colony that isn't really producing doesn't show its input buffer draining
   * ("empty in Nh") when nothing is actually pulling from it.
   */
  outflowCapByType?: Map<number, number>
  /**
   * Hours between the user's restock visits to this planet. The starving/overflow
   * thresholds are measured against it. Omit for the 24h default.
   */
  visitCadenceHrs?: number
  /**
   * Motor de projeção (Fase A). Quando ON, avança o `amount` cru do snapshot até
   * `nowMs` integrando a taxa líquida corrente do pin, saturando em [0, cap].
   * OFF (padrão) = comportamento idêntico, byte a byte: amount = snapshot.
   */
  projectionEnabled?: boolean
  /** Instante "agora" para a projeção. Omitido → Date.now() (só usado se ON). */
  nowMs?: number
  /** ISO do último snapshot da ESI (summary.last_update) — origem do elapsed. */
  lastUpdate?: string
}): PiPinBufferStatus[] {
  const { layout, balances, assumeImports, routing, inflowCapByType, outflowCapByType } = input
  const cadenceHrs = resolveCadenceHrs(input.visitCadenceHrs)

  // Elapsed desde o snapshot governa a projeção. Só computa quando a flag está
  // ON — assim, com a flag OFF, elapsed=0 e todo `projectStock` devolve o
  // snapshot cru (garantia byte-a-byte). Banda `suspended` (>72h) suspende a
  // projeção: extrapolar 3+ dias linearmente mente mais que mostrar dado velho.
  const elapsedHours = input.projectionEnabled
    ? elapsedHoursSince(input.lastUpdate, input.nowMs ?? Date.now())
    : 0
  const effectiveElapsedHrs =
    input.projectionEnabled && bandAllowsProjection(stalenessBand(elapsedHours))
      ? elapsedHours
      : 0
  const incoming = computeIncomingRouteThroughput(layout)
  const outgoing = computeOutgoingRouteThroughput(layout)

  if (inflowCapByType) scaleThroughputByCap(incoming, inflowCapByType)
  if (outflowCapByType) scaleThroughputByCap(outgoing, outflowCapByType)
  const importByPin = distributeImportToPins(balances, assumeImports, outgoing)
  const pinNodes = buildPinNodes(layout)

  // Fase B1: tipos que a colônia importa (repostos à mão). Um buffer só-import
  // vazio não é fome iminente se a idade do snapshot ainda cabe na cadência — o
  // Rodrigo repõe a cada `cadenceHrs`. Só refinamos quando a flag está ON.
  const importedTypes = new Set(balances.filter((b) => b.isImported).map((b) => b.typeId))

  return pinNodes.map((pin) => {
    const pinIncoming = incoming.get(pin.pinId) ?? new Map<number, number>()
    const pinOutgoing = outgoing.get(pin.pinId) ?? new Map<number, number>()
    const pinImport = importByPin.get(pin.pinId) ?? new Map<number, number>()

    const typeIds = new Set<number>([
      ...pinIncoming.keys(),
      ...pinOutgoing.keys(),
      ...pinImport.keys(),
    ])

    const amountByType = new Map(pin.contents.map((c) => [c.typeId, c.amount]))

    const netForType = (typeId: number): number =>
      (pinIncoming.get(typeId) ?? 0) +
      (pinImport.get(typeId) ?? 0) -
      (pinOutgoing.get(typeId) ?? 0)

    // Avança cada tipo (fluxos + estoque parado sem rota) do snapshot até agora,
    // com a taxa líquida corrente do próprio pin (já capada pelo production-graph).
    // Com a flag OFF, effectiveElapsedHrs=0 → projectStock devolve o medido, então
    // projectedByType == amountByType e tudo abaixo é idêntico byte a byte.
    const projectedByType = new Map<number, number>()
    for (const typeId of new Set<number>([...typeIds, ...amountByType.keys()])) {
      const measured = amountByType.get(typeId) ?? 0
      projectedByType.set(
        typeId,
        projectStock(measured, netForType(typeId), effectiveElapsedHrs)
      )
    }

    const flows: PiPinCommodityFlow[] = []
    // Menor horizonte de reposição (cadência − idade) entre os buffers só-import
    // que estão no ritmo. Vira o "reabastecer em Xh" no lugar do falso "vazio".
    let pinRestockDueHrs: number | undefined

    for (const typeId of typeIds) {
      const inPerHour =
        (pinIncoming.get(typeId) ?? 0) + (pinImport.get(typeId) ?? 0)
      const outPerHour = pinOutgoing.get(typeId) ?? 0
      const netPerHour = inPerHour - outPerHour
      const amountMeasured = amountByType.get(typeId) ?? 0
      const amount = projectedByType.get(typeId) ?? amountMeasured

      // Countdown relativo a AGORA: alimenta o "Empty in Xh" com o estoque
      // projetado, não com o do snapshot.
      let timeToEmptyHrs = computeTimeToEmptyHrs(amount, inPerHour, outPerHour)

      // Fase B1 — buffer só-import (sem produção local a montante, reposto à mão):
      // a idade do snapshot governa o alerta, não o timeToEmpty cru. Só com a flag
      // ON. `elapsedHours` já é a idade real do snapshot (0 quando a flag está OFF).
      if (
        input.projectionEnabled &&
        importedTypes.has(typeId) &&
        inPerHour === 0 &&
        outPerHour > 0
      ) {
        const restockDueInHrs = cadenceHrs - elapsedHours
        const autonomyFromSnapshot = amountMeasured / outPerHour
        if (elapsedHours >= cadenceHrs) {
          // Atrasado: a reposição venceu — mantém o countdown real (alerta legítimo).
        } else if (autonomyFromSnapshot < cadenceHrs) {
          // Sub-provisionado: nem cheio o buffer aguenta a cadência — mantém o
          // countdown real (vira starving_soon âmbar); o usuário precisa pôr mais.
        } else {
          // No ritmo: a reposição chega antes de o buffer importar de fato. Suprime
          // o falso "vazio" e expõe o horizonte de reposição.
          timeToEmptyHrs = undefined
          const due = Math.max(0, restockDueInHrs)
          if (pinRestockDueHrs == null || due < pinRestockDueHrs) pinRestockDueHrs = due
        }
      }

      if (inPerHour > 0 || outPerHour > 0) {
        flows.push({
          typeId,
          name: getCommodityName(typeId),
          amount,
          amountMeasured,
          projected: amount !== amountMeasured,
          inPerHour,
          outPerHour,
          netPerHour,
          timeToEmptyHrs,
        })
      }
    }

    flows.sort((a, b) => a.name.localeCompare(b.name))

    const hasActiveFlows = pinHasActiveFlows(flows)
    // Volume usado reflete os amounts projetados (critério de aceite: launchpad
    // deve mostrar ~4%, não 75%). Flag OFF → usa o usedM3 medido, intacto.
    const usedM3 = input.projectionEnabled
      ? pin.contents.reduce(
          (sum, c) =>
            sum + (projectedByType.get(c.typeId) ?? c.amount) * getCommodityVolume(c.typeId),
          0
        )
      : pin.usedM3
    const freeM3 = Math.max(0, pin.capacityM3 - usedM3)
    let timeToFullHrs: number | undefined
    if (hasActiveFlows && pin.capacityM3 > 0) {
      if (freeM3 <= 0) {
        timeToFullHrs = 0
      } else {
        let netInflowM3 = 0
        for (const flow of flows) {
          if (flow.netPerHour > 0) {
            netInflowM3 += flow.netPerHour * getCommodityVolume(flow.typeId)
          }
        }
        if (netInflowM3 > 0) {
          timeToFullHrs = freeM3 / netInflowM3
        }
      }
    }

    let timeToEmptyHrs: number | undefined
    let limitingEmptyTypeId: number | undefined
    if (hasActiveFlows) {
      for (const flow of flows) {
        if (flow.timeToEmptyHrs == null) continue
        if (timeToEmptyHrs == null || flow.timeToEmptyHrs < timeToEmptyHrs) {
          timeToEmptyHrs = flow.timeToEmptyHrs
          limitingEmptyTypeId = flow.typeId
        }
      }
    }

    const role = isExportStoreRole(pin.role) ? pin.role : 'storage'

    return {
      pinId: pin.pinId,
      typeId: pin.typeId,
      role,
      label: resolvePinLabel(pin.pinId, routing),
      capacityM3: pin.capacityM3,
      usedM3,
      freeM3,
      flows,
      timeToFullHrs,
      timeToEmptyHrs,
      limitingEmptyTypeId,
      restockDueHrs: pinRestockDueHrs,
      status: hasActiveFlows ? derivePinStatus(timeToEmptyHrs, timeToFullHrs, cadenceHrs) : 'running',
    }
  })
}

export function aggregateBufferStatusFromPins(
  pinStatuses: PiPinBufferStatus[],
  visitCadenceHrs?: number,
  options?: { degradedEnabled?: boolean; exportProductionActive?: boolean }
): PiBufferStatus {
  let timeToStopHrs: number | undefined
  let limitingTypeId: number | undefined
  let timeToFullHrs: number | undefined
  let limitingPinId: number | undefined

  for (const pin of pinStatuses) {
    if (!pinHasActiveFlows(pin.flows)) continue
    if (pin.timeToEmptyHrs != null) {
      if (timeToStopHrs == null || pin.timeToEmptyHrs < timeToStopHrs) {
        timeToStopHrs = pin.timeToEmptyHrs
        limitingTypeId = pin.limitingEmptyTypeId
        limitingPinId = pin.pinId
      }
    }
    if (pin.timeToFullHrs != null) {
      if (timeToFullHrs == null || pin.timeToFullHrs < timeToFullHrs) {
        timeToFullHrs = pin.timeToFullHrs
        if (timeToStopHrs == null || pin.timeToFullHrs < timeToStopHrs) {
          limitingPinId = pin.pinId
        }
      }
    }
  }

  return {
    status: applyDegraded(
      derivePinStatus(timeToStopHrs, timeToFullHrs, resolveCadenceHrs(visitCadenceHrs)),
      options
    ),
    timeToStopHrs,
    timeToFullHrs,
    limitingTypeId,
    limitingPinId,
  }
}

/**
 * Fase B1 — "stalled" só deve significar *a colônia parou de exportar*. Quando um
 * pin secou mas a colônia AINDA entrega produção à saída (exportProductionActive),
 * é DEGRADADO (produz abaixo do desenhado), não catástrofe. Só reclassifica com a
 * flag ON; com ela OFF, o vocabulário volta ao de antes (nunca 'degraded').
 */
function applyDegraded(
  status: PiBufferStatusKind,
  options?: { degradedEnabled?: boolean; exportProductionActive?: boolean }
): PiBufferStatusKind {
  if (options?.degradedEnabled && status === 'stalled' && options.exportProductionActive) {
    return 'degraded'
  }
  return status
}

function aggregateBufferUnits(layout: PiColonyLayout, typeId: number): number {
  let total = 0
  for (const pin of layout.pins) {
    const role = getPinRole(pin.type_id)
    if (!isExportStoreRole(role)) continue
    for (const content of pin.contents ?? []) {
      if (content.type_id === typeId) total += content.amount
    }
  }
  return total
}

export function simulateBufferStatus(input: {
  layout: PiColonyLayout
  balances: PiCommodityBalance[]
  edges: RouteEdge[]
  routing?: PiRoutingView
  assumeImports?: boolean
  inflowCapByType?: Map<number, number>
  outflowCapByType?: Map<number, number>
  visitCadenceHrs?: number
  projectionEnabled?: boolean
  nowMs?: number
  lastUpdate?: string
}): PiBufferStatus {
  const {
    layout,
    balances,
    edges,
    routing,
    assumeImports = true,
    inflowCapByType,
    outflowCapByType,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate,
  } = input

  const pinStatuses = simulatePinBufferStatuses({
    layout,
    balances,
    assumeImports,
    routing,
    inflowCapByType,
    outflowCapByType,
    visitCadenceHrs,
    projectionEnabled,
    nowMs,
    lastUpdate,
  })

  // Fase B1: a colônia ainda exporta se algum fluxo tem produção corrente saindo.
  // Com isso, um pin seco vira 'degraded' (não 'stalled') no agregado.
  const exportProductionActive = balances.some((b) => b.exportedPerHour > 0)
  const degradeOptions = { degradedEnabled: projectionEnabled, exportProductionActive }

  if (pinStatuses.length > 0) {
    return aggregateBufferStatusFromPins(pinStatuses, visitCadenceHrs, degradeOptions)
  }

  let timeToStopHrs: number | undefined
  let limitingTypeId: number | undefined

  for (const balance of balances) {
    if (balance.importNeededPerHour <= 0) continue
    const bufferUnits = aggregateBufferUnits(layout, balance.typeId)
    const deficitRate = balance.importNeededPerHour
    const hrs = bufferUnits / deficitRate
    if (timeToStopHrs == null || hrs < timeToStopHrs) {
      timeToStopHrs = hrs
      limitingTypeId = balance.typeId
    }
  }

  let timeToFullHrs: number | undefined
  let limitingPinId: number | undefined
  const pinNodes = buildPinNodes(layout)

  for (const pin of pinNodes) {
    if (pin.capacityM3 <= 0) continue
    const freeM3 = Math.max(0, pin.capacityM3 - pin.usedM3)
    if (freeM3 <= 0) {
      timeToFullHrs = 0
      limitingPinId = pin.pinId
      continue
    }

    for (const balance of balances) {
      const storeInflowRate =
        balance.exportedPerHour > 0
          ? balance.exportedPerHour + balance.wastedPerHour
          : balance.surplusPerHour + balance.wastedPerHour
      if (storeInflowRate <= 0) continue

      const hasRouteToStore = edges.some(
        (e) =>
          e.typeId === balance.typeId &&
          e.destPinId === pin.pinId &&
          (e.kind === 'toExportStore' || e.kind === 'extractorToStore')
      )
      if (!hasRouteToStore) continue

      const inflowM3 = storeInflowRate * getCommodityVolume(balance.typeId)
      if (inflowM3 <= 0) continue
      const hrs = freeM3 / inflowM3
      if (timeToFullHrs == null || hrs < timeToFullHrs) {
        timeToFullHrs = hrs
        limitingPinId = pin.pinId
      }
    }
  }

  return {
    status: applyDegraded(
      derivePinStatus(timeToStopHrs, timeToFullHrs, resolveCadenceHrs(visitCadenceHrs)),
      degradeOptions
    ),
    timeToStopHrs,
    timeToFullHrs,
    limitingTypeId,
    limitingPinId,
  }
}
