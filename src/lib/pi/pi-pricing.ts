import type { PiCommodityBalance, PriceOrigin } from '@/lib/pi/demand-model'
import { exportRateForValuation } from '@/lib/pi/demand-model'
import { highestExportTier, isFinalExportBalance } from '@/lib/pi/export-tiers'
import { getCommodityName, getCommodityTier } from '@/lib/pi/pi-static-data'
import type { PiColonyAnalysis } from '@/lib/pi/types'

/** Default PI customs-office-style export tax (10%). */
export const DEFAULT_PI_EXPORT_TAX_RATE = 0.1

/**
 * Customs-office / Orbital Skyhook import & export tax is levied on a FIXED
 * per-tier base value, NOT on market price. The value comes from the SDE dogma
 * attributes `export/importTaxMultiplier`, which are constant across every
 * commodity of a tier (e.g. all P4 = 1.200.000). Keyed by PI tier (0=R0 … 4=P4),
 * in ISK per unit.
 *
 * Confirmed in-game 2026-07-21 (UALX-3 Orbital Skyhook, 2% rate):
 *   - Export 1× Nano-Factory (P4) = 24.000 = 1.200.000 × 2%
 *   - Import 1× Fertilizer (P2)   = 72     = 7.200 × 2% × 0,5
 * See docs / Brain "Customs Office (POCO)".
 */
export const PI_CUSTOMS_BASE_VALUE_BY_TIER: Record<number, number> = {
  0: 5,
  1: 400,
  2: 7_200,
  3: 60_000,
  4: 1_200_000,
}

/** Import customs tax is always half the export rate for the same goods. */
export const PI_IMPORT_CUSTOMS_FACTOR = 0.5

/**
 * Customs (POCO/Skyhook) tax in ISK/hour for a flow of `units` of `typeId`.
 * Levied on the fixed per-tier base value × the tax rate; import is halved.
 * Returns 0 when the tier or base value is unknown — never taxes on a guessed
 * value (regra de ouro). NOTE: material buy/sell stays at market price; only
 * this customs component uses the base value.
 */
export function customsTaxPerHour(
  units: number,
  typeId: number,
  taxRate: number,
  opts: { isImport?: boolean } = {}
): number {
  if (units <= 0 || taxRate <= 0) return 0
  const tier = getCommodityTier(typeId)
  if (tier == null) return 0
  const base = PI_CUSTOMS_BASE_VALUE_BY_TIER[tier]
  if (!base) return 0
  const factor = opts.isImport ? PI_IMPORT_CUSTOMS_FACTOR : 1
  return units * base * taxRate * factor
}

export interface PiMarketPrice {
  buy: number
  sell: number
  /**
   * Volume-weighted instant-execution prices for the portfolio's total quantity,
   * used by the pessimistic (instant-market) mode. weightedAsk = avg unit price
   * to BUY the total demand by walking sell orders; weightedBid = avg to SELL the
   * total supply into buy orders. Optimistic (limit-order) mode ignores these and
   * uses top-of-book, since a patient order doesn't walk the book.
   */
  weightedAsk?: number
  weightedBid?: number
}

export type PiPriceMap = Record<number, PiMarketPrice>

export type PiPricingMode =
  | 'import_buy_export_sell'
  | 'mid_price'
  | 'pessimistic'
  | 'realistic'

export const DEFAULT_PI_PRICING_MODE: PiPricingMode = 'import_buy_export_sell'

export interface PiPricingOptions {
  exportTaxRate?: number
  /** POCO import tax applied to bought inputs. Defaults to exportTaxRate when unset. */
  importTaxRate?: number
  pricingMode?: PiPricingMode
  /** Per-type price origin (buy/sell) so rows can show live vs reference source. */
  provenance?: Record<number, { buy: PriceOrigin; sell: PriceOrigin }>
}

