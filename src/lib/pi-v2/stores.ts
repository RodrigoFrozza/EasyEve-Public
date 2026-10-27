/**
 * Storages, launchpads e command centers — os únicos pins que guardam estoque, e
 * portanto os únicos com buffer a projetar.
 *
 * Porte de `pin-fill.ts`. Diferença do v1: o rótulo do pin é derivado aqui do
 * `type_id` (nome da estrutura + id), em vez de vir de uma "routing view" da
 * camada de apresentação. O núcleo não deve depender da UI para nomear um pin.
 */

import type { PiColonyLayout } from '@/lib/pi-v2/esi'
import {
  getCommodityVolume,
  getPinCapacityM3,
  getPinStructureName,
  isStoreRole,
  pinRole,
  type StoreRole,
} from '@/lib/pi-v2/sde'

export interface StoreNode {
  pinId: number
  typeId: number
  role: StoreRole
  /** Rótulo derivado: nome da estrutura + id da ESI (ex.: "Launchpad #1054…659"). */
  label: string
  capacityM3: number
  /** m³ ocupados pelo estoque MEDIDO no snapshot (a projeção recalcula depois). */
  usedM3: number
  contents: Array<{ typeId: number; amount: number }>
}

export function buildStoreNodes(layout: PiColonyLayout): StoreNode[] {
  const nodes: StoreNode[] = []

  for (const pin of layout.pins) {
    const role = pinRole(pin.type_id)
    if (!isStoreRole(role)) continue

    const contents = (pin.contents ?? []).map((c) => ({
      typeId: c.type_id,
      amount: c.amount,
    }))

    nodes.push({
      pinId: pin.pin_id,
      typeId: pin.type_id,
      role,
      label: `${getPinStructureName(pin.type_id)} #${pin.pin_id}`,
      capacityM3: getPinCapacityM3(pin.type_id),
      usedM3: contents.reduce((sum, c) => sum + c.amount * getCommodityVolume(c.typeId), 0),
      contents,
    })
  }

  return nodes
}

/** Soma de um tipo em TODOS os stores da colônia (visão de planeta, não de pin). */
export function totalStoredUnits(layout: PiColonyLayout, typeId: number): number {
  let total = 0
  for (const pin of layout.pins) {
    if (!isStoreRole(pinRole(pin.type_id))) continue
    for (const content of pin.contents ?? []) {
      if (content.type_id === typeId) total += content.amount
    }
  }
  return total
}
