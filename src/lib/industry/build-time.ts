/**
 * Build-time math for the Industry ISK/h feature. Pure — no I/O, no ESI.
 *
 * The preferred time source is EVE Ref (see everef-cost.ts), which returns a
 * fully bonus-adjusted duration (TE + structure + rigs + security + skills).
 * These helpers cover (a) parsing EVE Ref's ISO-8601 duration and (b) the local
 * fallback used when EVE Ref isn't called (NPC station, reactions, or an EVE Ref
 * failure): base SDE time reduced only by TE, with NO structure/skill bonus —
 * the caller labels that number as approximate (regra de ouro), exactly like the
 * material-cost fallback in production-cost.ts.
 */

/** TE research tops out at 20 (10 levels × 2% each). */
export function clampTe(te: number): number {
  return Math.max(0, Math.min(20, Math.floor(te)))
}

/**
 * Parse an ISO-8601 duration like "PT194H19M33S" (or "P1DT2H", "PT30M") into
 * seconds. Only the time-ish designators EVE Ref emits are handled (D/H/M/S).
 * Returns null for anything it can't parse, so the caller never treats garbage
 * as a real duration.
 */
export function parseIsoDurationToSeconds(iso: string): number | null {
  if (typeof iso !== 'string') return null
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso.trim())
  if (!match) return null
  const [, d, h, m, s] = match
  // A bare "P"/"PT" with no components isn't a real duration.
  if (!d && !h && !m && !s) return null
  const days = d ? Number(d) : 0
  const hours = h ? Number(h) : 0
  const mins = m ? Number(m) : 0
  const secs = s ? Number(s) : 0
  return days * 86400 + hours * 3600 + mins * 60 + secs
}

/**
 * Local fallback build time for the whole job: base per-run seconds × runs,
 * reduced by TE only. Structure/skill bonuses are NOT applied here — the caller
 * must label this as approximate. Null when base time is unknown (never invent
 * a duration).
 */
export function localBuildTimeSeconds(
  baseTimeSeconds: number | null | undefined,
  runs: number,
  te: number
): number | null {
  if (baseTimeSeconds == null || !(baseTimeSeconds > 0)) return null
  const effectiveRuns = Math.max(1, Math.floor(runs))
  const modifier = 1 - clampTe(te) / 100
  return baseTimeSeconds * effectiveRuns * modifier
}

/**
 * ISK per hour for a whole job: net profit over the total build time. Null when
 * time is unknown or non-positive (can't divide), so ISK/h is never a fake 0 or
 * Infinity. Net profit may itself be negative — that's a real, meaningful result
 * (a money-losing build) and is passed through.
 */
export function iskPerHour(
  netProfit: number | null | undefined,
  buildTimeSeconds: number | null | undefined
): number | null {
  if (netProfit == null || !Number.isFinite(netProfit)) return null
  if (buildTimeSeconds == null || !(buildTimeSeconds > 0)) return null
  return netProfit / (buildTimeSeconds / 3600)
}
