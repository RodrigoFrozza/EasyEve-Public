export type RattingManualEntryType = 'mtu' | 'salvage' | 'loot' | 'escalation' | 'expense'

export type RattingEscalationStatus = 'dropped' | 'sold'

export interface RattingExpenseEntry {
  refId: string
  amount: number
  note?: string
  recordedAt: string
  charName?: string
}

export interface RattingEscalationDrop {
  refId: string
  siteName: string
  dedRating?: string
  faction?: string
  droppedAt: string
  soldValue?: number | null
  soldAt?: string | null
  charName?: string
  status: RattingEscalationStatus
}

export interface RattingLootItem {
  name: string
  quantity: number
  value?: number
  typeId?: number
  unitPrice?: number
  totalValue?: number
  source?: string
}

export interface RattingLogEntry {
  refId?: string
  date: string
  amount?: number
  type: string
  charName?: string
  charId?: number
  /** ESI / wallet-sync alias for charId */
  characterId?: number
  /** ESI / wallet-sync alias for charName */
  characterName?: string
  items?: RattingLootItem[]
  contentIndex?: number
  dateFormatted?: string
  [key: string]: unknown
}

export interface RattingActivityData {
  logs?: RattingLogEntry[]
  mtuContents?: RattingLootItem[][]
  salvageContents?: RattingLootItem[][]
  estimatedLootValue?: number
  estimatedSalvageValue?: number
  escalationDrops?: RattingEscalationDrop[]
  estimatedEscalationValue?: number
  sessionExpenses?: RattingExpenseEntry[]
  estimatedExpenseValue?: number
  npcFaction?: string
  [key: string]: unknown
}

function newRefId(prefix: RattingManualEntryType | 'escalation'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function dedupeRattingExpenses(
  expenses: RattingExpenseEntry[]
): RattingExpenseEntry[] {
  const seen = new Set<string>()
  return expenses.filter((entry) => {
    const refId = entry.refId?.trim()
    if (!refId || seen.has(refId)) return false
    seen.add(refId)
    return true
  })
}

export function recalcExpenseTotals(expenses: RattingExpenseEntry[]): {
  estimatedExpenseValue: number
} {
  const estimatedExpenseValue = expenses.reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0
  )
  return { estimatedExpenseValue }
}

export interface AppendRattingExpenseInput {
  amount: number
  note?: string
  charName?: string
  recordedAt?: string
}

export function appendRattingExpense(
  data: RattingActivityData,
  input: AppendRattingExpenseInput
): RattingActivityData {
  const expenses = dedupeRattingExpenses([...(data.sessionExpenses || [])])
  const logs = data.logs || []
  const recordedAt = input.recordedAt || new Date().toISOString()
  const refId = newRefId('expense')
  const amount = Number(input.amount) || 0
  const note = input.note?.trim()

  const expense: RattingExpenseEntry = {
    refId,
    amount,
    note: note || undefined,
    recordedAt,
    charName: input.charName,
  }

  expenses.unshift(expense)

  const newLog: RattingLogEntry = {
    refId,
    date: recordedAt,
    amount,
    type: 'expense',
    charName: input.charName,
    charId: 0,
    note: expense.note,
  }

  return {
    ...data,
    sessionExpenses: expenses,
    logs: [newLog, ...logs],
    ...recalcExpenseTotals(expenses),
  }
}

export function deleteRattingExpense(
  data: RattingActivityData,
  refId: string
): RattingActivityData | null {
  const expenses = dedupeRattingExpenses(data.sessionExpenses || [])
  if (!expenses.some((entry) => entry.refId === refId)) return null

  const newExpenses = expenses.filter((entry) => entry.refId !== refId)
  const newLogs = (data.logs || []).filter(
    (log) => !(log.refId === refId && log.type === 'expense')
  )

  return {
    ...data,
    sessionExpenses: newExpenses,
    logs: newLogs,
    ...recalcExpenseTotals(newExpenses),
  }
}

export function dedupeEscalationDrops(
  drops: RattingEscalationDrop[]
): RattingEscalationDrop[] {
  const seen = new Set<string>()
  return drops.filter((drop) => {
    const refId = drop.refId?.trim()
    if (!refId || seen.has(refId)) return false
    seen.add(refId)
    return true
  })
}

