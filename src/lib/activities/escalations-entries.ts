export type EscalationEntryStatus = 'active' | 'completed' | 'expired'
export type EscalationLootMode = 'manual' | 'cargo'

export const DEFAULT_ESCALATION_VALIDITY_MS = 24 * 60 * 60 * 1000

export interface EscalationLootItem {
  name: string
  quantity: number
  value?: number
  typeId?: number
  unitPrice?: number
  totalValue?: number
}

export interface EscalationEntry {
  refId: string
  name: string
  dedRating?: string
  faction?: string
  purchasedFrom?: string
  pricePaid?: number
  acquiredAt: string
  expiresAt?: string
  lootMode?: EscalationLootMode
  lootValue?: number
  beforeCargoState?: string
  afterCargoState?: string
  lootContents?: EscalationLootItem[]
  status: EscalationEntryStatus
  completedAt?: string
  charName?: string
}

export interface EscalationsLogEntry {
  refId?: string
  date: string
  amount?: number
  type: string
  charName?: string
  charId?: number
  characterId?: number
  characterName?: string
  siteName?: string
  note?: string
  escalationRefId?: string
  [key: string]: unknown
}

export interface EscalationsActivityData {
  logs?: EscalationsLogEntry[]
  escalations?: EscalationEntry[]
  estimatedEscalationLootValue?: number
  estimatedEscalationCostValue?: number
  lastCargoState?: string
  npcFaction?: string
  automatedBounties?: number
  automatedEss?: number
  automatedTaxes?: number
  additionalBounties?: number
  grossBounties?: number
  lastDataAt?: string
  lastSyncAt?: string
  lastSyncWithChangesAt?: string
  [key: string]: unknown
}

function newRefId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function dedupeEscalations(entries: EscalationEntry[]): EscalationEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const refId = entry.refId?.trim()
    if (!refId || seen.has(refId)) return false
    seen.add(refId)
    return true
  })
}

export function recalcEscalationTotals(entries: EscalationEntry[]): {
  estimatedEscalationLootValue: number
  estimatedEscalationCostValue: number
} {
  let estimatedEscalationLootValue = 0
  let estimatedEscalationCostValue = 0

  for (const entry of entries) {
    estimatedEscalationCostValue += Number(entry.pricePaid) || 0
    if (entry.status === 'completed' || entry.status === 'expired') {
      estimatedEscalationLootValue += Number(entry.lootValue) || 0
    } else if (entry.status === 'active' && entry.lootValue != null) {
      estimatedEscalationLootValue += Number(entry.lootValue) || 0
    }
  }

  return { estimatedEscalationLootValue, estimatedEscalationCostValue }
}

export interface AppendEscalationInput {
  name: string
  dedRating?: string
  faction?: string
  purchasedFrom?: string
  pricePaid?: number
  acquiredAt?: string
  expiresAt?: string
  charName?: string
}

export function appendEscalation(
  data: EscalationsActivityData,
  input: AppendEscalationInput
): EscalationsActivityData {
  const escalations = dedupeEscalations([...(data.escalations || [])])
  const logs = data.logs || []
  const acquiredAt = input.acquiredAt || new Date().toISOString()
  const refId = newRefId('escalation')
  const pricePaid = Number(input.pricePaid) || 0
  const expiresAt =
    input.expiresAt ||
    new Date(new Date(acquiredAt).getTime() + DEFAULT_ESCALATION_VALIDITY_MS).toISOString()

  const entry: EscalationEntry = {
    refId,
    name: input.name.trim(),
    dedRating: input.dedRating,
    faction: input.faction,
    purchasedFrom: input.purchasedFrom?.trim() || undefined,
    pricePaid: pricePaid > 0 ? pricePaid : undefined,
    acquiredAt,
    expiresAt,
    status: 'active',
    charName: input.charName,
  }

  escalations.unshift(entry)

  const newLog: EscalationsLogEntry = {
    refId,
    date: acquiredAt,
    amount: pricePaid > 0 ? -pricePaid : 0,
    type: 'escalation-buy',
    charName: input.charName,
    charId: 0,
    siteName: entry.name,
    escalationRefId: refId,
    note: entry.purchasedFrom,
  }

  return {
    ...data,
    escalations,
    logs: [newLog, ...logs],
    lastDataAt: acquiredAt,
    ...recalcEscalationTotals(escalations),
  }
}

