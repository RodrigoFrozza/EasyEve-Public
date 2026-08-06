import { getColonyLayout, getCharacterPlanets } from '@/lib/pi/esi-pi'
import { loadPiUserConfig } from '@/lib/pi/pi-config-store'
import { resolvePlanetNames } from '@/lib/pi/planet-names'
import {
  analyzeColonyLayout,
  applyColonyPricing,
  collectColonyTypeIds,
} from '@/lib/pi/production-graph'
import { computePortfolioTotals } from '@/lib/pi/portfolio-attribution'
import { enrichColonyRoutingLabels, resolvePinStructureNames } from '@/lib/pi/pin-labels'
import type {
  PiColoniesResponse,
  PiColonyAnalysis,
  PiColonyLayout,
  PiColonySummary,
  PiPlanetConfigView,
} from '@/lib/pi/types'
import {
  getRegionalMarketDepth,
  getJitaPricesPersistent,
  fillFromOrders,
  type MarketDepth,
} from '@/lib/market-prices'
import { JITA_REGION_ID } from '@/lib/constants/market'
import { composePriceMap } from '@/lib/pi/price-resolver'
import { getStructureMarketDepth } from '@/lib/pi/structure-market'
import { loadReferencePrices } from '@/lib/pi/reference-prices'
import { evaluateAutoproduce, sumAutoproduceSavingsPerHour } from '@/lib/pi/autoproduce-advisor'
import { isProjectionEnabledFor } from '@/lib/pi/project-forward'
import type { PiPriceMap, PiPricingMode } from '@/lib/pi/pi-pricing'
import { resolveSolarSystemNames } from '@/lib/mining-system-names'
import { parseScopesFromJwt } from '@/lib/utils'
import { logger } from '@/lib/server-logger'
import { safeDecryptToken } from '@/lib/crypto/token-cipher'

const PI_SCOPE = 'esi-planets.manage_planets.v1'

interface PendingColony {
  characterId: number
  characterName: string
  summary: PiColonySummary
  layout: PiColonyLayout
}

export interface FetchPiColoniesInput {
  userId: string
  characters: Array<{ id: number; name: string; accessToken?: string | null }>
  characterIdFilter?: number
  forceRefresh?: boolean
}

/** @deprecated Use computePortfolioTotals from portfolio-attribution */
export { computePortfolioTotals } from '@/lib/pi/portfolio-attribution'

/**
 * Flag imported commodities whose local market can't sustain the colony's demand
 * and turn it into an actionable call: if the market can't supply the ready
 * product but CAN supply its inputs, self-produce it (the 210-Neocoms case);
 * if the inputs are the thin side, buy it ready; if neither, source elsewhere.
 * Pure margin optimisation lives in a dedicated advisor panel, not here.
 */
function collectMarketStockWarnings(
  colony: PiColonyAnalysis,
  priceMap: PiPriceMap,
  depth: Record<number, MarketDepth>,
  mode: PiPricingMode
): string[] {
  const warnings: string[] = []
  for (const b of colony.balances.potential) {
    if (b.importNeededPerHour <= 0) continue
    const dailyNeed = b.importNeededPerHour * 24
    const decision = evaluateAutoproduce(b.typeId, b.importNeededPerHour, priceMap, depth, mode)

    if (decision?.recommendation === 'autoproduce_forced') {
      warnings.push(`Market can't supply ${b.name} — self-produce it from its inputs`)
      continue
    }
    if (decision?.recommendation === 'buy_forced') {
      warnings.push(`Buy ${b.name} ready — the local market is short on its inputs`)
      continue
    }

    // Raw commodity (no schematic) or both sides fine: plain stock check.
    const fill = fillFromOrders(depth[b.typeId]?.sell ?? [], dailyNeed)
    if (!fill.sufficient) {
      warnings.push(
        `Low market stock for ${b.name}: ~${Math.round(fill.filledQty)} on market vs ~${Math.round(dailyNeed)}/day needed — self-produce or import`
      )
    }
  }
  return warnings
}

/**
 * Advisory (non-forced) sourcing opportunities: imported intermediates the
 * colony currently buys but would be cheaper to self-produce from their inputs.
 */
function collectSourcingSuggestions(
  colony: PiColonyAnalysis,
  priceMap: PiPriceMap,
  depth: Record<number, MarketDepth>,
  mode: PiPricingMode
): string[] {
  const suggestions: string[] = []
  for (const b of colony.balances.potential) {
    if (b.importNeededPerHour <= 0) continue
    const decision = evaluateAutoproduce(b.typeId, b.importNeededPerHour, priceMap, depth, mode)
    if (decision?.recommendation === 'autoproduce' && decision.savingsPerUnit > 0) {
      suggestions.push(
        `Self-produce ${b.name}: saves ~${Math.round(decision.savingsPerUnit).toLocaleString()} ISK/unit vs buying ready`
      )
    }
  }
  return suggestions
}