export function recalcEscalationTotals(drops: RattingEscalationDrop[]): {
  estimatedEscalationValue: number
} {
  const estimatedEscalationValue = drops
    .filter((d) => d.status === 'sold')
    .reduce((sum, d) => sum + (Number(d.soldValue) || 0), 0)
  return { estimatedEscalationValue }
}

export interface AppendEscalationDropInput {
  siteName: string
  dedRating?: string
  faction?: string
  charName?: string
}

export function appendEscalationDrop(
  data: RattingActivityData,
  input: AppendEscalationDropInput
): RattingActivityData {
  const drops = dedupeEscalationDrops([...(data.escalationDrops || [])])
  const logs = data.logs || []
  const droppedAt = new Date().toISOString()
  const refId = newRefId('escalation')

  const drop: RattingEscalationDrop = {
    refId,
    siteName: input.siteName.trim(),
    dedRating: input.dedRating,
    faction: input.faction,
    droppedAt,
    soldValue: null,
    soldAt: null,
    charName: input.charName,
    status: 'dropped',
  }

  drops.unshift(drop)

  const newLog: RattingLogEntry = {
    refId,
    date: droppedAt,
    amount: 0,
    type: 'escalation',
    charName: input.charName,
    charId: 0,
    siteName: drop.siteName,
    dedRating: drop.dedRating,
    escalationStatus: 'dropped',
  }

  const escalationTotals = recalcEscalationTotals(drops)

  return {
    ...data,
    escalationDrops: drops,
    logs: [newLog, ...logs],
    ...escalationTotals,
  }
}

export function markEscalationSold(
  data: RattingActivityData,
  refId: string,
  soldValue: number,
  soldAt?: string
): RattingActivityData | null {
  const drops = dedupeEscalationDrops(data.escalationDrops || [])
  const idx = drops.findIndex((d) => d.refId === refId)
  if (idx < 0) return null

  const saleInstant = soldAt || new Date().toISOString()
  const updatedDrop: RattingEscalationDrop = {
    ...drops[idx],
    soldValue,
    soldAt: saleInstant,
    status: 'sold',
  }

  const newDrops = [...drops]
  newDrops[idx] = updatedDrop

  const logs = (data.logs || []).map((log) => {
    if (log.refId !== refId || log.type !== 'escalation') return log
    return {
      ...log,
      amount: soldValue,
      date: saleInstant,
      escalationStatus: 'sold',
    }
  })

  return {
    ...data,
    escalationDrops: newDrops,
    logs,
    ...recalcEscalationTotals(newDrops),
  }
}

export function deleteEscalationDrop(
  data: RattingActivityData,
  refId: string
): RattingActivityData | null {
  const drops = dedupeEscalationDrops(data.escalationDrops || [])
  if (!drops.some((d) => d.refId === refId)) return null

  const newDrops = drops.filter((d) => d.refId !== refId)
  const newLogs = (data.logs || []).filter(
    (l) => !(l.refId === refId && l.type === 'escalation')
  )

  return {
    ...data,
    escalationDrops: newDrops,
    logs: newLogs,
    ...recalcEscalationTotals(newDrops),
  }
}

export function recalcRattingLootTotals(logs: RattingLogEntry[]): {
  estimatedLootValue: number
  estimatedSalvageValue: number
} {
  const estimatedLootValue = logs
    .filter((l) => l.type === 'mtu' || l.type === 'loot' || l.type === 'loot-auto')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

  const estimatedSalvageValue = logs
    .filter((l) => l.type === 'salvage')
    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

  return { estimatedLootValue, estimatedSalvageValue }
}

export function appendMtuEntry(
  data: RattingActivityData,
  itemsWithPrices: RattingLootItem[],
  charName: string
): RattingActivityData {
  const logs = data.logs || []
  const mtuContents = [...(data.mtuContents || []), itemsWithPrices]
  const contentIndex = mtuContents.length - 1
  const totalValue = itemsWithPrices.reduce(
    (sum, item) => sum + (Number(item.totalValue) || 0),
    0
  )
  const timestamp = new Date().toISOString()
  const newLog: RattingLogEntry = {
    refId: newRefId('mtu'),
    date: timestamp,
    amount: totalValue,
    type: 'mtu',
    charName,
    charId: 0,
    contentIndex,
  }
  const newLogs = [newLog, ...logs]
  const totals = recalcRattingLootTotals(newLogs)

  return {
    ...data,
    mtuContents,
    logs: newLogs,
    ...totals,
  }
}

