/**
 * Normalization and deduplication keys for ratting wallet logs.
 * Auto-detection and wallet sync must use the same shape so the first bounty is not duplicated.
 */

import { ESI_REF_TYPES } from '@/lib/constants/activity-data'

export type RattingLogLike = {
  refId?: string | number
  id?: string | number
  date: string
  amount?: number
  type?: string
  charName?: string
  characterName?: string
  charId?: number
  characterId?: number
  [key: string]: unknown
}

export function normalizeRattingLog(log: RattingLogLike, defaultCharId?: number): RattingLogLike {
  const charId = log.charId ?? log.characterId ?? defaultCharId
  const refIdRaw = log.refId ?? log.id
  const refId = refIdRaw != null && refIdRaw !== '' ? String(refIdRaw) : undefined

  return {
    ...log,
    charId,
    refId,
    charName: log.charName ?? log.characterName,
    amount: log.type === 'tax' ? log.amount : Math.abs(log.amount ?? 0),
  }
}

/** Primary dedup key (matches wallet sync composite key when refId is present). */
export function rattingLogDedupKey(log: RattingLogLike, defaultCharId?: number): string {
  const n = normalizeRattingLog(log, defaultCharId)
  const charId = n.charId ?? 0
  const refId = n.refId ?? ''
  const type = n.type ?? 'bounty'
  const ts = new Date(n.date).getTime()
  if (refId) {
    return `${charId}-${refId}-${type}-${ts}`
  }
  const amount = Math.round(n.amount ?? 0)
  const name = n.charName ?? ''
  return `legacy:${name}-${type}-${ts}-${amount}`
}

/** Semantic key without refId — matches auto-detect vs wallet when refId was missing on legacy rows. */
export function rattingLogSemanticKey(log: RattingLogLike, defaultCharId?: number): string {
  const n = normalizeRattingLog(log, defaultCharId)
  const charId = n.charId ?? 0
  const type = n.type ?? 'bounty'
  const ts = new Date(n.date).getTime()
  const amount = Math.round(n.amount ?? 0)
  const name = n.charName ?? ''
  return `sem:${charId || name}-${type}-${ts}-${amount}`
}

export function isSameRattingEvent(a: RattingLogLike, b: RattingLogLike): boolean {
  const na = normalizeRattingLog(a)
  const nb = normalizeRattingLog(b)
  if (na.type !== nb.type) return false
  if (new Date(na.date).getTime() !== new Date(nb.date).getTime()) return false
  if (Math.round(na.amount ?? 0) !== Math.round(nb.amount ?? 0)) return false

  const aChar = na.charId ?? 0
  const bChar = nb.charId ?? 0
  if (aChar > 0 && bChar > 0) return aChar === bChar
  if (aChar > 0 && bChar === 0) return na.charName === nb.charName
  if (bChar > 0 && aChar === 0) return na.charName === nb.charName
  return (na.charName ?? '') === (nb.charName ?? '')
}

export function classifyRattingJournalRefType(
  refType: string
): 'bounty' | 'ess' | 'tax' | null {
  const normalized = refType.toLowerCase()
  if (ESI_REF_TYPES.TAX.some((t) => normalized === t || normalized.includes(t))) {
    return 'tax'
  }
  if (ESI_REF_TYPES.BOUNTY.some((t) => normalized === t || normalized.includes(t))) {
    return 'bounty'
  }
  if (ESI_REF_TYPES.ESS.some((t) => normalized === t || normalized.includes(t))) {
    return 'ess'
  }
  return null
}

export function buildRattingLogFromJournalEntry(
  entry: { id?: number; date: string; amount?: number; ref_type?: string },
  charId: number,
  charName: string,
  type: 'bounty' | 'ess' | 'tax'
): RattingLogLike {
  const amount = type === 'tax' ? entry.amount ?? 0 : Math.abs(entry.amount ?? 0)
  return {
    refId: entry.id != null ? String(entry.id) : undefined,
    date: entry.date,
    amount,
    type,
    charName,
    charId,
  }
}

/** Register a log in the map under all keys that identify the same event. */
export function registerRattingLogInMap(
  logMap: Map<string, RattingLogLike>,
  log: RattingLogLike,
  defaultCharId?: number
): void {
  const normalized = normalizeRattingLog(log, defaultCharId)
  logMap.set(rattingLogDedupKey(normalized), normalized)
  logMap.set(rattingLogSemanticKey(normalized), normalized)
}

/** Returns true if an equivalent log is already in the map. */
export function rattingLogMapHasEquivalent(
  logMap: Map<string, RattingLogLike>,
  log: RattingLogLike,
  defaultCharId?: number
): boolean {
  const normalized = normalizeRattingLog(log, defaultCharId)
  if (logMap.has(rattingLogDedupKey(normalized))) return true
  if (logMap.has(rattingLogSemanticKey(normalized))) return true

  for (const existing of logMap.values()) {
    if (isSameRattingEvent(existing, normalized)) return true
  }
  return false
}
