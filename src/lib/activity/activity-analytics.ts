import type { ActivityType } from '@/lib/constants/activity-colors'
import { ACTIVITY_COLORS } from '@/lib/constants/activity-colors'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { isAbyssalRunCompleted } from '@/lib/activities/abyssal-metrics'
import { isSalvagingIncomeLog } from '@/lib/activities/salvaging-data-recalc'

export type AnalyticsLogEntry = {
  date: string
  amount?: number
  value?: number
  type?: string
  charId?: number
  characterId?: number
  charName?: string
  characterName?: string
  typeId?: number | string
  spaceType?: string
  [key: string]: unknown
}

export type AbyssalRunEntry = {
  id: string
  startTime: string
  endTime?: string
  status?: string
  registrationStatus?: string
  tier?: string
  weather?: string
  ship?: string
  lootValue?: number
}

export type TimelinePoint = {
  date: string
  timestamp: number
  value: number
  cumulative: number
  iskPerHour: number
  progressPct: number
  formattedTime: string
}

export type CharacterBreakdownRow = {
  id: string
  name: string
  total: number
  iskPerHour: number
  volume?: number
}

export type CompositionSlice = {
  label: string
  labelKey?: string
  value: number
  pct: number
  color: string
  kind?: 'income' | 'deduction'
}

/** Distinct chart/composition colors — avoids monochrome red-on-red in ratting analytics.
 *  `gross` uses a blue hue (not another red/pink) so it stays visually distinct from
 *  `bounty`/`expense`, which previously shared nearly the same rose tone (~1.5:1 contrast). */
export const RATTING_ANALYTICS_COLORS = {
  bounty: '#f43f5e',
  ess: '#fb923c',
  loot: '#fbbf24',
  escalation: '#34d399',
  expense: '#f87171',
  gross: '#38bdf8',
  net: '#f8fafc',
} as const

export type SparklineDataset = {
  label: string
  data: number[]
  color: string
  strokeWidth?: number
}

const toNumber = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type AnalyticsActivitySession = {
  startTime: string | Date
  endTime?: string | Date | null
  status?: string
  accumulatedPausedTime?: number
  isPaused?: boolean
  pausedAt?: string | Date | null
}

export function getSessionBounds(activity: AnalyticsActivitySession) {
  const start = new Date(activity.startTime).getTime()
  const durationMs = getActivityDurationMs({
    startTime: activity.startTime,
    endTime: activity.endTime,
    status: activity.status,
    accumulatedPausedTime: activity.accumulatedPausedTime,
    isPaused: activity.isPaused,
    pausedAt: activity.pausedAt,
  })

  let end: number
  if (activity.status === 'completed' && activity.endTime) {
    end = new Date(activity.endTime).getTime()
  } else if (activity.isPaused && activity.pausedAt) {
    end = new Date(activity.pausedAt).getTime()
  } else {
    end = Date.now()
  }

  const hours = Math.max(0.01, durationMs / 3600000)
  return { start, end, durationMs, hours }
}

export function getLogValue(log: AnalyticsLogEntry, activityType: ActivityType): number {
  if (activityType === 'mining') {
    return toNumber(log.estimatedValue ?? log.value ?? log.amount)
  }
  return toNumber(log.value ?? log.amount)
}

export function getCharacterKey(log: AnalyticsLogEntry): string {
  return `${log.characterId ?? log.charId ?? 0}`
}

export function getCharacterName(log: AnalyticsLogEntry): string {
  return (log.characterName as string) || (log.charName as string) || 'Unknown'
}

