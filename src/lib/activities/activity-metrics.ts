import { isAbyssalRunCompleted } from '@/lib/activities/abyssal-metrics'

type AnyRecord = Record<string, unknown> | null | undefined

const toNumber = (value: unknown): number => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export interface ActivityFinancialMetrics {
  gross: number
  net: number
  taxes: number
  bounties: number
  ess: number
  additionalBounties: number
  loot: number
  salvage: number
  escalations: number
  expenses: number
  miningValue: number
  totalLootValue: number
}

export function getActivityFinancialMetrics(activity: { type?: string; data?: AnyRecord }): ActivityFinancialMetrics {
  const type = activity.type || ''
  const data = activity.data || {}

  const bounties = toNumber((data as AnyRecord)?.automatedBounties)
  const ess = toNumber((data as AnyRecord)?.automatedEss)
  const additionalBounties = toNumber((data as AnyRecord)?.additionalBounties)
  const taxes = toNumber((data as AnyRecord)?.automatedTaxes)
  const loot = toNumber((data as AnyRecord)?.estimatedLootValue)
  const salvage = toNumber((data as AnyRecord)?.estimatedSalvageValue)
  const escalations =
    type === 'escalations'
      ? toNumber((data as AnyRecord)?.estimatedEscalationLootValue)
      : toNumber((data as AnyRecord)?.estimatedEscalationValue)
  const escCost =
    type === 'escalations' ? toNumber((data as AnyRecord)?.estimatedEscalationCostValue) : 0
  const expenses = toNumber((data as AnyRecord)?.estimatedExpenseValue)
  
  const runs = (data as AnyRecord)?.runs as
    | Array<{ lootValue?: number; status?: string; registrationStatus?: string }>
    | undefined
  const logs = (data as AnyRecord)?.logs as Array<{ amount?: number; value?: number }> | undefined

  const logIncomeTotal =
    logs?.reduce(
      (sum: number, log) => sum + Math.max(toNumber(log.amount), toNumber(log.value)),
      0
    ) || 0

  const hasRuns = Array.isArray(runs) && runs.length > 0
  // Only completed runs count toward gross — an in-progress or `death` run's lootValue
  // (loot that was never actually banked) must not inflate gross/the discard-check
  // above what the KPI panel (which already filters by isAbyssalRunCompleted) shows.
  const runsSum = hasRuns
    ? runs
        .filter(isAbyssalRunCompleted)
        .reduce((sum: number, run) => sum + toNumber(run.lootValue), 0)
    : null
  const totalLootValue =
    runsSum !== null
      ? runsSum
      : toNumber((data as AnyRecord)?.totalLootValue) ||
        toNumber((data as AnyRecord)?.lootValue) ||
        logIncomeTotal
  
  const miningValue = toNumber((data as AnyRecord)?.miningValue)
    || toNumber((data as AnyRecord)?.totalEstimatedValue)
    || toNumber((data as AnyRecord)?.totalValue)

  const grossBounty = toNumber((data as AnyRecord)?.grossBounties) || (bounties + ess + additionalBounties)

  const rattingNonBountyIncome = loot + salvage + escalations
  const netBountyAfterTax = Math.max(0, grossBounty - taxes)

  let gross = 0
  let net = 0

  if (type === 'ratting') {
    gross = grossBounty + rattingNonBountyIncome
    net = netBountyAfterTax + rattingNonBountyIncome - expenses
  } else if (type === 'escalations') {
    gross = grossBounty + escalations
    net = netBountyAfterTax + escalations - escCost
  } else if (type === 'mining') {
    gross = miningValue
    net = miningValue
  } else if (type === 'exploration' || type === 'abyssal' || type === 'salvaging') {
    gross = totalLootValue
    net = totalLootValue
  } else {
    // Generic fallback for historical/unknown activity types.
    const nonBountyIncome = loot + salvage + miningValue + totalLootValue
    gross = grossBounty + nonBountyIncome
    net = netBountyAfterTax + nonBountyIncome
  }

  return {
    gross,
    net,
    taxes,
    bounties,
    ess,
    additionalBounties,
    loot,
    salvage,
    escalations,
    expenses,
    miningValue,
    totalLootValue,
  }
}
