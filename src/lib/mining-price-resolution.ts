/**
 * Unified Jita unit-price resolution for mining ores (raw ledger units).
 * Order: max buy raw > max buy compressed (÷ ratio) > min sell raw > min sell compressed (÷ ratio).
 */

export type MiningPriceBasis =
  | 'jita_buy_raw'
  | 'jita_buy_compressed'
  | 'jita_sell_raw'
  | 'jita_sell_compressed'
  | 'none'

export type MiningPriceUiConfidence = 'high' | 'fallback' | 'none'

export function compressionUnitRatio(isIceMiningCategory: boolean): number {
  return isIceMiningCategory ? 1 : 100
}

export function resolveMiningUnitPrice(params: {
  isIceMiningCategory: boolean
  rawBuy: number
  rawSell: number
  compressedBuy: number
  compressedSell: number
}): {
  unitPrice: number
  basis: MiningPriceBasis
  confidence: MiningPriceUiConfidence
} {
  const r = compressionUnitRatio(params.isIceMiningCategory)
  const rb = params.rawBuy || 0
  const rs = params.rawSell || 0
  const cb = params.compressedBuy || 0
  const cs = params.compressedSell || 0

  if (rb > 0) return { unitPrice: rb, basis: 'jita_buy_raw', confidence: 'high' }
  if (cb > 0) return { unitPrice: cb / r, basis: 'jita_buy_compressed', confidence: 'fallback' }
  if (rs > 0) return { unitPrice: rs, basis: 'jita_sell_raw', confidence: 'fallback' }
  if (cs > 0) return { unitPrice: cs / r, basis: 'jita_sell_compressed', confidence: 'fallback' }
  return { unitPrice: 0, basis: 'none', confidence: 'none' }
}

export function miningPriceBasisTooltip(basis: MiningPriceBasis): string {
  switch (basis) {
    case 'jita_buy_raw':
      return 'Price: highest Jita buy order (raw).'
    case 'jita_buy_compressed':
      return 'Price: highest Jita buy for compressed ore, converted per raw unit (100:1 except ice).'
    case 'jita_sell_raw':
      return 'Fallback: lowest Jita sell order (raw) — may be less representative than buy.'
    case 'jita_sell_compressed':
      return 'Fallback: lowest Jita sell for compressed ore, converted per raw unit.'
    default:
      return 'No Jita order data found for this type.'
  }
}