/** Cumulative timeline aligned with session start (for chart hover + sparkline) */
export function buildSessionTimeline(
  activity: AnalyticsActivitySession,
  logs: AnalyticsLogEntry[],
  activityType: ActivityType,
  getValue?: (log: AnalyticsLogEntry) => number
): TimelinePoint[] {
  const { start, durationMs } = getSessionBounds(activity)
  const totalDuration = Math.max(1, durationMs)
  const valueFn = getValue ?? ((log) => getLogValue(log, activityType))

  const ordered = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  let cumulative = 0
  return ordered.map((log) => {
    const ts = new Date(log.date).getTime()
    const value = valueFn(log)
    cumulative += value
    const elapsed = Math.max(0, ts - start)
    const hoursSinceStart = Math.max(0.01, elapsed / 3600000)
    const d = new Date(log.date)
    return {
      date: log.date,
      timestamp: ts,
      value,
      cumulative,
      iskPerHour: cumulative / hoursSinceStart,
      progressPct: (elapsed / totalDuration) * 100,
      formattedTime: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  })
}

export function buildSparklineDatasets(
  points: TimelinePoint[],
  series: { label: string; color: string; getAccumulated: (idx: number) => number }[]
): SparklineDataset[] {
  if (points.length < 2) return []
  return series.map((s) => ({
    label: s.label,
    data: points.map((_, idx) => s.getAccumulated(idx)),
    color: s.color,
  }))
}

export function buildCharacterBreakdown(
  activity: AnalyticsActivitySession,
  logs: AnalyticsLogEntry[],
  activityType: ActivityType,
  options?: {
    getVolume?: (log: AnalyticsLogEntry) => number
    getValue?: (log: AnalyticsLogEntry) => number
  }
): CharacterBreakdownRow[] {
  const { hours } = getSessionBounds(activity)
  const map = new Map<string, { name: string; total: number; volume: number }>()
  const valueFn =
    options?.getValue ?? ((log) => getLogValue(log, activityType))

  for (const log of logs) {
    const id = getCharacterKey(log)
    const cur = map.get(id) || { name: getCharacterName(log), total: 0, volume: 0 }
    cur.total += valueFn(log)
    if (options?.getVolume) {
      cur.volume += options.getVolume(log)
    }
    map.set(id, cur)
  }

  return Array.from(map.entries())
    .map(([id, v]) => ({
      id,
      name: v.name,
      total: v.total,
      volume: v.volume,
      iskPerHour: v.total / hours,
    }))
    .sort((a, b) => b.total - a.total)
}

export function buildCharacterBreakdownFromParticipantData(
  activity: AnalyticsActivitySession,
  participantBreakdown: Record<string, { characterName?: string; estimatedValue?: number; volumeValue?: number }>
): CharacterBreakdownRow[] {
  const { hours } = getSessionBounds(activity)
  return Object.entries(participantBreakdown)
    .map(([id, row]) => ({
      id,
      name: row.characterName || 'Unknown',
      total: toNumber(row.estimatedValue),
      volume: toNumber(row.volumeValue),
      iskPerHour: toNumber(row.estimatedValue) / hours,
    }))
    .sort((a, b) => b.total - a.total)
}

export function normalizeRattingLogType(
  type?: string
): 'bounty' | 'ess' | 'loot' | 'escalation' | 'expense' | 'other' {
  if (type === 'bounty' || type === 'ess') return type
  if (type === 'escalation') return 'escalation'
  if (type === 'expense') return 'expense'
  if (type === 'loot' || type === 'salvage' || type === 'mtu' || type === 'loot-auto') return 'loot'
  return 'other'
}

export function getRattingLogSignedValue(log: AnalyticsLogEntry): number {
  const t = normalizeRattingLogType(log.type)
  const amount = toNumber(log.amount)
  if (t === 'expense') return -Math.abs(amount)
  if (t === 'escalation') {
    const status = (log.escalationStatus as string) || ''
    if (status === 'dropped' || amount <= 0) return 0
    return amount
  }
  if (t === 'other') return 0
  return amount
}

export function buildRattingComposition(logs: AnalyticsLogEntry[]): CompositionSlice[] {
  const sums = { bounty: 0, ess: 0, loot: 0, escalation: 0, expense: 0 }
  for (const log of logs) {
    const t = normalizeRattingLogType(log.type)
    if (t === 'bounty') sums.bounty += toNumber(log.amount)
    else if (t === 'ess') sums.ess += toNumber(log.amount)
    else if (t === 'loot') sums.loot += toNumber(log.amount)
    else if (t === 'escalation') sums.escalation += getRattingLogSignedValue(log)
    else if (t === 'expense') sums.expense += Math.abs(toNumber(log.amount))
  }

  const grossIncome = sums.bounty + sums.ess + sums.loot + sums.escalation
  const colors = RATTING_ANALYTICS_COLORS

  const incomeSlices: CompositionSlice[] = [
    { label: 'Bounty', labelKey: 'chartBounty', value: sums.bounty, color: colors.bounty, kind: 'income' as const },
    { label: 'ESS', labelKey: 'chartEss', value: sums.ess, color: colors.ess, kind: 'income' as const },
    { label: 'Loot', labelKey: 'chartLoot', value: sums.loot, color: colors.loot, kind: 'income' as const },
    {
      label: 'DED',
      labelKey: 'chartEscalation',
      value: sums.escalation,
      color: colors.escalation,
      kind: 'income' as const,
    },
  ]
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, pct: grossIncome > 0 ? (s.value / grossIncome) * 100 : 0 }))

  const deductionSlices: CompositionSlice[] =
    sums.expense > 0
      ? [
          {
            label: 'Expenses',
            labelKey: 'chartExpense',
            value: sums.expense,
            pct: grossIncome > 0 ? (sums.expense / grossIncome) * 100 : 100,
            color: colors.expense,
            kind: 'deduction' as const,
          },
        ]
      : []

  return [...incomeSlices, ...deductionSlices]
}