export function importUnitPrice(
  prices: PiPriceMap,
  typeId: number,
  mode: PiPricingMode = DEFAULT_PI_PRICING_MODE
): number {
  const price = prices[typeId]
  if (!price) return 0
  switch (mode) {
    case 'import_buy_export_sell':
      return price.buy
    case 'mid_price':
      return (price.buy + price.sell) / 2
    case 'pessimistic':
      return price.weightedAsk ?? price.sell
    case 'realistic':
      // Real cost of a multibuy: walk the ask book (weightedAsk), same as
      // pessimistic on the import side. Falls back to top-of-book sell.
      return price.weightedAsk ?? price.sell
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function exportUnitPrice(
  prices: PiPriceMap,
  typeId: number,
  mode: PiPricingMode = DEFAULT_PI_PRICING_MODE
): number {
  const price = prices[typeId]
  if (!price) return 0
  switch (mode) {
    case 'import_buy_export_sell':
      return price.sell
    case 'mid_price':
      return (price.buy + price.sell) / 2
    case 'pessimistic':
      return price.weightedBid ?? price.buy
    case 'realistic':
      // Respect the configured sell source (composePriceMap already resolved
      // `sell` per piSellSource, incl. jita_split). Differs from pessimistic,
      // which assumes an instant dump into the bids (weightedBid).
      return price.sell
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function exportRevenueAfterTax(
  unitsPerHour: number,
  sellPrice: number,
  exportTaxRate = DEFAULT_PI_EXPORT_TAX_RATE
): number {
  if (unitsPerHour <= 0 || sellPrice <= 0) return 0
  return unitsPerHour * sellPrice * (1 - exportTaxRate)
}

export function exportGrossRevenue(unitsPerHour: number, sellPrice: number): number {
  if (unitsPerHour <= 0 || sellPrice <= 0) return 0
  return unitsPerHour * sellPrice
}

export function exportTaxFromGross(grossRevenue: number, exportTaxRate: number): number {
  if (grossRevenue <= 0 || exportTaxRate <= 0) return 0
  return grossRevenue * exportTaxRate
}

export function exportGrossFromNetRevenue(
  netExportRevenue: number,
  exportTaxRate: number
): number {
  if (netExportRevenue <= 0) return 0
  if (exportTaxRate >= 1) return netExportRevenue
  return netExportRevenue / (1 - exportTaxRate)
}

export function exportTaxFromNetRevenue(
  netExportRevenue: number,
  exportTaxRate: number
): number {
  const gross = exportGrossFromNetRevenue(netExportRevenue, exportTaxRate)
  return gross - netExportRevenue
}

export interface ColonyEconomicsResult {
  exportRevenue: number
  importCost: number
  exportGross: number
  exportTax: number
}

export function computeColonyEconomics(
  balances: PiCommodityBalance[],
  exitTypeId: number | undefined,
  surplusForSale: boolean,
  prices: PiPriceMap,
  exportTaxRate = DEFAULT_PI_EXPORT_TAX_RATE,
  pricingMode: PiPricingMode = DEFAULT_PI_PRICING_MODE,
  requireExportRoute = false,
  importTaxRate = exportTaxRate
): ColonyEconomicsResult {
  let exportRevenue = 0
  let importCost = 0
  let exportGross = 0
  let exportTax = 0
  const highestTier = highestExportTier(balances, exitTypeId)

  for (const balance of balances) {
    const sell = exportUnitPrice(prices, balance.typeId, pricingMode)
    const buy = importUnitPrice(prices, balance.typeId, pricingMode)
    const isFinal = isFinalExportBalance(balance, highestTier, exitTypeId)
    const exportRate = exportRateForValuation(balance, exitTypeId, surplusForSale, {
      isFinalTierProduct: isFinal,
      requireExportRoute,
    })
    // Material revenue is at market price; the customs tax is on the fixed
    // per-tier base value, not the market price. Gate on a known price so a
    // missing-price row stays 0/0 (unchanged behavior) instead of showing a
    // customs fee with no revenue behind it.
    const gross = exportGrossRevenue(exportRate, sell)
    const tax = gross > 0 ? customsTaxPerHour(exportRate, balance.typeId, exportTaxRate) : 0
    exportGross += gross
    exportTax += tax
    exportRevenue += gross - tax
    if (balance.importNeededPerHour > 0 && buy > 0) {
      // Material cost at market + customs tax on the base value (import = half).
      // importTaxRate defaults to exportTaxRate but can be configured separately.
      const material = balance.importNeededPerHour * buy
      const importCustoms = customsTaxPerHour(
        balance.importNeededPerHour,
        balance.typeId,
        importTaxRate,
        { isImport: true }
      )
      importCost += material + importCustoms
    }
  }

  return { exportRevenue, importCost, exportGross, exportTax }
}

export function collectMissingPriceWarnings(
  analysis: PiColonyAnalysis,
  prices: PiPriceMap,
  pricingMode: PiPricingMode = DEFAULT_PI_PRICING_MODE
): string[] {
  const warnings = new Set<string>()
  const { exitTypeId, config } = analysis
  const highestTier = highestExportTier(analysis.balances.potential, exitTypeId)

  const checkBalance = (balance: PiCommodityBalance) => {
    const isFinal = isFinalExportBalance(balance, highestTier, exitTypeId)
    const exportRate = exportRateForValuation(balance, exitTypeId, config.surplusForSale, {
      isFinalTierProduct: isFinal,
    })
    if (exportRate > 0 && exportUnitPrice(prices, balance.typeId, pricingMode) <= 0) {
      warnings.add(`Missing Jita sell price for export: ${balance.name}`)
    }
    if (balance.importNeededPerHour > 0 && importUnitPrice(prices, balance.typeId, pricingMode) <= 0) {
      warnings.add(`Missing Jita buy price for import: ${balance.name}`)
    }
  }

  for (const balance of analysis.balances.potential) checkBalance(balance)
  for (const balance of analysis.balances.current) checkBalance(balance)

  if (exitTypeId != null && exportUnitPrice(prices, exitTypeId, pricingMode) <= 0) {
    warnings.add(`Missing Jita sell price for exit product: ${getCommodityName(exitTypeId)}`)
  }

  return [...warnings]
}
