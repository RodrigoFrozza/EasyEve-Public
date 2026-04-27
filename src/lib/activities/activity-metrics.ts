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
  const totalLootValue = toNumber((data as AnyRecord)?.totalLootValue)
  const miningValue = toNumber((data as AnyRecord)?.miningValue)
    || toNumber((data as AnyRecord)?.totalEstimatedValue)
    || toNumber((data as AnyRecord)?.totalValue)

  const grossBounty = toNumber((data as AnyRecord)?.grossBounties) || (bounties + ess + additionalBounties)

  let gross = 0
  let net = 0

  if (type === 'ratting') {
    gross = grossBounty + loot + salvage
    net = gross - taxes
  } else if (type === 'mining') {
    gross = miningValue
    net = miningValue
  } else if (type === 'exploration' || type === 'abyssal') {
    gross = totalLootValue
    net = totalLootValue
  } else {
    // Generic fallback for historical/unknown activity types.
    gross = grossBounty + loot + salvage + miningValue + totalLootValue
    net = gross - taxes
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
    miningValue,
    totalLootValue,
  }
}
