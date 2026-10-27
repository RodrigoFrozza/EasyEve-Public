import type { PiColonyAnalysis } from '@/lib/pi/types'

export type PiRateMode = 'potential' | 'current'

export function colonyNetIskPerHour(
  colony: PiColonyAnalysis,
  mode: PiRateMode
): number {
  return mode === 'potential'
    ? colony.potentialNetIskPerHour
    : colony.currentNetIskPerHour
}

export function colonyExportRevenuePerHour(
  colony: PiColonyAnalysis,
  mode: PiRateMode
): number {
  return mode === 'potential'
    ? colony.potentialExportRevenuePerHour
    : colony.currentExportRevenuePerHour
}

export function colonyImportCostPerHour(
  colony: PiColonyAnalysis,
  mode: PiRateMode
): number {
  return mode === 'potential'
    ? colony.potentialImportCostPerHour
    : colony.currentImportCostPerHour
}

export function colonyExportTaxPerHour(colony: PiColonyAnalysis, mode: PiRateMode): number {
  return (
    (mode === 'potential' ? colony.potentialExportTaxPerHour : colony.currentExportTaxPerHour) ?? 0
  )
}

export function colonyExportGrossPerHour(colony: PiColonyAnalysis, mode: PiRateMode): number {
  return (
    (mode === 'potential' ? colony.potentialExportGrossPerHour : colony.currentExportGrossPerHour) ??
    0
  )
}

export function selectBalances(colony: PiColonyAnalysis, mode: PiRateMode) {
  return mode === 'potential' ? colony.balances.potential : colony.balances.current
}
