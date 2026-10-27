export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { getAllStructureOrders } from '@/lib/pi/structure-market'
import { getProductionRecipesForTypes } from '@/lib/industry/get-blueprint'
import { computeProductionCost } from '@/lib/industry/production-cost'
import { localBuildTimeSeconds } from '@/lib/industry/build-time'
import { resolveHubDepth } from '@/lib/industry/market-depth'
import { loadIndustryConfig } from '@/lib/industry/config-store'
import { persistStationSnapshots } from '@/lib/industry/market-snapshots'
import { computeEiv, computeLocalJobCost, getAdjustedPrices, getCostIndex } from '@/lib/industry/job-cost'
import {
  aggregateStationOrders,
  isDeficit,
  MIN_DEMAND_ISK,
  demandValueIsk,
  pickDeficitCandidates,
  rankDeficits,
  type DeficitRowInput,
  type DeficitCandidate,
} from '@/lib/industry/deficit-scan'

const MAX_CANDIDATES_PER_STATION = 40
const MAX_CANDIDATES_TOTAL = 60
// How far back to average a candidate's buy-volume history for the demand signal.
const DEMAND_LOOKBACK_DAYS = 14

/**
 * "What to produce" deficit scanner: sweep each monitored structure's order book,
 * find the buildable items (manufacturing or reaction) in deficit (demand outweighs supply), price their
 * production at the buy hub, and rank the most worth-building. Uses the first buy
 * hub for material cost (single hub, to keep the fan-out bounded).
 */
