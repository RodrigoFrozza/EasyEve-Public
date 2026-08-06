/**
 * Fase A do Motor de Projeção — avanço linear de estoque + selo de idade.
 *
 * O app mostra o estoque congelado do último snapshot da ESI, que só atualiza
 * quando o jogador abre a colônia no jogo. A matemática das taxas já está
 * correta; o que falta é AVANÇAR o `amount` do snapshot até agora integrando a
 * taxa líquida corrente. Estas funções são puras e isoladas — a decisão de
 * aplicá-las (feature flag) e o threading de tempo ficam nos chamadores.
 */

/**
 * Avança o estoque de um buffer do instante do snapshot até `nowMs`,
 * integrando a taxa líquida. Satura em [0, capacidade].
 *
 * Fase A: integração LINEAR da taxa líquida corrente. É suficiente e já validado
 * empiricamente (a drenagem linear de -200/h bateu com o jogo em 21h). O refino
 * pela curva de decaimento do extrator fica para fase posterior — aqui a taxa
 * corrente já vem capada pelo production-graph (currentInflowCap/OutflowCap).
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

export function elapsedHoursSince(lastUpdate: string | undefined, nowMs: number): number {
  if (!lastUpdate) return 0
  const t0 = Date.parse(lastUpdate)
  if (!Number.isFinite(t0)) return 0
  return Math.max(0, (nowMs - t0) / 3_600_000)
}

/**
 * Selo de honestidade da idade do snapshot. O dado projetado nunca pode se passar
 * por medido — a banda deriva de quanto tempo faz desde o último snapshot da ESI.
 *
 *  - `live`      (< 1h):  ao vivo, projeção plena.
 *  - `estimated` (1–24h): estimado, projeção plena.
 *  - `diverging` (24–72h): estimado com aviso, projeção plena mas pode divergir.
 *  - `suspended` (> 72h): desatualizado — projeção SUSPENSA. Extrapolar 3+ dias
 *    linearmente seria mentira maior que mostrar o snapshot cru assumido velho.
 */
export type StalenessBand = 'live' | 'estimated' | 'diverging' | 'suspended'

export function stalenessBand(elapsedHours: number): StalenessBand {
  if (!Number.isFinite(elapsedHours) || elapsedHours < 1) return 'live'
  if (elapsedHours < 24) return 'estimated'
  if (elapsedHours <= 72) return 'diverging'
  return 'suspended'
}

/** True quando a projeção deve realmente avançar o estoque para uma dada banda. */
export function bandAllowsProjection(band: StalenessBand): boolean {
  return band !== 'suspended'
}

/**
 * Parser puro do valor da feature flag `pi_projection_engine` (env
 * `PI_PROJECTION_ENGINE`). Mantido puro (recebe a string, não lê `process.env`)
 * para ser testável e importável no cliente.
 *
 *  - vazio / '0' / 'false' / 'off' → desligado (comportamento atual, byte a byte).
 *  - '1' / 'true' / 'on' / 'all'   → ligado para todos.
 *  - qualquer outra coisa          → allowlist separada por vírgula de userIds
 *    (rollout "só para o Rodrigo primeiro": setar env para o userId dele).
 */
export function isProjectionEnabledFor(
  flagValue: string | undefined,
  userId: string
): boolean {
  if (!flagValue) return false
  const v = flagValue.trim().toLowerCase()
  if (v === '' || v === '0' || v === 'false' || v === 'off') return false
  if (v === '1' || v === 'true' || v === 'on' || v === 'all') return true
  return flagValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId)
}