export interface SetEscalationLootInput {
  lootMode: EscalationLootMode
  lootValue: number
  beforeCargoState?: string
  afterCargoState?: string
  lootContents?: EscalationLootItem[]
  completedAt?: string
}

export function setEscalationLoot(
  data: EscalationsActivityData,
  refId: string,
  input: SetEscalationLootInput
): EscalationsActivityData | null {
  const escalations = dedupeEscalations(data.escalations || [])
  const idx = escalations.findIndex((e) => e.refId === refId)
  if (idx < 0) return null

  const completedAt = input.completedAt || new Date().toISOString()
  const lootValue = Number(input.lootValue) || 0

  const updated: EscalationEntry = {
    ...escalations[idx],
    lootMode: input.lootMode,
    lootValue,
    beforeCargoState: input.beforeCargoState,
    afterCargoState: input.afterCargoState,
    lootContents: input.lootContents,
    status: 'completed',
    completedAt,
  }

  const newEscalations = [...escalations]
  newEscalations[idx] = updated

  const logs = (data.logs || []).map((log) => {
    if (log.refId !== refId && log.escalationRefId !== refId) return log
    if (log.type === 'escalation-loot') return log
    return log
  })

  const lootLog: EscalationsLogEntry = {
    refId: `${refId}-loot`,
    date: completedAt,
    amount: lootValue,
    type: 'escalation-loot',
    charName: updated.charName,
    charId: 0,
    siteName: updated.name,
    escalationRefId: refId,
  }

  const filteredLogs = logs.filter(
    (l) => !(l.type === 'escalation-loot' && l.escalationRefId === refId)
  )

  return {
    ...data,
    escalations: newEscalations,
    logs: [lootLog, ...filteredLogs],
    lastDataAt: completedAt,
    ...recalcEscalationTotals(newEscalations),
  }
}

export function markEscalationExpired(
  data: EscalationsActivityData,
  refId: string
): EscalationsActivityData | null {
  const escalations = dedupeEscalations(data.escalations || [])
  const idx = escalations.findIndex((e) => e.refId === refId)
  if (idx < 0) return null

  if (escalations[idx].status !== 'active') return data

  const newEscalations = [...escalations]
  newEscalations[idx] = { ...escalations[idx], status: 'expired' }

  return {
    ...data,
    escalations: newEscalations,
    ...recalcEscalationTotals(newEscalations),
  }
}

export function deleteEscalation(
  data: EscalationsActivityData,
  refId: string
): EscalationsActivityData | null {
  const escalations = dedupeEscalations(data.escalations || [])
  if (!escalations.some((e) => e.refId === refId)) return null

  const newEscalations = escalations.filter((e) => e.refId !== refId)
  const newLogs = (data.logs || []).filter(
    (l) => l.refId !== refId && l.escalationRefId !== refId
  )

  return {
    ...data,
    escalations: newEscalations,
    logs: newLogs,
    ...recalcEscalationTotals(newEscalations),
  }
}

export function syncExpiredEscalations(data: EscalationsActivityData): EscalationsActivityData {
  const now = Date.now()
  const escalations = dedupeEscalations(data.escalations || [])
  let changed = false

  const updated = escalations.map((entry) => {
    if (entry.status !== 'active' || !entry.expiresAt) return entry
    if (new Date(entry.expiresAt).getTime() > now) return entry
    changed = true
    return { ...entry, status: 'expired' as const }
  })

  if (!changed) return data

  return {
    ...data,
    escalations: updated,
    ...recalcEscalationTotals(updated),
  }
}

export function countActiveEscalations(data: EscalationsActivityData): number {
  return (data.escalations || []).filter((e) => e.status === 'active').length
}