export async function fetchAndAnalyzePiColonies(
  input: FetchPiColoniesInput
): Promise<PiColoniesResponse> {
  const characters = input.characterIdFilter
    ? input.characters.filter((c) => c.id === input.characterIdFilter)
    : input.characters

  const { configs, preferences } = await loadPiUserConfig(input.userId)

  const colonies: PiColonyAnalysis[] = []
  const charactersWithoutScope: number[] = []
  const charactersFailed: number[] = []
  const planetsFailed: Array<{ characterId: number; planetId: number }> = []
  const systemIds = new Set<number>()
  const planetIds: number[] = []
  const pendingColonies: PendingColony[] = []

  await Promise.all(
    characters.map(async (character) => {
      const scopes = parseScopesFromJwt(safeDecryptToken(character.accessToken) ?? '')
      if (!scopes.includes(PI_SCOPE)) {
        charactersWithoutScope.push(character.id)
        return
      }

      let planetSummaries
      try {
        planetSummaries = await getCharacterPlanets(character.id, input.userId, {
          forceRefresh: input.forceRefresh,
        })
      } catch (error) {
        logger.warn('PI', `Skipping character ${character.id} — planets fetch failed`, error)
        charactersFailed.push(character.id)
        return
      }

      for (const summary of planetSummaries) {
        systemIds.add(summary.solar_system_id)
        planetIds.push(summary.planet_id)
      }

      const layoutResults = await Promise.all(
        planetSummaries.map(async (summary) => {
          try {
            const layout = await getColonyLayout(
              character.id,
              summary.planet_id,
              input.userId,
              { forceRefresh: input.forceRefresh },
              summary.last_update
            )
            if (!layout) return null

            return {
              characterId: character.id,
              characterName: character.name,
              summary,
              layout,
            }
          } catch (error) {
            logger.warn(
              'PI',
              `Skipping planet ${summary.planet_id} for character ${character.id}`,
              error
            )
            planetsFailed.push({ characterId: character.id, planetId: summary.planet_id })
            return null
          }
        })
      )

      for (const result of layoutResults) {
        if (result) pendingColonies.push(result)
      }
    })
  )

  // Each colony is standalone now — map its config by planetId, defaulting the
  // rest to surplus-for-sale.
  const configMap = new Map<number, PiPlanetConfigView>()
  for (const planetId of planetIds) {
    configMap.set(planetId, { planetId, surplusForSale: true })
  }
  for (const cfg of configs) {
    configMap.set(cfg.planetId, cfg)
  }

  // Motor de projeção (Fase A) atrás da flag `pi_projection_engine` (env
  // PI_PROJECTION_ENGINE). Resolvida uma vez aqui, onde o userId existe, e
  // passada como boolean simples adiante — rollout "só para o Rodrigo primeiro"
  // via allowlist de userId. Ausente/off = comportamento atual, byte a byte.
  const projectionEnabled = isProjectionEnabledFor(
    process.env.PI_PROJECTION_ENGINE,
    input.userId
  )
  // Hub sourcing por preço (c503a29d) atrás da flag PI_HUB_SOURCING, mesmo padrão
  // e mesmo parser de allowlist da projeção (função genérica de env+userId).
  // Ausente/off = comportamento pré-c503a29d (primeiro hub com book), byte a byte.
  const hubSourcingEnabled = isProjectionEnabledFor(
    process.env.PI_HUB_SOURCING,
    input.userId
  )

  for (const pending of pendingColonies) {
    const planetConfig = configMap.get(pending.summary.planet_id) ?? {
      planetId: pending.summary.planet_id,
      surplusForSale: true,
    }

    colonies.push(
      analyzeColonyLayout({
        characterId: pending.characterId,
        characterName: pending.characterName,
        summary: pending.summary,
        layout: pending.layout,
        solarSystemName: `System ${pending.summary.solar_system_id}`,
        config: planetConfig,
        visitCadenceHrs: preferences.visitCadenceHrs ?? undefined,
        projectionEnabled,
      })
    )
  }

  // Every lookup below (pin/system/planet names, region depth, Jita fallback,
  // structure depths, reference prices) reads only `colonies`/`preferences`/`input`
  // — none of them depend on each other's result. They used to run as a serial
  // await chain, which SUMS their latencies instead of taking the slowest one;
  // that chain was the main cause of a slow cold-cache PI page load. Computing
  // their (cheap, synchronous) inputs up front lets them all run in one
  // Promise.all instead.
  const pinStructureTypeIds = [
    ...new Set(colonies.flatMap((c) => c.routing.pins.map((p) => p.typeId))),
  ]
  const allTypeIds = Array.from(new Set(colonies.flatMap(collectColonyTypeIds)))
  // Price from the player's configured home-region order book (real local market);
  // fall back to Jita for users who haven't set one, so their numbers are unchanged.
  const regionId = preferences.homeRegionId ?? JITA_REGION_ID
  const isRegionJita = regionId === JITA_REGION_ID
  // Optional private-structure markets (opt-in). Docking/market access to a
  // structure is per-character, so try every character on the account — any
  // total failure returns {} so pricing falls back to region/Jita.
  const structAccessCharIds = input.characters.map((c) => c.id)

  const [
    pinStructureNames,
    systemNames,
    planetNames,
    depth,
    jitaFallback,
    buyStructureDepth,
    secondaryStructureDepth,
    sellStructureDepth,
    referencePrices,
  ] = await Promise.all([
    resolvePinStructureNames(pinStructureTypeIds),
    resolveSolarSystemNames([...systemIds]),
    resolvePlanetNames([...new Set(planetIds)]),
    getRegionalMarketDepth(regionId, allTypeIds),
    // If the chosen region has no orders for some (or all) commodities — a quiet
    // null-sec region, or a mistyped/invalid id — fall back to Jita PER COMMODITY
    // so prices never collapse to 0 and zero out every colony's NET.
    isRegionJita ? Promise.resolve(null) : getJitaPricesPersistent(allTypeIds),
    preferences.buyStructureId && structAccessCharIds.length > 0
      ? getStructureMarketDepth(preferences.buyStructureId, structAccessCharIds, allTypeIds)
      : Promise.resolve(null),
    // Secondary buy structure — now a real buy candidate in the P&L, not just a
    // Shopping List display column.
    preferences.buyStructureId2 && structAccessCharIds.length > 0
      ? getStructureMarketDepth(preferences.buyStructureId2, structAccessCharIds, allTypeIds)
      : Promise.resolve(null),
    preferences.sellSource === 'structure' && preferences.sellStructureId && structAccessCharIds.length > 0
      ? getStructureMarketDepth(preferences.sellStructureId, structAccessCharIds, allTypeIds)
      : Promise.resolve(null),
    loadReferencePrices(input.userId, allTypeIds),
  ])

  for (const colony of colonies) {
    enrichColonyRoutingLabels(colony, pinStructureNames)
  }
  for (const colony of colonies) {
    colony.solarSystemName =
      systemNames[colony.solarSystemId] ?? `System ${colony.solarSystemId}`
    colony.planetName = planetNames[colony.planetId]
  }

  // Scalar Jita buy/sell per type — from the persistent fallback, or the region
  // book itself when the region already is Jita.
  const jita: Record<number, { buy: number; sell: number }> = {}
  for (const id of allTypeIds) {
    if (jitaFallback?.[id]) {
      jita[id] = { buy: jitaFallback[id]!.buy, sell: jitaFallback[id]!.sell }
    } else if (isRegionJita) {
      const d = depth[id]
      jita[id] = { buy: d?.buy[0]?.price ?? 0, sell: d?.sell[0]?.price ?? 0 }
    }
  }

  // Aggregate the whole portfolio's demand/supply per commodity so the
  // pessimistic (instant) price reflects how far each buy/sell walks the book.
  const importDemandByType = new Map<number, number>()
  const exportSupplyByType = new Map<number, number>()
  for (const c of colonies) {
    for (const b of c.balances.potential) {
      if (b.importNeededPerHour > 0) {
        importDemandByType.set(
          b.typeId,
          (importDemandByType.get(b.typeId) ?? 0) + b.importNeededPerHour
        )
      }
      if (b.exportedPerHour > 0) {
        exportSupplyByType.set(
          b.typeId,
          (exportSupplyByType.get(b.typeId) ?? 0) + b.exportedPerHour
        )
      }
    }
  }

  const { priceMap, provenance } = composePriceMap(
    allTypeIds,
    {
      regionDepth: depth,
      jita,
      buyStructureDepth,
      secondaryStructureDepth,
      sellStructureDepth,
      sellSource: preferences.sellSource,
      referencePrices,
    },
    importDemandByType,
    exportSupplyByType,
    hubSourcingEnabled
  )

  const pricedColonies = colonies.map((c) => {
    const priced = applyColonyPricing(c, priceMap, {
      exportTaxRate: preferences.exportTaxRate,
      importTaxRate: preferences.importTaxRate ?? undefined,
      pricingMode: preferences.pricingMode,
      provenance,
    })
    const stockWarnings = collectMarketStockWarnings(priced, priceMap, depth, preferences.pricingMode)
    const sourcingSuggestions = collectSourcingSuggestions(priced, priceMap, depth, preferences.pricingMode)
    return {
      ...priced,
      warnings:
        stockWarnings.length > 0 ? [...priced.warnings, ...stockWarnings] : priced.warnings,
      sourcingSuggestions,
    }
  })
  pricedColonies.sort(
    (a, b) =>
      b.currentNetIskPerHour - a.currentNetIskPerHour ||
      b.potentialNetIskPerHour - a.potentialNetIskPerHour ||
      a.solarSystemName.localeCompare(b.solarSystemName)
  )

  const portfolioTotals = computePortfolioTotals(pricedColonies)

  return {
    colonies: pricedColonies,
    totals: {
      colonyCount: pricedColonies.length,
      potentialNetIskPerHour: portfolioTotals.potentialNetIskPerHour,
      currentNetIskPerHour: portfolioTotals.currentNetIskPerHour,
      autoproduceSavingsPerHour: sumAutoproduceSavingsPerHour(
        pricedColonies,
        priceMap,
        depth,
        preferences.pricingMode
      ),
    },
    fetchedAt: new Date().toISOString(),
    charactersWithoutScope,
    charactersFailed,
    planetsFailed,
  }
}
