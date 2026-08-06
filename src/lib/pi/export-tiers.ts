import { getCommodityTier } from '@/lib/pi/commodity-tier'
import { exportRateForValuation, type PiCommodityBalance } from '@/lib/pi/demand-model'
import type { PiColonyAnalysis } from '@/lib/pi/types'

// These helpers describe a single colony's export tiers and its import/export/
// surplus pins. They used to live in network-editor.ts but are not about
// networks at all — the production graph, pricing and valuation warnings depend
// on them, so they outlive the networks feature.

export type PlanetPinKind = 'import' | 'export' | 'surplus'

export interface PlanetPin {
  kind: PlanetPinKind
  typeId: number
  name: string
  tier?: PiCommodityBalance['tier']
  unitsPerHour: number
}

function pinTier(balance: PiCommodityBalance): PiCommodityBalance['tier'] | undefined {
  return getCommodityTier(balance.typeId) ?? balance.tier
}

function tierRank(balance: PiCommodityBalance): number {
  return pinTier(balance) ?? -1
}

/** Highest tier among exportable commodities this planet produces or ships out. */
export function highestExportTier(
  balances: PiCommodityBalance[],
  exitTypeId: number | undefined
): number {
  if (exitTypeId != null) {
    const exitTier = getCommodityTier(exitTypeId)
    if (exitTier != null) return exitTier
  }

  let max = -1
  for (const balance of balances) {
    if (!balance.isExportable) continue
    if (balance.productionPerHour <= 0 && balance.exportedPerHour <= 0) continue
    max = Math.max(max, tierRank(balance))
  }
  return max
}

export function isFinalExportBalance(
  balance: PiCommodityBalance,
  highestTier: number,
  exitTypeId: number | undefined
): boolean {
  if (!balance.isExportable) return false

  if (exitTypeId != null && balance.typeId === exitTypeId) return true
  if (highestTier < 0) return false
  return tierRank(balance) === highestTier
}

/** Extraction / supply above factory demand — never waste or the same typeId as export. */
function surplusRateForBalance(
  balance: PiCommodityBalance,
  exitTypeId: number | undefined,
  isFinalExport: boolean
): number {
  if (isFinalExport) return 0
  if (balance.isExportable && balance.exportedPerHour > 0) {
    return Math.max(0, balance.surplusPerHour - balance.exportedPerHour)
  }
  if (balance.surplusPerHour > 0) return balance.surplusPerHour
  return 0
}

export function buildPlanetPins(
  colony: PiColonyAnalysis,
  mode: 'potential' | 'current' = 'potential'
): PlanetPin[] {
  const balances = mode === 'potential' ? colony.balances.potential : colony.balances.current
  const highestTier = highestExportTier(balances, colony.exitTypeId)
  const pins: PlanetPin[] = []
  const exportTypeIds = new Set<number>()

  for (const balance of balances) {
    if (balance.importNeededPerHour <= 0) continue
    pins.push({
      kind: 'import',
      typeId: balance.typeId,
      name: balance.name,
      tier: pinTier(balance),
      unitsPerHour: balance.importNeededPerHour,
    })
  }

  for (const balance of balances) {
    if (!isFinalExportBalance(balance, highestTier, colony.exitTypeId)) continue
    const rate = exportRateForValuation(
      balance,
      colony.exitTypeId,
      colony.config.surplusForSale,
      { isFinalTierProduct: true }
    )
    if (rate <= 0) continue
    exportTypeIds.add(balance.typeId)
    pins.push({
      kind: 'export',
      typeId: balance.typeId,
      name: balance.name,
      tier: pinTier(balance),
      unitsPerHour: rate,
    })
  }

  for (const balance of balances) {
    if (exportTypeIds.has(balance.typeId)) continue
    const isFinal = isFinalExportBalance(balance, highestTier, colony.exitTypeId)
    const rate = surplusRateForBalance(balance, colony.exitTypeId, isFinal)
    if (rate <= 0) continue
    pins.push({
      kind: 'surplus',
      typeId: balance.typeId,
      name: balance.name,
      tier: pinTier(balance),
      unitsPerHour: rate,
    })
  }

  return pins
}
