import {
  computeColonyEconomics,
  collectMissingPriceWarnings,
  customsTaxPerHour,
  DEFAULT_PI_EXPORT_TAX_RATE,
  exportRevenueAfterTax,
  importUnitPrice,
  exportUnitPrice,
} from '@/lib/pi/pi-pricing'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { composePriceMap } from '@/lib/pi/price-resolver'

describe('pi-pricing', () => {
  it('pessimistic mode uses volume-weighted prices when available, top-of-book otherwise', () => {
    const price = { buy: 100, sell: 120, weightedAsk: 135, weightedBid: 92 }
    // Pessimistic = instant execution → buy from asks (weightedAsk), sell to bids (weightedBid).
    expect(importUnitPrice({ 1: price }, 1, 'pessimistic')).toBe(135)
    expect(exportUnitPrice({ 1: price }, 1, 'pessimistic')).toBe(92)
    // Optimistic (limit orders) ignores weighting → top-of-book.
    expect(importUnitPrice({ 1: price }, 1, 'import_buy_export_sell')).toBe(100)
    expect(exportUnitPrice({ 1: price }, 1, 'import_buy_export_sell')).toBe(120)
    // No weighted values → pessimistic falls back to top-of-book.
    const bare = { buy: 100, sell: 120 }
    expect(importUnitPrice({ 1: bare }, 1, 'pessimistic')).toBe(120)
    expect(exportUnitPrice({ 1: bare }, 1, 'pessimistic')).toBe(100)
  })

  it('realistic mode: import walks asks (weightedAsk), export uses configured sell', () => {
    const price = { buy: 100, sell: 120, weightedAsk: 135, weightedBid: 92 }
    // Import = real multibuy cost (weightedAsk), same as pessimistic.
    expect(importUnitPrice({ 1: price }, 1, 'realistic')).toBe(135)
    // Export = configured sell source (composePriceMap's `sell`), NOT weightedBid.
    expect(exportUnitPrice({ 1: price }, 1, 'realistic')).toBe(120)
  })

  it('realistic mode: import falls back to sell when the ask book is empty', () => {
    const bare = { buy: 100, sell: 120 } // no weightedAsk
    // Must not zero out — falls back to top-of-book sell.
    expect(importUnitPrice({ 1: bare }, 1, 'realistic')).toBe(120)
    expect(exportUnitPrice({ 1: bare }, 1, 'realistic')).toBe(120)
  })

  it('realistic mode + jita_split: export equals (jitaBuy + jitaSell) / 2', () => {
    const { priceMap } = composePriceMap(
      [1],
      {
        regionDepth: {},
        jita: { 1: { buy: 800, sell: 1200 } },
        sellSource: 'jita_split',
      },
      new Map(),
      new Map()
    )
    // composePriceMap resolves sell = (800 + 1200) / 2 = 1000 for jita_split...
    expect(priceMap[1].sell).toBe(1000)
    // ...and realistic export respects that composed sell source.
    expect(exportUnitPrice(priceMap, 1, 'realistic')).toBe(1000)
  })

  it('customsTaxPerHour taxes the per-tier base value; import is halved (in-game validated)', () => {
    // P4 (2867), base 1.200.000: 1 unit × 2% = 24.000 — matches in-game export.
    expect(customsTaxPerHour(1, 2867, 0.02)).toBeCloseTo(24_000)
    // P2 (2312), base 7.200: 1 unit × 2% × 0,5 = 72 — matches in-game import.
    expect(customsTaxPerHour(1, 2312, 0.02, { isImport: true })).toBeCloseTo(72)
    // Non-PI type / unknown tier → 0 (never taxes a guessed value).
    expect(customsTaxPerHour(1, 34, 0.02)).toBe(0)
    // Zero units or zero rate → 0.
    expect(customsTaxPerHour(0, 2867, 0.02)).toBe(0)
    expect(customsTaxPerHour(1, 2867, 0)).toBe(0)
  })

  it('taxes exports/imports on the per-tier base value, not market price', () => {
    const balances = [
      {
        typeId: 2312, // P2 → customs base value 7.200
        name: 'Export',
        tier: 2 as const,
        demandPerHour: 0,
        extractionPerHour: 0,
        productionPerHour: 100,
        localSupplyPerHour: 100,
        importNeededPerHour: 0,
        surplusPerHour: 0,
        exportedPerHour: 100,
        wastedPerHour: 0,
        isImported: false,
        isExportable: true,
      },
      {
        typeId: 2317, // P1 → customs base value 400
        name: 'Import',
        tier: 1 as const,
        demandPerHour: 50,
        extractionPerHour: 0,
        productionPerHour: 0,
        localSupplyPerHour: 0,
        importNeededPerHour: 50,
        surplusPerHour: 0,
        exportedPerHour: 0,
        wastedPerHour: 0,
        isImported: true,
        isExportable: false,
      },
    ]

    const result = computeColonyEconomics(balances, 2312, true, {
      2312: { buy: 1, sell: 10_000 },
      2317: { buy: 500, sell: 400 },
    })

    // Export: market gross, but customs is base-value×rate (NOT sell×rate).
    expect(result.exportGross).toBeCloseTo(100 * 10_000)
    expect(result.exportTax).toBeCloseTo(100 * 7_200 * DEFAULT_PI_EXPORT_TAX_RATE)
    expect(result.exportRevenue).toBeCloseTo(100 * 10_000 - 100 * 7_200 * DEFAULT_PI_EXPORT_TAX_RATE)
    // Import: market cost + customs on base value (P1 = 400), halved.
    expect(result.importCost).toBeCloseTo(50 * 500 + 50 * 400 * DEFAULT_PI_EXPORT_TAX_RATE * 0.5)
  })

  it('applies a separate POCO import rate on the base value (halved)', () => {
    const balances = [
      {
        typeId: 2317, // P1 → customs base value 400
        name: 'Import',
        tier: 1 as const,
        demandPerHour: 50,
        extractionPerHour: 0,
        productionPerHour: 0,
        localSupplyPerHour: 0,
        importNeededPerHour: 50,
        surplusPerHour: 0,
        exportedPerHour: 0,
        wastedPerHour: 0,
        isImported: true,
        isExportable: false,
      },
    ]
    // export tax 10%, import tax 2% → customs = 50 * 400 * 0.02 * 0.5 = 200
    // material = 50 * 10 = 500 → import cost = 700
    const result = computeColonyEconomics(balances, undefined, true, { 2317: { buy: 10, sell: 5 } }, 0.1, 'import_buy_export_sell', false, 0.02)
    expect(result.importCost).toBeCloseTo(50 * 10 + 50 * 400 * 0.02 * 0.5)
  })

  it('collects missing price warnings', () => {
    const analysis = {
      exitTypeId: 100,
      config: { planetId: 1, surplusForSale: true },
      balances: {
        potential: [
          {
            typeId: 100,
            name: 'Export',
            demandPerHour: 0,
            extractionPerHour: 0,
            productionPerHour: 10,
            localSupplyPerHour: 10,
            importNeededPerHour: 0,
            surplusPerHour: 0,
            exportedPerHour: 10,
            wastedPerHour: 0,
            isImported: false,
            isExportable: true,
          },
        ],
        current: [],
      },
    } as PiColonyAnalysis

    const warnings = collectMissingPriceWarnings(analysis, {})
    expect(warnings.some((w) => w.includes('Export'))).toBe(true)
  })

  it('resolves import and export unit prices', () => {
    const prices = { 1: { buy: 5, sell: 10 } }
    expect(importUnitPrice(prices, 1)).toBe(5)
    expect(exportUnitPrice(prices, 1)).toBe(10)
    expect(exportRevenueAfterTax(10, 10, 0.1)).toBe(90)
  })
})
