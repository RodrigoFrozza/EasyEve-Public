import { compressionUnitRatio } from '@/lib/mining-price-resolution'
import { ICE_BATCH_SIZE, ORE_BATCH_SIZE } from '@/lib/constants/mining'
import { getBaseOreName, getReprocessingYield } from '@/lib/mining-reprocessing-yields'

export type MiningPriceSide = 'buy' | 'sell' | 'split'

export type OreBreakdownEntry = {
  typeId?: number
  name?: string
  quantity: number
  volumeValue?: number
  estimatedValue?: number
  buy?: number
  sell?: number
  compressedBuy?: number
  compressedSell?: number
}

export type OrePriceColumn = {
  buy?: number
  sell?: number
  split?: number
  price?: number
}

export type OrePriceRow = {
  id: number
  name: string
  raw?: OrePriceColumn
  refined?: OrePriceColumn
  reprocessingProducts?: ReprocessingProductPrice[]
}

/** Reprocessing output for one mined unit batch, with Jita prices per product. */
export type ReprocessingProductPrice = {
  materialId: number
  quantity: number
  buy: number
  sell: number
  split: number
}

export type SessionValuationOreRow = {
  typeId: string
  name: string
  quantity: number
  rawUnitPrice: number
  refinedUnitPrice: number
  rawIsk: number
  refinedIsk: number
  deltaPct: number
}

export type SessionValuationResult = {
  rawTotal: number
  refinedTotal: number
  deltaPct: number
  rawIskPerHour: number
  refinedIskPerHour: number
  byOre: SessionValuationOreRow[]
}

export type SessionValuationOptions = {
  priceSide: MiningPriceSide
  efficiencyPct: number
  isIceMiningCategory: boolean
  miningCategory?: 'Ore' | 'Ice' | 'Gas' | 'Moon'
  hours: number
  mineralPrices?: Record<number, { buy?: number; sell?: number }>
}

function entryUsesIceRatio(
  entry: OreBreakdownEntry,
  sessionCategory: 'Ore' | 'Ice' | 'Gas' | 'Moon'
): boolean {
  if (sessionCategory === 'Ice') return true
  if (!entry.name) return false
  return inferMiningCategoryFromBreakdown('Ore', { x: { name: entry.name } }) === 'Ice'
}

export function inferMiningCategoryFromBreakdown(
  declared: string | undefined,
  oreBreakdown: Record<string, { name?: string }>
): 'Ore' | 'Ice' | 'Gas' | 'Moon' {
  const normalized = (declared || '').trim()
  if (normalized && normalized !== 'Ore') {
    const cat = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
    if (cat === 'Ice' || cat === 'Gas' || cat === 'Moon') return cat
  }

  const names = Object.values(oreBreakdown)
    .map((o) => (o.name || '').toLowerCase())
    .filter(Boolean)

  const iceHints = [
    'glacial',
    'glare',
    'gelidus',
    'dark glitter',
    'blue ice',
    'clear icicle',
    'white glaze',
    'krystallos',
    'icicle',
    'glaze',
  ]
  if (names.some((n) => iceHints.some((h) => n.includes(h)))) return 'Ice'

  const gasHints = ['cytoserocin', 'mykoserocin', 'fullerite', 'fullerene']
  if (names.some((n) => gasHints.some((h) => n.includes(h)))) return 'Gas'

  const moonHints = ['bitumens', 'coesite', 'sylvite', 'zeolites', 'cobaltite', 'chromite']
  if (names.some((n) => moonHints.some((h) => n.includes(h)))) return 'Moon'

  return 'Ore'
}

function resolvePriceRow(
  typeId: string,
  entry: OreBreakdownEntry,
  priceRowsById: Record<number, OrePriceRow>,
  priceRowsByBaseName: Record<string, OrePriceRow>
): OrePriceRow | undefined {
  const byId = priceRowsById[Number(typeId)]
  if (byId) return byId

  const fromEntryName = entry.name ? priceRowsByBaseName[getBaseOreName(entry.name).toLowerCase()] : undefined
  if (fromEntryName) return fromEntryName

  return undefined
}

function computeRefinedUnitFromProducts(
  products: ReprocessingProductPrice[],
  side: MiningPriceSide,
  efficiencyPct: number,
  isIce: boolean
): number {
  if (products.length === 0) return 0

  const batchSize = isIce ? ICE_BATCH_SIZE : ORE_BATCH_SIZE
  const gross = products.reduce(
    (sum, p) => sum + resolvePriceSide(p.buy, p.sell, side) * p.quantity,
    0
  )
  const efficiency = Math.max(0, Math.min(100, efficiencyPct)) / 100
  return (gross / batchSize) * efficiency
}

/** Build priced reprocessing products for a mined type name. */
export function buildReprocessingProductPrices(
  typeName: string,
  allPrices: Record<number, { buy?: number; sell?: number }>
): ReprocessingProductPrice[] {
  const yields = getReprocessingYield(typeName)
  return yields.map((y) => ({
    materialId: y.mineralId,
    quantity: y.quantity,
    buy: allPrices[y.mineralId]?.buy || 0,
    sell: allPrices[y.mineralId]?.sell || 0,
    split: resolvePriceSide(allPrices[y.mineralId]?.buy, allPrices[y.mineralId]?.sell, 'split'),
  }))
}