export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const config = await loadIndustryConfig(user.id)
  if (config.monitoredStations.length === 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'No monitored stations configured', 400)
  }
  const characterIds = user.characters.map((c) => c.id)

  // 1. Aggregate each station's order book into per-type supply/demand.
  const perStation = await Promise.all(
    config.monitoredStations.map(async (station) => {
      const orders = await getAllStructureOrders(station.id, characterIds)
      return { station, aggregates: orders ? aggregateStationOrders(orders) : null }
    })
  )

  const reachable = perStation.filter((s) => s.aggregates != null)

  // Fire-and-forget: capture today's snapshot of each reachable station's order book.
  // Never blocks or fails the scan response — a snapshot write failure is logged but
  // must not take down the deficit scan itself.
  for (const s of reachable) {
    void persistStationSnapshots(s.station.id, s.aggregates!).catch((error) => {
      logger.warn('INDUSTRY_SNAPSHOT', `Failed to persist market snapshot for station ${s.station.id}`, error)
    })
  }

  if (reachable.length === 0) {
    throw new AppError(
      ErrorCodes.API_NOT_FOUND,
      'Could not read any monitored station market (no docking access, or empty market)',
      404
    )
  }

  // 2. Which deficit types are buildable — manufacturing or reaction (one query).
  const deficitTypeIds = new Set<number>()
  for (const s of reachable) {
    for (const agg of s.aggregates!.values()) if (isDeficit(agg)) deficitTypeIds.add(agg.typeId)
  }
  if (deficitTypeIds.size === 0) {
    return NextResponse.json({ rows: [], stationsScanned: reachable.length, buyLabel: config.buyHubs[0]!.name })
  }
  const manufacturable = await prisma.blueprintProduct.findMany({
    where: { typeId: { in: [...deficitTypeIds] }, activity: { in: ['manufacturing', 'reaction'] } },
    select: { typeId: true },
  })
  const buildable = new Set(manufacturable.map((m) => m.typeId))

  // 3. Pre-rank candidates per station (scarcity × value), then combine + cap.
  type Candidate = { agg: DeficitCandidate; station: (typeof reachable)[number]['station'] }
  const candidates: Candidate[] = []
  for (const s of reachable) {
    const picked = pickDeficitCandidates(s.aggregates!, (id) => buildable.has(id), MAX_CANDIDATES_PER_STATION)
    for (const agg of picked) candidates.push({ agg, station: s.station })
  }
  candidates.sort((a, b) => b.agg.scarcityRatio * b.agg.bestBuy - a.agg.scarcityRatio * a.agg.bestBuy)
  const top = candidates.slice(0, MAX_CANDIDATES_TOTAL)

  // 4. Price production of the top candidates at the first buy hub. In parallel,
  // pull the recent buy-volume history of these candidates from our own snapshots
  // (the demand/liquidity axis — see below). One indexed Postgres read, no ESI.
  const recipes = await getProductionRecipesForTypes(top.map((c) => c.agg.typeId))
  const recipeByProduct = new Map(recipes.map((r) => [r.product.typeId, r]))
  const materialTypeIds = [...new Set(recipes.flatMap((r) => r.materials.map((m) => m.typeId)))]
  const buyHub = config.buyHubs[0]!

  const demandCutoff = new Date()
  demandCutoff.setUTCDate(demandCutoff.getUTCDate() - DEMAND_LOOKBACK_DAYS)
  demandCutoff.setUTCHours(0, 0, 0, 0)

  // Sales taxes — same rule as the calculator (blueprint-cost): only applied when
  // the user configured at least one; an unconfigured tax is never assumed 0%,
  // the response says it was left out so the UI can label the profit as gross.
  const taxesConfigured = config.salesTaxPct != null || config.brokerFeePct != null
  const revenueTaxPct = taxesConfigured ? (config.salesTaxPct ?? 0) + (config.brokerFeePct ?? 0) : null

  // Job installation cost — local formula (EIV × cost index + facility tax + SCC),
  // no structure job-cost bonus (labeled as approximate). EVE Ref would be one HTTP
  // call per candidate (up to 60), so the scanner uses the local formula; the
  // per-item calculator keeps the EVE Ref number. Both inputs are single cached
  // reads for the whole scan. Never invented: unknown → 'unavailable', flagged.
  const factorySystemId = config.factory?.solarSystemId ?? null
  let jobCostStatus: 'included' | 'not_configured' | 'unavailable' = factorySystemId == null ? 'not_configured' : 'included'
  let adjustedPrices: Record<number, number> = {}
  // Reactions run on their own system cost index (same cached ESI document).
  const costIndex: Record<'manufacturing' | 'reaction', number | null> = { manufacturing: null, reaction: null }
  if (factorySystemId != null) {
    try {
      const eivIds = [...new Set(recipes.flatMap((r) => r.materials.map((m) => m.typeId)))]
      ;[adjustedPrices, costIndex.manufacturing, costIndex.reaction] = await Promise.all([
        getAdjustedPrices(eivIds),
        getCostIndex(factorySystemId, 'manufacturing'),
        getCostIndex(factorySystemId, 'reaction'),
      ])
      if (costIndex.manufacturing == null) jobCostStatus = 'unavailable'
    } catch (error) {
      logger.warn('INDUSTRY_DEFICITS', 'Job cost inputs unavailable for the deficit scan', error)
      jobCostStatus = 'unavailable'
    }
  }

  const [buyDepth, demandRows] = await Promise.all([
    resolveHubDepth(buyHub, characterIds, materialTypeIds),
    prisma.stationMarketSnapshot.findMany({
      where: {
        structureId: { in: [...new Set(top.map((c) => c.station.id))] },
        typeId: { in: [...new Set(top.map((c) => c.agg.typeId))] },
        day: { gte: demandCutoff },
      },
      select: { structureId: true, typeId: true, buyVolume: true },
    }),
  ])

  // Mean observed buy volume per (structure, type) across the snapshot days we
  // have. Sparse today (snapshots are young) — a candidate with no history just
  // has no entry here and falls back to its live buy volume below.
  const demandByKey = new Map<string, { sum: number; days: number }>()
  for (const row of demandRows) {
    const key = `${row.structureId}:${row.typeId}`
    const entry = demandByKey.get(key) ?? { sum: 0, days: 0 }
    entry.sum += row.buyVolume
    entry.days += 1
    demandByKey.set(key, entry)
  }

  const inputs: DeficitRowInput[] = []
  let belowDemandFloor = 0
  for (const c of top) {
    const recipe = recipeByProduct.get(c.agg.typeId)
    if (!recipe) continue

    // Demand (liquidity) axis: mean historical buy volume when we have snapshots,
    // else the live buy volume — real order-book fact, never a fabricated number.
    const demand = demandByKey.get(`${c.station.id}:${c.agg.typeId}`)
    const demandVolume = demand && demand.days > 0 ? demand.sum / demand.days : c.agg.buyVolume
    const demandDays = demand?.days ?? 0
    // Below the demand floor the item is not worth listing; counted, not silently dropped.
    if (demandValueIsk(demandVolume, c.agg.bestBuy) < MIN_DEMAND_ISK) {
      belowDemandFloor++
      continue
    }
    const isReaction = recipe.activity === 'reaction'
    const cost = computeProductionCost({
      materials: recipe.materials,
      runs: 1,
      // Reaction formulas have no material efficiency.
      me: isReaction ? 0 : config.defaultMe,
      owned: {},
      materialDepth: buyDepth.depth,
      output: recipe.product,
      outputDepth: undefined,
    })
    // Per-unit production cost (recipe output can be >1 unit per run).
    const outputPerRun = Math.max(1, recipe.product.baseQuantity)
    const perUnitCost = cost.totalMaterialCost / outputPerRun
    const itemPrice = c.agg.bestSell > 0 ? c.agg.bestSell : c.agg.bestBuy

    // Per-unit job cost for one run. A material without an adjusted price means
    // the EIV is unknown → this row is flagged, not silently costed at 0.
    let jobCostPerUnit: number | null = null
    let jobCostMissing = false
    const activityIndex = isReaction ? costIndex.reaction : costIndex.manufacturing
    if (jobCostStatus === 'included' && activityIndex != null && config.factory) {
      const eiv = computeEiv(
        recipe.materials.map((m) => ({ typeId: m.typeId, baseQuantity: m.baseQuantity })),
        1,
        adjustedPrices
      )
      if (eiv.missingPrices.length > 0) {
        jobCostMissing = true
      } else {
        const job = computeLocalJobCost({ eiv: eiv.eiv, costIndex: activityIndex, facilityTaxPct: config.factory.facilityTaxPct })
        jobCostPerUnit = job.total / outputPerRun
      }
    } else if (jobCostStatus === 'unavailable' || (jobCostStatus === 'included' && activityIndex == null)) {
      // e.g. the factory system has no reaction index: flagged, never costed at 0.
      jobCostMissing = true
    }

    // Local base time only (no TE/skill/structure bonus) — a conservative,
    // uniform floor across candidates, so ISK/h ranks them fairly even though it
    // undersells absolute throughput. The per-item calculator applies the real
    // TE/structure/skills.
    const buildTimeSeconds = localBuildTimeSeconds(recipe.baseTimeSeconds, 1, 0)

    inputs.push({
      productTypeId: c.agg.typeId,
      productName: recipe.product.name,
      activity: recipe.activity,
      stationId: c.station.id,
      stationName: c.station.name,
      sellVolume: c.agg.sellVolume,
      buyVolume: c.agg.buyVolume,
      itemPrice,
      productionCost: perUnitCost,
      revenueTaxPct,
      jobCostPerUnit,
      jobCostMissing,
      buildTimeSeconds,
      outputPerRun,
      demandVolume,
      demandDays,
      bestBuy: c.agg.bestBuy,
      anyThin: cost.anyThin,
      anyNoPrice: cost.anyNoPrice,
      anyStale: cost.anyStale,
    })
  }

  return NextResponse.json({
    rows: rankDeficits(inputs),
    stationsScanned: reachable.length,
    stationsUnreachable: config.monitoredStations.length - reachable.length,
    buyLabel: buyHub.name,
    me: config.defaultMe,
    revenueTaxPct,
    jobCostStatus,
    minDemandIsk: MIN_DEMAND_ISK,
    belowDemandFloor,
  })
})
