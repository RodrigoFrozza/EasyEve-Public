/**
 * Curva de decaimento do extrator — fórmula pública da CCP.
 *
 *   decayValue = qty_per_cycle / (1 + t · 0.012)
 *   barHeight  = decayValue · (1 + 0.8 · max(0, (cosA+cosB+cosC)/3))
 *
 * Constantes `decay_factor=0.012` e `noise_factor=0.8` (dogma 1683/1687). Como a
 * curva é fixada no `install_time`, dá para calcular o yield de cada ciclo até o
 * fim do programa MESMO a partir de um snapshot antigo — é o que torna a
 * projeção possível para colônias extrativas.
 *
 * Porte de `extractor-decay.ts` do v1, cuja matemática já estava correta. O
 * comportamento é preservado inclusive no arredondamento quirky de
 * `cycleOutput` (o `- 1` no caso exato), que reproduz o que o jogo mostra.
 *
 * `qty_per_cycle` da ESI já é o total das cabeças — não multiplicar por
 * `heads.length`.
 */

const DECAY_FACTOR = 0.012
const NOISE_FACTOR = 0.8
/** A CCP normaliza o tempo em "barras" de 15 minutos. */
const BAR_SECONDS = 900

function cycleOutput(baseValue: number, cycleIndex: number, cycleTimeSec: number): number {
  const barWidth = cycleTimeSec / BAR_SECONDS
  const t = (cycleIndex + 0.5) * barWidth
  const decayValue = baseValue / (1 + t * DECAY_FACTOR)
  const phaseShift = Math.pow(baseValue, 0.7)
  const sinA = Math.cos(phaseShift + t * (1 / 12))
  const sinB = Math.cos(phaseShift / 2 + t * 0.2)
  const sinC = Math.cos(t * 0.5)
  const sinStuff = Math.max((sinA + sinB + sinC) / 3, 0)
  const barHeight = decayValue * (1 + NOISE_FACTOR * sinStuff)
  const output = barWidth * barHeight
  return output - Math.floor(output) === 0 ? Math.floor(output) - 1 : Math.floor(output)
}

/** Yield de cada ciclo do programa, na ordem. */
export function extractorCycleOutputs(
  qtyPerCycle: number,
  cycleTimeSec: number,
  totalCycles: number
): number[] {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0 || totalCycles <= 0) return []
  const values: number[] = []
  for (let i = 0; i < totalCycles; i += 1) {
    values.push(Math.max(0, cycleOutput(qtyPerCycle, i, cycleTimeSec)))
  }
  return values
}

function parseWindow(
  installTime?: string,
  expiryTime?: string
): { startMs: number; endMs: number } | null {
  if (!installTime || !expiryTime) return null
  const startMs = Date.parse(installTime)
  const endMs = Date.parse(expiryTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  return { startMs, endMs }
}

/** Total já extraído do install até `nowMs` (limitado pelo fim do programa). */
export function extractorOutputUntil(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime: string | undefined,
  expiryTime: string | undefined,
  nowMs: number
): number {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0) return 0
  const window = parseWindow(installTime, expiryTime)
  if (!window) return 0

  const durationSec = Math.max(0, (Math.min(window.endMs, nowMs) - window.startMs) / 1000)
  const totalCycles = Math.floor(durationSec / cycleTimeSec)
  if (totalCycles <= 0) return 0

  return extractorCycleOutputs(qtyPerCycle, cycleTimeSec, totalCycles).reduce(
    (sum, v) => sum + v,
    0
  )
}

/** Total do programa inteiro (install → expiry). Base da taxa "desenhada". */
export function extractorProgramTotal(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime?: string,
  expiryTime?: string
): number {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0) return 0
  const window = parseWindow(installTime, expiryTime)
  if (!window) return 0

  const durationSec = (window.endMs - window.startMs) / 1000
  const totalCycles = Math.floor(durationSec / cycleTimeSec)
  if (totalCycles <= 0) return 0

  return extractorCycleOutputs(qtyPerCycle, cycleTimeSec, totalCycles).reduce(
    (sum, v) => sum + v,
    0
  )
}

/** Taxa média do programa inteiro (unidades/hora) — a taxa "desenhada". */
export function extractorDesignedUnitsPerHour(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime?: string,
  expiryTime?: string
): number {
  const window = parseWindow(installTime, expiryTime)
  if (!window) return 0
  const programHours = (window.endMs - window.startMs) / 3_600_000
  if (programHours <= 0) return 0
  return (
    extractorProgramTotal(qtyPerCycle, cycleTimeSec, installTime, expiryTime) / programHours
  )
}

/**
 * Taxa corrente (unidades/hora) até `nowMs` — cai ao longo do programa por causa
 * do decaimento. É o que distingue um extrator recém-instalado de um no fim.
 */
export function extractorCurrentUnitsPerHour(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime: string | undefined,
  expiryTime: string | undefined,
  nowMs: number
): number {
  const window = parseWindow(installTime, expiryTime)
  if (!window) return 0

  const effectiveEnd = Math.min(window.endMs, nowMs)
  if (effectiveEnd <= window.startMs) return 0

  const programHours = (window.endMs - window.startMs) / 3_600_000
  if (programHours <= 0) return 0

  const totalOutput = extractorProgramTotal(qtyPerCycle, cycleTimeSec, installTime, expiryTime)
  if (effectiveEnd >= window.endMs) return totalOutput / programHours

  const elapsedOutput = extractorOutputUntil(
    qtyPerCycle,
    cycleTimeSec,
    installTime,
    expiryTime,
    nowMs
  )
  const elapsedHours = (effectiveEnd - window.startMs) / 3_600_000

  // Nenhum ciclo fechou ainda (ainda dentro do primeiro desde o install/resurvey):
  // o total até agora é 0 e reportar taxa 0 diria "parado" de uma colônia que está
  // extraindo. A média do programa é a melhor estimativa instantânea disponível.
  if (elapsedOutput <= 0 && elapsedHours > 0) return totalOutput / programHours

  return elapsedHours > 0 ? elapsedOutput / elapsedHours : 0
}

/** Programa vencido → produção corrente 0 até o jogador re-survey. */
export function isExtractorExpired(expiryTime: string | undefined, nowMs: number): boolean {
  if (!expiryTime) return true
  const endMs = Date.parse(expiryTime)
  return !Number.isFinite(endMs) || endMs <= nowMs
}
