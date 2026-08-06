import type { PiColonyAnalysis } from '@/lib/pi/types'
import type { PiRateMode } from '@/lib/pi/rate-mode'
import {
  colonyExportRevenuePerHour,
  colonyExportTaxPerHour,
  colonyImportCostPerHour,
  colonyNetIskPerHour,
} from '@/lib/pi/rate-mode'
import { exportGrossFromNetRevenue, exportTaxFromNetRevenue } from '@/lib/pi/pi-pricing'

export interface PiFinancialSnapshot {
  exportRevenuePerHour: number
  importCostPerHour: number
  exportTaxPerHour: number
  exportGrossPerHour: number
  netIskPerHour: number
}

// Every colony is an isolated unit — there are no networks to share ISK across
// characters, so the portfolio is a plain sum with no double-count risk.

export function computeCharacterNetIsk(
  colonies: PiColonyAnalysis[],
  characterId: number,
  rateMode: PiRateMode
): number {
  return colonies
    .filter((c) => c.characterId === characterId)
    .reduce((sum, c) => sum + colonyNetIskPerHour(c, rateMode), 0)
}

export function computePortfolioTotals(
  colonies: PiColonyAnalysis[]
): { potentialNetIskPerHour: number; currentNetIskPerHour: number } {
  return {
    potentialNetIskPerHour: colonies.reduce((s, c) => s + c.potentialNetIskPerHour, 0),
    currentNetIskPerHour: colonies.reduce((s, c) => s + c.currentNetIskPerHour, 0),
  }
}

export function computePortfolioFinancialTotals(
  colonies: PiColonyAnalysis[],
  rateMode: PiRateMode
): PiFinancialSnapshot {
  let exportRevenuePerHour = 0
  let importCostPerHour = 0
  let exportTaxPerHour = 0
  let exportGrossPerHour = 0

  for (const colony of colonies) {
    const revenue = colonyExportRevenuePerHour(colony, rateMode)
    const cost = colonyImportCostPerHour(colony, rateMode)
    // Real base-value customs tax carried on the colony; gross = net + tax.
    // Customs is levied on the fixed per-tier base value, so it can NOT be
    // reconstructed from net revenue via the rate (that assumed market-based tax).
    const tax = colonyExportTaxPerHour(colony, rateMode)
    exportRevenuePerHour += revenue
    importCostPerHour += cost
    exportTaxPerHour += tax
    exportGrossPerHour += revenue + tax
  }

  return {
    exportRevenuePerHour,
    importCostPerHour,
    exportTaxPerHour,
    exportGrossPerHour,
    netIskPerHour: exportRevenuePerHour - importCostPerHour,
  }
}

export function financialSnapshotFromParts(
  exportRevenueAfterTax: number,
  importCostPerHour: number,
  exportTaxRate: number
): PiFinancialSnapshot {
  const exportTaxPerHour = exportTaxFromNetRevenue(exportRevenueAfterTax, exportTaxRate)
  const exportGrossPerHour = exportGrossFromNetRevenue(exportRevenueAfterTax, exportTaxRate)
  return {
    exportRevenuePerHour: exportRevenueAfterTax,
    importCostPerHour,
    exportTaxPerHour,
    exportGrossPerHour,
    netIskPerHour: exportRevenueAfterTax - importCostPerHour,
  }
}
