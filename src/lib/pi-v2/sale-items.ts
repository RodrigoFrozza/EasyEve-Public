/**
 * A lista fechada do que conta como "backlog de venda de PI" (Frente 2).
 *
 * Não é "todo P4" nem `getCommodityTier() === 'P4'`: o Rodrigo confirmou os 8 P4
 * que ele efetivamente vende por contrato mais o Industrial Explosives (P3, vende
 * direto no mercado local de UALX-3) — os dois canais são backlog do mesmo jeito,
 * PI pronto que ainda não virou ISK. Lista fechada e explícita para não incluir
 * silenciosamente um P4 novo que ele não vende assim, nem perder o Industrial
 * Explosives por não ser P4.
 *
 * Fonte: vault `01 Fundamentos/TypeIDs de PI (decodificação)`.
 */
export const PI_SALE_TRACKED_TYPE_IDS: readonly number[] = [
  2867, // P4
  2868, // P4
  2869, // P4
  2870, // P4
  2871, // P4
  2872, // P4
  2875, // P4 — Sterile Conduits
  2876, // P4
  2360, // P3 — Industrial Explosives
]

const SALE_TRACKED_SET: ReadonlySet<number> = new Set(PI_SALE_TRACKED_TYPE_IDS)

export function isSaleTrackedItem(typeId: number): boolean {
  return SALE_TRACKED_SET.has(typeId)
}
