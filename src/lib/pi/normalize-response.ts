import type {
  PiBufferStatus,
  PiColoniesResponse,
  PiColonyAnalysis,
  PiPlanetConfigView,
  PiPinView,
} from '@/lib/pi/types'
import { enrichRoutingPinLabels } from '@/lib/pi/pin-labels'
import { classifyColonyRoleFromPinRoles } from '@/lib/pi/colony-role'
import { getCommodityTier } from '@/lib/pi/commodity-tier'
import { getPinStructureName } from '@/lib/pi/pi-static-data'

const DEFAULT_BUFFER_STATUS: PiBufferStatus = { status: 'running' }

function defaultConfig(planetId: number): PiPlanetConfigView {
  return { planetId, surplusForSale: true }
}

const DEFAULT_ROUTING = { pins: [], routes: [] }

function pinNeedsLabelMigration(pin: PiPinView): boolean {
  return !pin.structureName || !pin.label?.includes('#')
}

function migrateRoutingPinLabels(colony: PiColonyAnalysis): void {
  const routing = colony.routing
  if (!routing?.pins?.length) return
  if (!routing.pins.some(pinNeedsLabelMigration)) return

  const structureNames = new Map<number, string>()
  for (const pin of routing.pins) {
    if (!structureNames.has(pin.typeId)) {
      structureNames.set(pin.typeId, pin.structureName ?? getPinStructureName(pin.typeId))
    }
  }
  enrichRoutingPinLabels(routing, structureNames)
}

/** Re-derive commodity tiers from typeId (fixes stale cached payloads). */
function refreshCommodityTiers(colony: PiColonyAnalysis): void {
  for (const list of [colony.balances.potential, colony.balances.current]) {
    for (const balance of list) {
      balance.tier = getCommodityTier(balance.typeId)
    }
  }

  for (const route of colony.routing?.routes ?? []) {
    route.tier = getCommodityTier(route.typeId)
  }

  for (const recipe of colony.recipes) {
    for (const input of recipe.inputs) {
      input.tier = getCommodityTier(input.typeId)
    }
    recipe.output.tier = getCommodityTier(recipe.output.typeId)
  }

  for (const commodity of colony.commodities) {
    commodity.tier = getCommodityTier(commodity.typeId)
  }
}

function enrichProcessorSchematicIds(colony: PiColonyAnalysis): void {
  for (const pin of colony.routing?.pins ?? []) {
    if (pin.schematicId) continue
    if (
      pin.role !== 'basic_processor' &&
      pin.role !== 'advanced_processor' &&
      pin.role !== 'high_tech_processor'
    ) {
      continue
    }
    const recipe =
      colony.recipes.find((r) => r.pinId === pin.pinId) ??
      colony.recipes.find((r) => r.output.typeId === pin.itemTypeId && r.pinRole === pin.role)
    if (recipe) pin.schematicId = recipe.schematicId
  }
}

/** Upgrade legacy / partial colony payloads (e.g. from stale server cache) to the current shape. */
export function normalizeColonyAnalysis(colony: PiColonyAnalysis): PiColonyAnalysis {
  const legacy = colony as PiColonyAnalysis & {
    designedIskPerHour?: number
    currentIskPerHour?: number
  }

  const normalized = {
    ...colony,
    colonyRole:
      colony.colonyRole ??
      classifyColonyRoleFromPinRoles((colony.routing?.pins ?? []).map((pin) => pin.role)),
    bufferStatus: colony.bufferStatus ?? DEFAULT_BUFFER_STATUS,
    bufferStatusCurrent: colony.bufferStatusCurrent ?? colony.bufferStatus ?? DEFAULT_BUFFER_STATUS,
    pinBuffers: colony.pinBuffers ?? { potential: [], current: [] },
    config: colony.config ?? defaultConfig(colony.planetId),
    // `colony.balances ?? {...}` only guards a fully-missing `balances` — a legacy
    // cached payload where `balances` exists but uses an older shape (e.g. without
    // `potential`/`current` keys) would pass through untouched and crash
    // refreshCommodityTiers below with `for (const balance of undefined)`.
    balances: {
      potential: colony.balances?.potential ?? [],
      current: colony.balances?.current ?? [],
    },
    routing: colony.routing ?? DEFAULT_ROUTING,
    pins: colony.pins ?? [],
    potentialNetIskPerHour: colony.potentialNetIskPerHour ?? legacy.designedIskPerHour ?? 0,
    currentNetIskPerHour: colony.currentNetIskPerHour ?? legacy.currentIskPerHour ?? 0,
    potentialExportRevenuePerHour: colony.potentialExportRevenuePerHour ?? 0,
    potentialImportCostPerHour: colony.potentialImportCostPerHour ?? 0,
    currentExportRevenuePerHour: colony.currentExportRevenuePerHour ?? 0,
    currentImportCostPerHour: colony.currentImportCostPerHour ?? 0,
    potentialExportTaxPerHour: colony.potentialExportTaxPerHour ?? 0,
    potentialExportGrossPerHour: colony.potentialExportGrossPerHour ?? 0,
    currentExportTaxPerHour: colony.currentExportTaxPerHour ?? 0,
    currentExportGrossPerHour: colony.currentExportGrossPerHour ?? 0,
    exportRevenuePerHour: colony.exportRevenuePerHour ?? 0,
    importCostPerHour: colony.importCostPerHour ?? 0,
    warnings: colony.warnings ?? [],
    sourcingSuggestions: colony.sourcingSuggestions ?? [],
    commodities: colony.commodities ?? [],
    extractors: colony.extractors ?? [],
    recipes: colony.recipes ?? [],
  }

  migrateRoutingPinLabels(normalized)
  enrichProcessorSchematicIds(normalized)
  refreshCommodityTiers(normalized)
  return normalized
}

export function normalizePiColoniesResponse(
  raw: PiColoniesResponse
): PiColoniesResponse {
  const colonies = (raw.colonies ?? []).map(normalizeColonyAnalysis)
  const legacyTotals = raw.totals as PiColoniesResponse['totals'] & {
    designedIskPerHour?: number
    currentIskPerHour?: number
  }
  const totals = raw.totals ?? {
    colonyCount: colonies.length,
    potentialNetIskPerHour: 0,
    currentNetIskPerHour: 0,
  }

  return {
    colonies,
    totals: {
      colonyCount: totals.colonyCount ?? colonies.length,
      potentialNetIskPerHour:
        totals.potentialNetIskPerHour ?? legacyTotals?.designedIskPerHour ?? 0,
      currentNetIskPerHour:
        totals.currentNetIskPerHour ?? legacyTotals?.currentIskPerHour ?? 0,
      autoproduceSavingsPerHour: totals.autoproduceSavingsPerHour ?? 0,
    },
    fetchedAt: raw.fetchedAt ?? new Date().toISOString(),
    charactersWithoutScope: raw.charactersWithoutScope ?? [],
    charactersFailed: raw.charactersFailed ?? [],
    planetsFailed: raw.planetsFailed ?? [],
  }
}
