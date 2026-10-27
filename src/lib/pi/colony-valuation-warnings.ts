import { exportRateForValuation } from '@/lib/pi/demand-model'
import { highestExportTier, isFinalExportBalance } from '@/lib/pi/export-tiers'
import { selectBalances, type PiRateMode } from '@/lib/pi/rate-mode'
import type { PiColonyAnalysis } from '@/lib/pi/types'

/** True when export revenue uses production rate without a launchpad route. */
export function hasUnroutedProductionValuation(
  colony: PiColonyAnalysis,
  rateMode: PiRateMode
): boolean {
  const balances = selectBalances(colony, rateMode)
  const { exitTypeId, config } = colony
  const highestTier = highestExportTier(balances, exitTypeId)

  for (const balance of balances) {
    const isFinal = isFinalExportBalance(balance, highestTier, exitTypeId)
    const valuationRate = exportRateForValuation(balance, exitTypeId, config.surplusForSale, {
      isFinalTierProduct: isFinal,
    })
    if (valuationRate > 0 && balance.exportedPerHour <= 0 && balance.productionPerHour > 0) {
      return true
    }
  }

  return false
}
