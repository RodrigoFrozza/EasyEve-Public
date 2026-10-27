/**
 * Imposto de POCO / Orbital Skyhook.
 *
 * O jogo NÃO taxa sobre o preço de mercado — taxa sobre um **valor-base fixo por
 * item**, lido do SDE (atributos dogma `exportTaxMultiplier` 1641 /
 * `importTaxMultiplier` 1640, gerados em `pi-static-data.ts`). Na prática é
 * constante por tier (todo P4 = 1.200.000), mas não é suposto. Import é sempre
 * metade do export.
 *
 *   Export = valor_base_do_tier × alíquota × quantidade
 *   Import = valor_base_do_tier × alíquota × quantidade × 0,5
 *
 * Confirmado in-game em 21/07/2026 (UALX-3, Skyhook a 2%):
 *   - Exportar 1× Nano-Factory (P4) = 24.000 = 1.200.000 × 2%
 *   - Importar 1× Fertilizer (P2)   = 72     = 7.200 × 2% × 0,5
 *
 * Taxar sobre mercado (o bug do v1 até 21/07) superestimava o total em ~1,31×,
 * quase todo o erro no import — a base de P2 (7.200) é bem menor que o mercado.
 *
 * O Orbital Skyhook preserva integralmente a tributação do POCO antigo; só muda
 * quem define a alíquota.
 */

import { getCustomsBaseValue } from '@/lib/pi-v2/sde'

/** Alíquota default quando o usuário não configurou nenhuma. */
export const DEFAULT_EXPORT_TAX_RATE = 0.1

/** O imposto de importação é sempre metade do de exportação. */
export const IMPORT_CUSTOMS_FACTOR = 0.5

/**
 * Imposto de alfândega em ISK/hora para um fluxo de `units` de `typeId`.
 *
 * Devolve 0 quando o SDE não tem valor-base para o item — **nunca taxa sobre um
 * valor chutado** (regra de ouro). O material comprado/vendido continua a preço
 * de mercado; só este componente usa o valor-base.
 */
export function customsTaxPerHour(
  units: number,
  typeId: number,
  taxRate: number,
  opts: { isImport?: boolean } = {}
): number {
  if (units <= 0 || taxRate <= 0) return 0
  const base = getCustomsBaseValue(typeId, { isImport: opts.isImport })
  if (!base) return 0
  return units * base * taxRate * (opts.isImport ? IMPORT_CUSTOMS_FACTOR : 1)
}
