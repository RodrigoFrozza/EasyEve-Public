/**
 * O grafo de rotas — a "inteligência da rota".
 *
 * `routes[]` da ESI (`source → destination`, `content_type_id`, `quantity`) É o
 * desenho inteiro da colônia. Tudo que a rota diz, o motor DERIVA: throughput,
 * quem importa, quem exporta, o que é terminal. Antes de criar qualquer campo de
 * configuração, a pergunta é "isto está nas rotas/schematics da ESI?" — se sim,
 * derivar, não perguntar ao jogador.
 *
 * Porte de `route-graph.ts` + das funções de throughput que no v1 moravam dentro
 * do `demand-model.ts` (elas são derivação pura de rota; ficar aqui quebra a
 * dependência circular que o v1 tinha entre buffer-sim e demand-model).
 */

import type { PiColonyLayout, PiPin } from '@/lib/pi-v2/esi'
import {
  getSchematicById,
  isProcessorRole,
  isStoreRole,
  pinRole,
  resolveSchematicId,
} from '@/lib/pi-v2/sde'

export type RouteEdgeKind =
  | 'extractorToFactory'
  | 'factoryToFactory'
  | 'toExportStore'
  | 'fromStoreToFactory'
  | 'extractorToStore'
  | 'other'

export interface RouteEdge {
  routeId: number
  sourcePinId: number
  destPinId: number
  typeId: number
  quantity: number
  kind: RouteEdgeKind
}

/** Mapa pinId → (typeId → unidades/hora). */
export type ThroughputByPin = Map<number, Map<number, number>>

function classifyEdge(source: PiPin, dest: PiPin): RouteEdgeKind {
  const srcRole = pinRole(source.type_id)
  const destRole = pinRole(dest.type_id)

  if (srcRole === 'extractor' && isProcessorRole(destRole)) return 'extractorToFactory'
  if (isProcessorRole(srcRole) && isProcessorRole(destRole)) return 'factoryToFactory'
  if (isProcessorRole(srcRole) && isStoreRole(destRole)) return 'toExportStore'
  if (isStoreRole(srcRole) && isProcessorRole(destRole)) return 'fromStoreToFactory'
  if (srcRole === 'extractor' && isStoreRole(destRole)) return 'extractorToStore'
  return 'other'
}

export function buildRouteEdges(layout: PiColonyLayout): RouteEdge[] {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const edges: RouteEdge[] = []

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest) continue

    edges.push({
      routeId: route.route_id,
      sourcePinId: route.source_pin_id,
      destPinId: route.destination_pin_id,
      typeId: route.content_type_id,
      quantity: route.quantity,
      kind: classifyEdge(source, dest),
    })
  }

  return edges
}

/** Ciclo (segundos) que rege a saída de um pin: extrator ou receita da fábrica. */
function pinOutputCycleTimeSec(pin: PiPin): number {
  const role = pinRole(pin.type_id)
  if (role === 'extractor') return pin.extractor_details?.cycle_time ?? 0
  if (isProcessorRole(role)) {
    const schematicId = resolveSchematicId(pin)
    if (!schematicId) return 0
    return getSchematicById(schematicId)?.cycleTimeSec ?? 0
  }
  return 0
}

/**
 * Máximo de unidades/hora que ENTRA em cada pin, por commodity: a quantidade da
 * rota dividida pelo ciclo de quem a dispara. Numa rota store → fábrica quem
 * dispara é a FÁBRICA (ela puxa a cada ciclo dela); nas demais, a origem.
 */
export function incomingThroughput(layout: PiColonyLayout): ThroughputByPin {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const incoming: ThroughputByPin = new Map()

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest || route.quantity <= 0) continue

    const cycleSec =
      isStoreRole(pinRole(source.type_id)) && isProcessorRole(pinRole(dest.type_id))
        ? pinOutputCycleTimeSec(dest)
        : pinOutputCycleTimeSec(source)
    if (cycleSec <= 0) continue

    const rate = (route.quantity / cycleSec) * 3_600
    const byType = incoming.get(route.destination_pin_id) ?? new Map<number, number>()
    byType.set(route.content_type_id, (byType.get(route.content_type_id) ?? 0) + rate)
    incoming.set(route.destination_pin_id, byType)
  }

  return incoming
}