export function appendSalvageEntry(
  data: RattingActivityData,
  itemsWithPrices: RattingLootItem[],
  charName: string
): RattingActivityData {
  const logs = data.logs || []
  const salvageContents = [...(data.salvageContents || []), itemsWithPrices]
  const contentIndex = salvageContents.length - 1
  const totalValue = itemsWithPrices.reduce(
    (sum, item) => sum + (Number(item.totalValue) || 0),
    0
  )
  const timestamp = new Date().toISOString()
  const newLog: RattingLogEntry = {
    refId: newRefId('salvage'),
    date: timestamp,
    dateFormatted: timestamp,
    amount: totalValue,
    type: 'salvage',
    charName,
    charId: 0,
    contentIndex,
  }
  const newLogs = [newLog, ...logs]
  const totals = recalcRattingLootTotals(newLogs)

  return {
    ...data,
    salvageContents,
    logs: newLogs,
    ...totals,
  }
}

export function appendManualLootEntry(
  data: RattingActivityData,
  items: RattingLootItem[],
  amount: number,
  charName: string
): RattingActivityData {
  const logs = data.logs || []
  const newLog: RattingLogEntry = {
    refId: newRefId('loot'),
    date: new Date().toISOString(),
    amount,
    type: 'loot',
    charName,
    charId: 0,
    items,
  }
  const newLogs = [newLog, ...logs]
  const totals = recalcRattingLootTotals(newLogs)

  return {
    ...data,
    logs: newLogs,
    ...totals,
  }
}

export function resolveRattingContentIndex(
  log: RattingLogEntry,
  logs: RattingLogEntry[],
  type: 'mtu' | 'salvage'
): number {
  if (typeof log.contentIndex === 'number' && log.contentIndex >= 0) {
    return log.contentIndex
  }
  const typedLogs = logs.filter((l) => l.type === type)
  return typedLogs.findIndex((l) => l.refId === log.refId)
}

export function resolveRattingEntryItems(
  data: RattingActivityData,
  entry: RattingLogEntry
): RattingLootItem[] {
  if (Array.isArray(entry.items) && entry.items.length > 0) {
    return entry.items
  }

  const logs = data.logs || []
  if (entry.type === 'mtu') {
    const idx = resolveRattingContentIndex(entry, logs, 'mtu')
    return idx >= 0 ? data.mtuContents?.[idx] || [] : []
  }
  if (entry.type === 'salvage') {
    const idx = resolveRattingContentIndex(entry, logs, 'salvage')
    return idx >= 0 ? data.salvageContents?.[idx] || [] : []
  }

  return []
}

export function deleteManualEntry(
  data: RattingActivityData,
  refId: string,
  type: RattingManualEntryType
): RattingActivityData | null {
  const logs = data.logs || []
  const log = logs.find((l) => l.refId === refId && l.type === type)
  if (!log) return null

  const newLogs = logs.filter((l) => l.refId !== refId)

  let mtuContents = [...(data.mtuContents || [])]
  let salvageContents = [...(data.salvageContents || [])]

  if (type === 'mtu') {
    const idx = resolveRattingContentIndex(log, logs, 'mtu')
    if (idx >= 0) mtuContents.splice(idx, 1)
  } else if (type === 'salvage') {
    const idx = resolveRattingContentIndex(log, logs, 'salvage')
    if (idx >= 0) salvageContents.splice(idx, 1)
  }

  const totals = recalcRattingLootTotals(newLogs)

  return {
    ...data,
    logs: newLogs,
    mtuContents,
    salvageContents,
    ...totals,
  }
}

export function isDeletableManualRattingLog(type: string): boolean {
  return type === 'loot' || type === 'mtu' || type === 'salvage' || type === 'escalation' || type === 'expense'
}