export function buildExplorationComposition(logs: AnalyticsLogEntry[]): CompositionSlice[] {
  const sums = { relic: 0, data: 0, ghost: 0, sleeper: 0, other: 0 }
  for (const log of logs) {
    const spaceType = (log.spaceType as string)?.toLowerCase() || ''
    const val = toNumber(log.value ?? log.amount)
    if (spaceType.includes('relic')) sums.relic += val
    else if (spaceType.includes('data')) sums.data += val
    else if (spaceType.includes('ghost')) sums.ghost += val
    else if (spaceType.includes('sleeper')) sums.sleeper += val
    else sums.other += val
  }
  const total = Object.values(sums).reduce((a, b) => a + b, 0)
  const palette = ACTIVITY_COLORS.exploration
  return [
    { label: 'Relic', value: sums.relic, color: palette.sparkline },
    { label: 'Data', value: sums.data, color: '#fb923c' },
    { label: 'Ghost / Sleeper', value: sums.ghost + sums.sleeper, color: '#fbbf24' },
    { label: 'Other', value: sums.other, color: '#a8a29e' },
  ]
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, pct: total > 0 ? (s.value / total) * 100 : 0 }))
}

export function buildMiningOreBreakdown(
  oreBreakdown: Record<string, { name?: string; estimatedValue?: number; quantity?: number; volumeValue?: number }>
): { typeId: string; name: string; isk: number; qty: number; vol: number }[] {
  return Object.entries(oreBreakdown)
    .map(([typeId, row]) => ({
      typeId,
      name: row.name || `Type ${typeId}`,
      isk: toNumber(row.estimatedValue),
      qty: toNumber(row.quantity),
      vol: toNumber(row.volumeValue),
    }))
    .sort((a, b) => b.isk - a.isk)
}

export function buildMiningComposition(
  ores: { name: string; isk: number }[]
): CompositionSlice[] {
  const total = ores.reduce((s, o) => s + o.isk, 0)
  const base = ACTIVITY_COLORS.mining.sparkline
  const variants = ['#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#134e4a']
  return ores.slice(0, 8).map((o, idx) => ({
    label: o.name,
    value: o.isk,
    pct: total > 0 ? (o.isk / total) * 100 : 0,
    color: variants[idx % variants.length] ?? base,
  }))
}

export function buildRattingTimelines(logs: AnalyticsLogEntry[]): {
  bounty: number[]
  ess: number[]
  loot: number[]
  escalation: number[]
  expense: number[]
  gross: number[]
  net: number[]
} {
  const ordered = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  let accBounty = 0
  let accEss = 0
  let accLoot = 0
  let accEscalation = 0
  let accExpense = 0
  const bounty: number[] = []
  const ess: number[] = []
  const loot: number[] = []
  const escalation: number[] = []
  const expense: number[] = []
  const gross: number[] = []
  const net: number[] = []

  for (const entry of ordered) {
    const t = normalizeRattingLogType(entry.type)
    const signed = getRattingLogSignedValue(entry)
    if (t === 'bounty') accBounty += signed
    if (t === 'ess') accEss += signed
    if (t === 'loot') accLoot += signed
    if (t === 'escalation') accEscalation += signed
    if (t === 'expense') accExpense += Math.abs(toNumber(entry.amount))
    const accGross = accBounty + accEss + accLoot + accEscalation
    bounty.push(accBounty)
    ess.push(accEss)
    loot.push(accLoot)
    escalation.push(accEscalation)
    expense.push(accExpense)
    gross.push(accGross)
    net.push(accGross - accExpense)
  }
  return { bounty, ess, loot, escalation, expense, gross, net }
}

export const ESCALATIONS_ANALYTICS_COLORS = {
  bounty: '#fb923c',
  ess: '#fbbf24',
  loot: '#34d399',
  cost: '#f87171',
  net: '#fdba74',
} as const