export function buildMineralPriceIndex(
  products: ReprocessingProductPrice[]
): Record<number, { buy?: number; sell?: number }> {
  const map: Record<number, { buy?: number; sell?: number }> = {}
  for (const p of products) {
    if (!map[p.materialId]) {
      map[p.materialId] = { buy: p.buy, sell: p.sell }
    }
  }
  return map
}

function resolveReprocessingProducts(
  entry: OreBreakdownEntry,
  priceRow: OrePriceRow | undefined,
  mineralPrices?: Record<number, { buy?: number; sell?: number }>
): ReprocessingProductPrice[] {
  if (priceRow?.reprocessingProducts && priceRow.reprocessingProducts.length > 0) {
    return priceRow.reprocessingProducts
  }

  const oreName = entry.name || priceRow?.name
  if (!oreName || !mineralPrices) return []

  return buildReprocessingProductPrices(oreName, mineralPrices)
}

export function buildPriceRowIndexes(rows: OrePriceRow[]): {
  byId: Record<number, OrePriceRow>
  byBaseName: Record<string, OrePriceRow>
} {
  const byId: Record<number, OrePriceRow> = {}
  const byBaseName: Record<string, OrePriceRow> = {}
  for (const row of rows) {
    byId[row.id] = row
    const base = getBaseOreName(row.name).toLowerCase()
    if (!byBaseName[base]) byBaseName[base] = row
  }
  return { byId, byBaseName }
}

const positive = (v: number | undefined): number => (v && v > 0 ? v : 0)

export function resolvePriceSide(
  buy: number | undefined,
  sell: number | undefined,
  side: MiningPriceSide
): number {
  const b = positive(buy)
  const s = positive(sell)

  switch (side) {
    case 'buy':
      return b || s
    case 'sell':
      return s || b
    case 'split':
      if (b > 0 && s > 0) return (b + s) / 2
      return b || s
    default: {
      const _exhaustive: never = side
      return _exhaustive
    }
  }
}

export function resolveRawUnitPrice(
  entry: Pick<
    OreBreakdownEntry,
    'buy' | 'sell' | 'compressedBuy' | 'compressedSell'
  >,
  side: MiningPriceSide,
  isIceMiningCategory: boolean
): number {
  const ratio = compressionUnitRatio(isIceMiningCategory)
  const rawPrice = resolvePriceSide(entry.buy, entry.sell, side)
  if (rawPrice > 0) return rawPrice

  const compressedPrice = resolvePriceSide(entry.compressedBuy, entry.compressedSell, side)
  if (compressedPrice > 0) return compressedPrice / ratio

  return 0
}

export function resolveRefinedUnitPrice(
  refinedBuy: number | undefined,
  refinedSell: number | undefined,
  side: MiningPriceSide,
  efficiencyPct: number
): number {
  const base = resolvePriceSide(refinedBuy, refinedSell, side)
  if (base <= 0) return 0
  const efficiency = Math.max(0, Math.min(100, efficiencyPct))
  return base * (efficiency / 100)
}

export function resolveColumnUnitPrice(
  column: OrePriceColumn | undefined,
  side: MiningPriceSide
): number {
  if (!column) return 0
  if (side === 'split') {
    const split = positive(column.split)
    if (split > 0) return split
  }
  return resolvePriceSide(column.buy, column.sell, side)
}

export function calculateSessionValuation(
  oreBreakdown: Record<string, OreBreakdownEntry>,
  priceRowsById: Record<number, OrePriceRow>,
  options: SessionValuationOptions,
  priceRowsByBaseName: Record<string, OrePriceRow> = {}
): SessionValuationResult {
  const { priceSide, efficiencyPct, isIceMiningCategory, hours, mineralPrices } = options
  const sessionCategory =
    options.miningCategory ?? (isIceMiningCategory ? 'Ice' : 'Ore')
  const safeHours = Math.max(0.01, hours)

  let rawTotal = 0
  let refinedTotal = 0
  const byOre: SessionValuationOreRow[] = []

  for (const [typeId, entry] of Object.entries(oreBreakdown)) {
    const qty = entry.quantity || 0
    if (qty <= 0) continue

    const entryIsIce = entryUsesIceRatio(entry, sessionCategory)
    const rawUnitPrice = resolveRawUnitPrice(entry, priceSide, entryIsIce)

    const priceRow = resolvePriceRow(typeId, entry, priceRowsById, priceRowsByBaseName)
    const products = resolveReprocessingProducts(entry, priceRow, mineralPrices)
    const refinedUnitPrice = computeRefinedUnitFromProducts(
      products,
      priceSide,
      efficiencyPct,
      entryIsIce
    )

    const rawIsk = qty * rawUnitPrice
    const refinedIsk = qty * refinedUnitPrice
    const deltaPct = rawIsk > 0 ? ((refinedIsk - rawIsk) / rawIsk) * 100 : 0

    rawTotal += rawIsk
    refinedTotal += refinedIsk

    byOre.push({
      typeId,
      name: entry.name || priceRow?.name || `Type ${typeId}`,
      quantity: qty,
      rawUnitPrice,
      refinedUnitPrice,
      rawIsk,
      refinedIsk,
      deltaPct,
    })
  }

  byOre.sort((a, b) => b.rawIsk - a.rawIsk)

  const deltaPct = rawTotal > 0 ? ((refinedTotal - rawTotal) / rawTotal) * 100 : 0

  return {
    rawTotal,
    refinedTotal,
    deltaPct,
    rawIskPerHour: rawTotal / safeHours,
    refinedIskPerHour: refinedTotal / safeHours,
    byOre,
  }
}
