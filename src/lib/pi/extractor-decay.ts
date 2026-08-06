const DECAY_FACTOR = 0.012
const NOISE_FACTOR = 0.8

function calculateCycleOutput(baseValue: number, cycleIndex: number, cycleTimeSec: number): number {
  const barWidth = cycleTimeSec / 900
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

export function calculateExtractorCycleOutputs(
  qtyPerCycle: number,
  cycleTimeSec: number,
  totalCycles: number
): number[] {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0 || totalCycles <= 0) return []
  const values: number[] = []
  for (let i = 0; i < totalCycles; i += 1) {
    values.push(Math.max(0, calculateCycleOutput(qtyPerCycle, i, cycleTimeSec)))
  }
  return values
}

export function calculateExtractorTotalOutput(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime?: string,
  expiryTime?: string,
  nowMs: number = Date.now()
): number {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0) return 0
  if (!installTime || !expiryTime) return 0

  const startMs = Date.parse(installTime)
  const endMs = Date.parse(expiryTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0

  const durationSec = Math.max(0, (Math.min(endMs, nowMs) - startMs) / 1000)
  const totalCycles = Math.floor(durationSec / cycleTimeSec)
  if (totalCycles <= 0) return 0

  return calculateExtractorCycleOutputs(qtyPerCycle, cycleTimeSec, totalCycles).reduce(
    (sum, v) => sum + v,
    0
  )
}

export function calculateExtractorProgramTotalOutput(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime?: string,
  expiryTime?: string
): number {
  if (qtyPerCycle <= 0 || cycleTimeSec <= 0 || !installTime || !expiryTime) return 0
  const startMs = Date.parse(installTime)
  const endMs = Date.parse(expiryTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0

  const durationSec = (endMs - startMs) / 1000
  const totalCycles = Math.floor(durationSec / cycleTimeSec)
  if (totalCycles <= 0) return 0

  return calculateExtractorCycleOutputs(qtyPerCycle, cycleTimeSec, totalCycles).reduce(
    (sum, v) => sum + v,
    0
  )
}

export function averageUnitsPerHour(
  qtyPerCycle: number,
  cycleTimeSec: number,
  installTime?: string,
  expiryTime?: string,
  nowMs: number = Date.now()
): number {
  if (!installTime || !expiryTime) return 0
  const startMs = Date.parse(installTime)
  const endMs = Date.parse(expiryTime)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0

  const effectiveEnd = Math.min(endMs, nowMs)
  if (effectiveEnd <= startMs) return 0

  const programHours = (endMs - startMs) / 3_600_000
  if (programHours <= 0) return 0

  const totalOutput = calculateExtractorProgramTotalOutput(
    qtyPerCycle,
    cycleTimeSec,
    installTime,
    expiryTime
  )

  if (effectiveEnd >= endMs) {
    return totalOutput / programHours
  }

  const elapsedOutput = calculateExtractorTotalOutput(
    qtyPerCycle,
    cycleTimeSec,
    installTime,
    expiryTime,
    nowMs
  )
  const elapsedHours = (effectiveEnd - startMs) / 3_600_000

  // No cycle has completed yet (still within the first cycle since install/resurvey) —
  // calculateExtractorTotalOutput floors to 0 completed cycles, which would otherwise
  // report a 0 current rate for a colony that's actively extracting. Fall back to the
  // program-wide average as the best available instantaneous estimate.
  if (elapsedOutput <= 0 && elapsedHours > 0) {
    return totalOutput / programHours
  }

  return elapsedHours > 0 ? elapsedOutput / elapsedHours : 0
}

export function isExtractorExpired(expiryTime?: string, nowMs: number = Date.now()): boolean {
  if (!expiryTime) return true
  const endMs = Date.parse(expiryTime)
  return !Number.isFinite(endMs) || endMs <= nowMs
}