/** Unidades/hora que SAEM de cada storage/launchpad, pelo ciclo da fábrica destino. */
export function outgoingThroughput(layout: PiColonyLayout): ThroughputByPin {
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const outgoing: ThroughputByPin = new Map()

  for (const route of layout.routes) {
    const source = pinById.get(route.source_pin_id)
    const dest = pinById.get(route.destination_pin_id)
    if (!source || !dest || route.quantity <= 0) continue
    if (!isStoreRole(pinRole(source.type_id))) continue

    const cycleSec = pinOutputCycleTimeSec(dest)
    if (cycleSec <= 0) continue

    const rate = (route.quantity / cycleSec) * 3_600
    const byType = outgoing.get(route.source_pin_id) ?? new Map<number, number>()
    byType.set(route.content_type_id, (byType.get(route.content_type_id) ?? 0) + rate)
    outgoing.set(route.source_pin_id, byType)
  }

  return outgoing
}

/** Commodities que chegam a um store por rota (buffer intermediário incluído). */
export function routedToStoreTypeIds(edges: RouteEdge[]): Set<number> {
  const routed = new Set<number>()
  for (const edge of edges) {
    if (edge.kind === 'toExportStore' || edge.kind === 'extractorToStore') {
      routed.add(edge.typeId)
    }
  }
  return routed
}

/**
 * Commodities que chegam ao store e NÃO voltam para uma fábrica local — a saída
 * de verdade da colônia. Difere de `routedToStoreTypeIds`: os pulos
 * fábrica→storage de uma cadeia P1→P2 são buffer, não exportação.
 */
export function terminalExportTypeIds(edges: RouteEdge[]): Set<number> {
  const consumedFromStore = new Set<number>()
  for (const edge of edges) {
    if (edge.kind === 'fromStoreToFactory') consumedFromStore.add(edge.typeId)
  }

  const terminal = new Set<number>()
  for (const edge of edges) {
    if (edge.kind !== 'toExportStore' && edge.kind !== 'extractorToStore') continue
    if (!consumedFromStore.has(edge.typeId)) terminal.add(edge.typeId)
  }
  return terminal
}

/** Itens parados em store que nenhuma receita local consome (produto acabado ou sobra). */
export function storedUnusedTypeIds(
  layout: PiColonyLayout,
  recipeInputTypeIds: Set<number>
): Set<number> {
  const stored = new Set<number>()
  for (const pin of layout.pins) {
    if (!isStoreRole(pinRole(pin.type_id))) continue
    for (const content of pin.contents ?? []) {
      if (!recipeInputTypeIds.has(content.type_id) && content.amount > 0) {
        stored.add(content.type_id)
      }
    }
  }
  return stored
}

/** Tudo que a colônia pode vender: maior tier produzido + terminal + sobra parada. */
export function exportableTypeIds(
  layout: PiColonyLayout,
  producedTypeIds: Set<number>,
  recipeInputTypeIds: Set<number>,
  tierOf: (typeId: number) => number | undefined
): Set<number> {
  const edges = buildRouteEdges(layout)
  const exportable = new Set<number>()

  let maxTier = -1
  const highestTierTypes = new Set<number>()
  for (const typeId of producedTypeIds) {
    const tier = tierOf(typeId) ?? -1
    if (tier > maxTier) {
      maxTier = tier
      highestTierTypes.clear()
      highestTierTypes.add(typeId)
    } else if (tier === maxTier) {
      highestTierTypes.add(typeId)
    }
  }
  for (const typeId of highestTierTypes) exportable.add(typeId)
  for (const typeId of storedUnusedTypeIds(layout, recipeInputTypeIds)) exportable.add(typeId)
  for (const typeId of terminalExportTypeIds(edges)) exportable.add(typeId)

  return exportable
}

/**
 * Commodities que a fábrica puxa de um store mas NINGUÉM produz no planeta —
 * ou seja, vêm do mercado. É a definição de "só-import", e é o que a Fase B1 usa
 * para saber que um buffer vazio pode ser só o fim do ciclo de reabastecimento.
 */
export function importedTypeIds(
  layout: PiColonyLayout,
  localSupplyTypeIds: Set<number>
): Set<number> {
  const edges = buildRouteEdges(layout)
  const pinById = new Map(layout.pins.map((p) => [p.pin_id, p]))
  const imported = new Set<number>()

  for (const edge of edges) {
    if (edge.kind !== 'fromStoreToFactory') continue
    const source = pinById.get(edge.sourcePinId)
    if (!source || !isStoreRole(pinRole(source.type_id))) continue
    if (!localSupplyTypeIds.has(edge.typeId)) imported.add(edge.typeId)
  }

  return imported
}