export function getEscalationsLogSignedValue(log: AnalyticsLogEntry): number {
  const type = (log.type || '').toLowerCase()
  const amount = toNumber(log.amount)
  if (type === 'tax' || type === 'escalation-buy') return amount <= 0 ? amount : -Math.abs(amount)
  if (type === 'bounty' || type === 'ess' || type === 'escalation-loot') return Math.abs(amount)
  return 0
}

export function buildEscalationsComposition(logs: AnalyticsLogEntry[]): CompositionSlice[] {
  const sums = { bounty: 0, ess: 0, loot: 0, cost: 0 }
  for (const log of logs) {
    const type = (log.type || '').toLowerCase()
    const signed = getEscalationsLogSignedValue(log)
    if (type === 'bounty') sums.bounty += signed
    else if (type === 'ess') sums.ess += signed
    else if (type === 'escalation-loot') sums.loot += signed
    // tax must be deducted here too — buildEscalationsTimelines already folds it into
    // its "cost"/net line, so leaving it out here understates the composition's total
    // deduction relative to the net shown right next to it.
    else if (type === 'escalation-buy' || type === 'tax') sums.cost += Math.abs(signed)
  }

  const grossIncome = sums.bounty + sums.ess + sums.loot
  const colors = ESCALATIONS_ANALYTICS_COLORS

  const incomeSlices: CompositionSlice[] = [
    { label: 'Bounty', labelKey: 'chartBounty', value: sums.bounty, color: colors.bounty, kind: 'income' as const },
    { label: 'ESS', labelKey: 'chartEss', value: sums.ess, color: colors.ess, kind: 'income' as const },
    { label: 'Loot', labelKey: 'chartLoot', value: sums.loot, color: colors.loot, kind: 'income' as const },
  ]
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, pct: grossIncome > 0 ? (s.value / grossIncome) * 100 : 0 }))

  const deductionSlices: CompositionSlice[] =
    sums.cost > 0
      ? [
          {
            label: 'Purchases',
            labelKey: 'chartCost',
            value: sums.cost,
            pct: grossIncome > 0 ? (sums.cost / grossIncome) * 100 : 100,
            color: colors.cost,
            kind: 'deduction' as const,
          },
        ]
      : []

  return [...incomeSlices, ...deductionSlices]
}

export function buildEscalationsTimelines(logs: AnalyticsLogEntry[]): {
  bounty: number[]
  ess: number[]
  loot: number[]
  cost: number[]
  net: number[]
} {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  let accBounty = 0
  let accEss = 0
  let accLoot = 0
  let accCost = 0
  const bounty: number[] = []
  const ess: number[] = []
  const loot: number[] = []
  const cost: number[] = []
  const net: number[] = []

  for (const log of sorted) {
    const type = (log.type || '').toLowerCase()
    const signed = getEscalationsLogSignedValue(log)
    if (type === 'bounty') accBounty += signed
    else if (type === 'ess') accEss += signed
    else if (type === 'escalation-loot') accLoot += signed
    else if (type === 'escalation-buy') accCost += Math.abs(signed)
    else if (type === 'tax') accCost += Math.abs(signed)

    bounty.push(accBounty)
    ess.push(accEss)
    loot.push(accLoot)
    cost.push(accCost)
    net.push(accBounty + accEss + accLoot - accCost)
  }

  return { bounty, ess, loot, cost, net }
}

export function buildExplorationTimelines(logs: AnalyticsLogEntry[]): {
  relic: number[]
  data: number[]
  total: number[]
} {
  const ordered = [...logs].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  let accRelic = 0
  let accData = 0
  let accTotal = 0
  const relic: number[] = []
  const data: number[] = []
  const total: number[] = []

  for (const entry of ordered) {
    const spaceType = (entry.spaceType as string)?.toLowerCase() || ''
    const val = toNumber(entry.value ?? entry.amount)
    if (spaceType.includes('relic')) accRelic += val
    if (spaceType.includes('data')) accData += val
    accTotal += val
    relic.push(accRelic)
    data.push(accData)
    total.push(accTotal)
  }
  return { relic, data, total }
}

export function buildAbyssalRunTimeline(
  activity: AnalyticsActivitySession,
  runs: AbyssalRunEntry[]
): TimelinePoint[] {
  const completed = runs.filter(
    (run) => isAbyssalRunCompleted(run) && run.registrationStatus !== 'pending'
  )
  const logs: AnalyticsLogEntry[] = completed.map((r) => ({
    date: r.endTime || r.startTime,
    amount: r.lootValue,
    value: r.lootValue,
  }))
  return buildSessionTimeline(activity, logs, 'abyssal')
}

