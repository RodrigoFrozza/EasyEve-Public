/**
 * Costura (seam) para os dados estáticos do jogo que o v2 consome.
 *
 * As tabelas do SDE (schematics, tiers, nomes, volumes, capacidades, papéis de
 * pin) NÃO são código do v1 — são dados do EVE. Duplicá-las criaria duas cópias
 * do SDE que divergem em silêncio, exatamente o tipo de falha que a regra de
 * ouro proíbe. Então o v2 as COMPARTILHA, mas importa tudo por aqui.
 *
 * Consequência prática: nenhum arquivo de `pi-v2/` importa de `@/lib/pi/*` a não
 * ser este. Quando o v1 for apagado (último passo do rollout), `pi-static-data.ts`
 * MUDA DE CASA em vez de ser removido, e só este arquivo precisa apontar para o
 * novo endereço.
 *
 * ⚠️ **Este arquivo é client-safe e precisa continuar sendo.** Só dado estático
 * entra aqui: nada que importe `prisma`, ESI ou qualquer coisa de servidor. O
 * motor de projeção roda no navegador (o tick visual) e no scheduler, e um único
 * re-export server-only aqui arrastaria o Prisma para o bundle do cliente. O
 * order book (`fillFromOrders`, `MarketDepth`) mora em `pricing/`, que é
 * server-only por natureza, justamente por isso.
 */

export {
  getCommodityName,
  getCommodityTier,
  getCommodityVolume,
  getPinCapacityM3,
  getPinRole,
  getPinStructureName,
  getSchematicById,
  PLANET_TYPES,
} from '@/lib/pi/pi-static-data'

export type {
  PiCommodityTier,
  PiPinRole,
  PiSchematic,
} from '@/lib/pi/pi-static-data'

/** Custos de CPU/Powergrid vindos dos atributos dogma da ESI (não são chutes). */
export { ccGridBudget, extractorHeadCost, pinGridLoad } from '@/lib/pi/pi-grid-data'
export type { PiGridCost } from '@/lib/pi/pi-grid-data'

import { getPinRole, type PiPinRole } from '@/lib/pi/pi-static-data'

/** Pins que transformam matéria: BIF / AIF / HTIF. */
export function isProcessorRole(role: PiPinRole): boolean {
  return (
    role === 'basic_processor' ||
    role === 'advanced_processor' ||
    role === 'high_tech_processor'
  )
}

/** Papéis que guardam estoque — os únicos que têm buffer a projetar. */
export type StoreRole = 'storage' | 'launchpad' | 'command_center'

export function isStoreRole(role: PiPinRole): role is StoreRole {
  return role === 'launchpad' || role === 'command_center' || role === 'storage'
}

/**
 * Schematic efetivo de um pin de fábrica. A ESI devolve o id em
 * `factory_details.schematic_id`, mas alguns payloads antigos o trazem solto no
 * pin — aceitar os dois evita fábrica "sem receita" (que viraria produção 0).
 */
export function resolveSchematicId(pin: {
  schematic_id?: number
  factory_details?: { schematic_id?: number }
}): number | undefined {
  const fromFactory = pin.factory_details?.schematic_id
  if (typeof fromFactory === 'number' && fromFactory > 0) return fromFactory
  if (typeof pin.schematic_id === 'number' && pin.schematic_id > 0) return pin.schematic_id
  return undefined
}

/** Papel do pin direto do type_id — reexportado com nome curto para o v2. */
export function pinRole(typeId: number): PiPinRole {
  return getPinRole(typeId)
}
