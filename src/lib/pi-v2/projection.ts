/**
 * Avanço de estoque no tempo + selo de honestidade da idade do dado.
 *
 * Porte do `project-forward.ts` da Fase A, VALIDADO em produção contra o jogo
 * (6-IAFR I: launchpad projetada vazia, jogo "No Contents Present"; drenagem de
 * −200/h em 21h na mosca). Não reescrever a matemática — ela já foi provada.
 *
 * A regra inegociável: projeção SEMPRE se anuncia. Nenhum número projetado pode
 * se passar por medido, e acima de 72h a projeção se suspende em vez de
 * extrapolar (extrapolar 3+ dias linearmente mente mais que mostrar dado velho
 * assumido velho).
 */

/** Milissegundos em uma hora — a unidade de tempo do motor é a hora. */
const MS_PER_HOUR = 3_600_000

/**
 * Avança o estoque de um buffer do instante do snapshot até `nowMs`, integrando
 * a taxa líquida. Satura em [0, capacidade].
 *
 * Integração LINEAR da taxa líquida corrente. É suficiente e validado
 * empiricamente; a taxa já vem capada pela produção/consumo corrente de quem
 * chama. O refino pelo ciclo discreto da fábrica (consome no início, produz no
 * fim) é fase posterior — a aproximação contínua erra ~2 unidades num P4.
 */
export function projectStock(
  snapshotAmount: number,
  netPerHour: number,
  elapsedHours: number,
  opts?: { maxUnits?: number }
): number {
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return snapshotAmount
  const projected = snapshotAmount + netPerHour * elapsedHours
  const floored = Math.max(0, projected)
  return opts?.maxUnits != null ? Math.min(floored, opts.maxUnits) : floored
}

/** Idade do snapshot em horas. Ausente/inválido/futuro → 0 (não projeta nada). */
export function elapsedHoursSince(lastUpdate: string | undefined, nowMs: number): number {
  if (!lastUpdate) return 0
  const t0 = Date.parse(lastUpdate)
  if (!Number.isFinite(t0)) return 0
  return Math.max(0, (nowMs - t0) / MS_PER_HOUR)
}

/**
 * Banda de confiança derivada da idade do snapshot.
 *
 *  - `live`      (< 1h):   ao vivo, projeção plena.
 *  - `estimated` (1–24h):  estimado, projeção plena.
 *  - `diverging` (24–72h): estimado com aviso, projeção plena mas pode divergir.
 *  - `suspended` (> 72h):  desatualizado — projeção SUSPENSA, mostra o medido.
 */
export type StalenessBand = 'live' | 'estimated' | 'diverging' | 'suspended'

export function stalenessBand(elapsedHours: number): StalenessBand {
  if (!Number.isFinite(elapsedHours) || elapsedHours < 1) return 'live'
  if (elapsedHours < 24) return 'estimated'
  if (elapsedHours <= 72) return 'diverging'
  return 'suspended'
}

/** True quando a projeção deve realmente avançar o estoque nesta banda. */
export function bandAllowsProjection(band: StalenessBand): boolean {
  return band !== 'suspended'
}

/** O selo que acompanha todo número projetado. Nunca omitir na UI. */
export interface ProjectionConfidence {
  /** Idade do snapshot da ESI, em horas. */
  ageHours: number
  band: StalenessBand
  /** ISO do snapshot que ancora a projeção (T₀), quando conhecido. */
  anchorIso?: string
  /**
   * false quando a banda suspendeu a projeção (>72h) ou não há âncora — os
   * números exibidos são o SNAPSHOT CRU, e a UI precisa dizer isso.
   */
  projectionApplied: boolean
}

/**
 * Monta o selo e decide, de uma vez, quantas horas a projeção pode avançar.
 * `effectiveElapsedHrs` é 0 quando a projeção está suspensa — assim todo
 * `projectStock` a jusante devolve o valor medido sem nenhum `if` extra.
 */
export function resolveConfidence(
  lastUpdate: string | undefined,
  nowMs: number
): ProjectionConfidence & { effectiveElapsedHrs: number } {
  const ageHours = elapsedHoursSince(lastUpdate, nowMs)
  const band = stalenessBand(ageHours)
  const projectionApplied = lastUpdate != null && bandAllowsProjection(band)
  return {
    ageHours,
    band,
    anchorIso: lastUpdate,
    projectionApplied,
    effectiveElapsedHrs: projectionApplied ? ageHours : 0,
  }
}