export function buildAbyssalTierComposition(runs: AbyssalRunEntry[]): CompositionSlice[] {
  const completed = runs.filter(
    (run) =>
      isAbyssalRunCompleted(run) &&
      run.registrationStatus !== 'pending' &&
      (run.lootValue ?? 0) > 0
  )
  const map = new Map<string, number>()
  for (const run of completed) {
    const key = run.tier || 'Unknown'
    map.set(key, (map.get(key) || 0) + toNumber(run.lootValue))
  }
  const total = Array.from(map.values()).reduce((a, b) => a + b, 0)
  const variants = ['#a855f7', '#c084fc', '#e879f9', '#d8b4fe', '#f0abfc']
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], idx) => ({
      label,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
      color: variants[idx % variants.length],
    }))
}

export function getAnalyticsSessionSummary(
  activity: AnalyticsActivitySession & {
    type?: string
    data?: Record<string, unknown>
  },
  options: {
    netProfit: number
    iskPerHour: number
    elapsedFormatted: string
    elapsedMs: number
  }
) {
  const type = (activity.type || 'ratting') as ActivityType
  const metrics = getActivityFinancialMetrics(activity)
  const { hours } = getSessionBounds(activity)
  const data = activity.data || {}

  const base = {
    type,
    iskPerHour: options.iskPerHour,
    netProfit: options.netProfit,
    gross: metrics.gross,
    elapsedFormatted: options.elapsedFormatted,
    elapsedMs: options.elapsedMs,
    hours,
  }

  if (type === 'mining') {
    const qty = toNumber(data.totalQuantity)
    return {
      ...base,
      extra: [
        { key: 'yield', value: qty, format: 'volume' as const },
        { key: 'yieldPerHour', value: qty / hours, format: 'volume' as const },
      ],
    }
  }

  if (type === 'ratting') {
    return {
      ...base,
      extra: [
        {
          key: 'bounty',
          value: toNumber(data.automatedBounties) + toNumber(data.additionalBounties),
          format: 'isk' as const,
        },
        {
          key: 'loot',
          value: toNumber(data.estimatedLootValue) + toNumber(data.estimatedSalvageValue),
          format: 'isk' as const,
        },
        {
          key: 'escalations',
          value: toNumber(data.estimatedEscalationValue),
          format: 'isk' as const,
        },
        {
          key: 'expenses',
          value: toNumber(data.estimatedExpenseValue),
          format: 'isk' as const,
          tone: 'negative' as const,
        },
      ],
    }
  }

  if (type === 'escalations') {
    return {
      ...base,
      extra: [
        {
          key: 'bounty',
          value: toNumber(data.automatedBounties) + toNumber(data.additionalBounties),
          format: 'isk' as const,
        },
        {
          key: 'loot',
          value: toNumber(data.estimatedEscalationLootValue),
          format: 'isk' as const,
        },
        {
          key: 'cost',
          value: toNumber(data.estimatedEscalationCostValue),
          format: 'isk' as const,
          tone: 'negative' as const,
        },
      ],
    }
  }

  if (type === 'exploration') {
    const logs = (data.logs as AnalyticsLogEntry[]) || []
    const sites = logs.filter((l) => l.type === 'site' || l.type === 'loot').length
    return {
      ...base,
      extra: [
        { key: 'sites', value: sites, format: 'number' as const },
        { key: 'lootValue', value: metrics.totalLootValue, format: 'isk' as const },
      ],
    }
  }

  if (type === 'salvaging') {
    const logs = (data.logs as AnalyticsLogEntry[]) || []
    const batches = logs.filter((l) => isSalvagingIncomeLog(l)).length
    return {
      ...base,
      extra: [
        { key: 'batches', value: batches, format: 'number' as const },
        { key: 'lootValue', value: metrics.totalLootValue, format: 'isk' as const },
      ],
    }
  }

  if (type === 'abyssal') {
    const runs = (data.runs as AbyssalRunEntry[]) || []
    const completed = runs.filter(isAbyssalRunCompleted)
    const best = completed.reduce((max, r) => Math.max(max, toNumber(r.lootValue)), 0)
    return {
      ...base,
      extra: [
        { key: 'runs', value: completed.length, format: 'number' as const },
        { key: 'bestRun', value: best, format: 'isk' as const },
      ],
    }
  }

  return { ...base, extra: [] as { key: string; value: number; format: 'isk' | 'number' | 'volume' }[] }
}
