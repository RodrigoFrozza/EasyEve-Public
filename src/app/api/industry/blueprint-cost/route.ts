export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { resolveNamesToTypes } from '@/lib/appraisal/resolve-names'
import { getProductionRecipe } from '@/lib/industry/get-blueprint'
import { computeMultiHubCost } from '@/lib/industry/multi-hub-cost'
import { resolveHubDepth } from '@/lib/industry/market-depth'
import { loadIndustryConfig } from '@/lib/industry/config-store'
import { fetchRigAdjustedMaterials } from '@/lib/industry/everef-cost'
import { getAdjustedPrices, getCostIndex, computeLocalJobCost, computeEiv } from '@/lib/industry/job-cost'
import type { ProductionMaterialInput } from '@/lib/industry/production-cost'
import { syncUserBlueprints, getOwnedBlueprints } from '@/lib/industry/blueprint-sync'
import { clampTe, localBuildTimeSeconds, iskPerHour } from '@/lib/industry/build-time'
import { getIndustrySkillLevels } from '@/lib/characters/industry-skills'
import { logger } from '@/lib/server-logger'

/**
 * Cost + profit to manufacture an item. Inputs are priced across every buy hub
 * the user configured (cheapest wins, with a per-hub comparison); the output is
 * valued at the configured sell hub. ME defaults to the saved config but the UI
 * can override it (and runs / owned) per calculation.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = (await request.json().catch(() => ({}))) as {
    productName?: string
    productTypeId?: number
    runs?: number
    me?: number
    te?: number
    owned?: Record<string, number>
  }

  // Resolve the product type (by explicit id or by name).
  let productTypeId = Number.isInteger(body.productTypeId) ? Number(body.productTypeId) : 0
  if (!productTypeId && body.productName) {
    const { resolved } = await resolveNamesToTypes([body.productName])
    const hit = resolved.get(body.productName.trim().toLowerCase())
    if (hit) productTypeId = hit.typeId
  }
  if (!productTypeId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Item not found', 400)
  }

  const recipe = await getProductionRecipe(productTypeId)
  if (!recipe) {
    throw new AppError(
      ErrorCodes.API_NOT_FOUND,
      'No manufacturing or reaction blueprint for this item (or the blueprint catalogue is not populated yet)',
      404
    )
  }
  const isReaction = recipe.activity === 'reaction'

  // Owned-blueprint lookup: a stale sync (default 60-min freshness) no-ops here, so
  // this is cheap on the common path. A sync failure must never break costing — it's
  // logged and the calculator simply shows no owned blueprints for this request.
  try {
    await syncUserBlueprints(user.id)
  } catch (error) {
    logger.warn('INDUSTRY_BP_SYNC', `Blueprint sync failed for user ${user.id}`, error)
  }
  const ownedBlueprintRows = await getOwnedBlueprints(user.id, recipe.blueprintTypeId)
  const ownedBestMe = ownedBlueprintRows.length > 0 ? ownedBlueprintRows[0]!.materialEfficiency : null
  // Best TE across owned rows (rows are ME-sorted, so scan for the max TE rather
  // than trusting position). Null when none owned.
  const ownedBestTe =
    ownedBlueprintRows.length > 0
      ? Math.max(...ownedBlueprintRows.map((r) => r.timeEfficiency))
      : null

  const config = await loadIndustryConfig(user.id)
  const runs = Math.max(1, Math.floor(body.runs ?? 1))
  // Reactions have no Material Efficiency research — force 0 regardless of what
  // the body/config say, never derive a nonzero ME for a reaction (regra de ouro).
  const me = isReaction ? 0 : Math.max(0, Math.min(10, Math.floor(body.me ?? config.defaultMe)))
  // Reactions likewise can't be TE-researched — force 0. Otherwise take the body's
  // TE (clamped 0-20), defaulting to 0 (no research assumed) when unset.
  const te = isReaction ? 0 : clampTe(body.te ?? 0)

  // Industry skills feed the EVE Ref build time. Read from the configured industry
  // character's profile snapshot (may be stale/absent — surfaced to the UI). Null
  // = no skill bonus applied, labeled; never a fabricated level.
  const skillLevels = config.industryCharacterId
    ? await getIndustrySkillLevels(config.industryCharacterId)
    : null
  const skillCharacterName = config.industryCharacterId
    ? user.characters.find((c) => c.id === config.industryCharacterId)?.name ?? null
    : null
  const owned: Record<number, number> = {}
  for (const [k, v] of Object.entries(body.owned ?? {})) {
    const id = Number(k)
    const qty = Number(v)
    if (Number.isInteger(id) && qty > 0) owned[id] = Math.floor(qty)
  }

  // With a configured factory (structure + rigs), EVE Ref returns rig/ME/security-
  // adjusted material quantities for the whole job; we price those directly (runs
  // and ME already baked in). Without it, or if EVE Ref is unreachable, fall back to
  // the local ME formula and flag that the rig discount wasn't applied.
  let materials: ProductionMaterialInput[] = recipe.materials
  let effectiveRuns = runs
  let effectiveMe = me
  let output = recipe.product
  let rigApplied = false
  let rigUnavailable = false
  // Reactions run in refineries (Athanor/Tatara + reactor rigs) — a different
  // structure class from the manufacturing Engineering Complex our `factory`
  // config models, and EVE Ref's rig-adjusted-materials payload is manufacturing-
  // specific. So for a reaction we skip EVE Ref entirely and tell the UI reactor-
  // rig material bonuses are NOT included, rather than pretending the ME0 SDE
  // quantities are rig-adjusted (regra de ouro: label, don't estimate).
  const reactorRigNote = isReaction

  // The EVE Ref call also carries job-cost fields (system_id/facility_tax) when a
  // factory + manufacturing system are configured — keep the raw result around so
  // the job-cost block below can reuse it instead of a second HTTP call.
  let everefResult: Awaited<ReturnType<typeof fetchRigAdjustedMaterials>> = null

  if (!isReaction && config.factory?.structureTypeId != null) {
    everefResult = await fetchRigAdjustedMaterials({
      productTypeId: recipe.product.typeId,
      runs,
      me,
      te,
      factory: config.factory,
      skills: skillLevels
        ? { industry: skillLevels.industry, advancedIndustry: skillLevels.advancedIndustry }
        : null,
    })
    if (everefResult) {
      const nameByType = new Map(recipe.materials.map((m) => [m.typeId, m.name]))
      materials = Object.entries(everefResult.materials).map(([tid, qty]) => ({
        typeId: Number(tid),
        name: nameByType.get(Number(tid)) ?? `Type ${tid}`,
        baseQuantity: qty,
      }))
      // Quantities already cover all runs at this ME + rigs — don't re-apply either.
      effectiveRuns = 1
      effectiveMe = 0
      output = { ...recipe.product, baseQuantity: recipe.product.baseQuantity * runs }
      rigApplied = true
    } else {
      rigUnavailable = true
    }
  }

  // Job installation cost — gated separately on the manufacturing system being
  // configured (a factory can be set without a system, e.g. only for rig
  // discounts). Primary source is EVE Ref (it also applies structure job-cost
  // bonuses we couldn't confirm ourselves); fall back to the local EIV/cost-index
  // formula (excludes structure bonuses) when EVE Ref didn't return job-cost
  // fields. Never invents a number — jobCostUnavailable flags a true unknown.
  // For a reaction, everefResult is always null (we skip EVE Ref above), so this
  // always falls through to the local formula — but uses the REACTION cost index
  // (a different ESI activity than manufacturing) rather than the manufacturing
  // one.
  let jobCost: { total: number; sccSurcharge: number; facilityTax: number } | null = null
  let jobCostSource: 'everef' | 'local_approx' | null = null
  let jobCostUnavailable = false

  if (config.factory?.solarSystemId != null) {
    if (everefResult?.jobCost) {
      jobCost = {
        total: everefResult.jobCost.total,
        sccSurcharge: everefResult.jobCost.sccSurcharge,
        facilityTax: everefResult.jobCost.facilityTax,
      }
      jobCostSource = 'everef'
    } else {
      try {
        const eivMaterialIds = recipe.materials.map((m) => m.typeId)
        const [adjustedPrices, costIndex] = await Promise.all([
          getAdjustedPrices(eivMaterialIds),
          getCostIndex(config.factory.solarSystemId, isReaction ? 'reaction' : 'manufacturing'),
        ])
        const eivResult = computeEiv(
          recipe.materials.map((m) => ({ typeId: m.typeId, baseQuantity: m.baseQuantity })),
          runs,
          adjustedPrices
        )
        if (costIndex == null || eivResult.missingPrices.length > 0) {
          jobCostUnavailable = true
        } else {
          const local = computeLocalJobCost({
            eiv: eivResult.eiv,
            costIndex,
            facilityTaxPct: config.factory.facilityTaxPct,
          })
          jobCost = { total: local.total, sccSurcharge: local.sccSurcharge, facilityTax: local.facilityTax }
          jobCostSource = 'local_approx'
        }
      } catch {
        jobCostUnavailable = true
      }
    }
  }

  const characterIds = user.characters.map((c) => c.id)
  const materialTypeIds = materials.map((m) => m.typeId)
  const sellHub = config.sellHub ?? config.buyHubs[0]!

  const [buyHubDepths, sellResolved] = await Promise.all([
    Promise.all(config.buyHubs.map((h) => resolveHubDepth(h, characterIds, materialTypeIds))),
    resolveHubDepth(sellHub, characterIds, [recipe.product.typeId]),
  ])

  const result = computeMultiHubCost({
    materials,
    runs: effectiveRuns,
    me: effectiveMe,
    owned,
    buyHubs: buyHubDepths,
    output,
    sellDepth: sellResolved.depth[recipe.product.typeId],
  })

  // Mark which materials are themselves manufacturable OR reaction-producible so
  // the UI can offer to drill into their recipe (build-vs-buy per component) —
  // reaction inputs are frequently themselves reaction products (fuel blocks,
  // composites, advanced moon materials), so limiting this to manufacturing only
  // would hide most of a reaction's own drill-down chain.
  const manufacturableRows = await prisma.blueprintProduct.findMany({
    where: { typeId: { in: materialTypeIds }, activity: { in: ['manufacturing', 'reaction'] } },
    select: { typeId: true },
  })
  const manufacturable = new Set(manufacturableRows.map((r) => r.typeId))
  const materialsWithFlag = result.materials.map((m) => ({ ...m, manufacturable: manufacturable.has(m.typeId) }))

  // Sales taxes — only applied when the user configured at least one of them;
  // an unconfigured tax must never be silently assumed as 0% or omitted from
  // the response (the UI keeps showing "excludes taxes" in that case).
  const taxesConfigured = config.salesTaxPct != null || config.brokerFeePct != null
  const revenueTaxPct = taxesConfigured ? (config.salesTaxPct ?? 0) + (config.brokerFeePct ?? 0) : null
  const netRevenueListed = revenueTaxPct != null ? result.revenueListed * (1 - revenueTaxPct / 100) : null

  const jobCostTotal = jobCost?.total ?? 0
  const netProfit = (netRevenueListed ?? result.revenueListed) - result.totalMaterialCost - jobCostTotal
  const netCostBasis = result.totalMaterialCost + jobCostTotal
  const netMargin = netCostBasis > 0 ? netProfit / netCostBasis : 0

  // Build time: EVE Ref (fully bonus-adjusted incl. skills) when available, else
  // the local base×TE estimate (no structure/skill bonus — labeled). Then ISK/h
  // from the net profit. ISK/h is only trustworthy if the profit is: when a price
  // or the job cost is unknown, the number inherits that (netProfit is computed
  // from possibly-partial data), so the UI must keep the same unreliable marks.
  const buildTimeSeconds =
    everefResult?.buildTimeSeconds ?? localBuildTimeSeconds(recipe.baseTimeSeconds, runs, te)
  const buildTimeSource: 'everef' | 'local_approx' | null =
    buildTimeSeconds == null ? null : everefResult?.buildTimeSeconds != null ? 'everef' : 'local_approx'
  const iskPerHourValue = iskPerHour(netProfit, buildTimeSeconds)

  const skillMeta =
    skillLevels && skillCharacterName && config.industryCharacterId
      ? {
          characterId: config.industryCharacterId,
          characterName: skillCharacterName,
          industry: skillLevels.industry,
          advancedIndustry: skillLevels.advancedIndustry,
          capturedAt: skillLevels.capturedAt.toISOString(),
          // Skills only actually change the time when EVE Ref computed it.
          applied: buildTimeSource === 'everef',
        }
      : null

  return NextResponse.json({
    blueprintTypeId: recipe.blueprintTypeId,
    runs,
    me,
    sellHubName: sellResolved.hubName,
    activity: recipe.activity,
    rigApplied,
    rigUnavailable,
    reactorRigNote,
    factoryName: config.factory?.structureName ?? null,
    ...result,
    materials: materialsWithFlag,
    jobCost,
    jobCostSource,
    jobCostUnavailable,
    netRevenueListed,
    revenueTaxPct,
    netProfit,
    netMargin,
    buildTimeSeconds,
    buildTimeSource,
    iskPerHour: iskPerHourValue,
    skillMeta,
    ownedBlueprints: ownedBlueprintRows,
    ownedBestMe,
    ownedBestTe,
    te,
  })
})
