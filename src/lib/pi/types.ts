import type { PiCommodityTier, PiPinRole } from '@/lib/pi/pi-static-data'
import type { PiCommodityBalance } from '@/lib/pi/demand-model'
import type { PiBufferStatus, PiBufferStatusKind, PiPinNode } from '@/lib/pi/buffer-sim'
import type { PiGridUsage } from '@/lib/pi/pi-grid'

export interface PiExtractorHead {
  head_id: number
  latitude: number
  longitude: number
}

export interface PiExtractorDetails {
  cycle_time?: number
  head_radius?: number
  heads?: PiExtractorHead[]
  product_type_id?: number
  qty_per_cycle?: number
}

export interface PiFactoryDetails {
  schematic_id?: number
}

export interface PiPin {
  pin_id: number
  type_id: number
  latitude?: number
  longitude?: number
  schematic_id?: number
  install_time?: string
  expiry_time?: string
  last_cycle_start?: string
  extractor_details?: PiExtractorDetails
  factory_details?: PiFactoryDetails
  contents?: Array<{ type_id: number; amount: number }>
}

export interface PiRoute {
  route_id: number
  source_pin_id: number
  destination_pin_id: number
  content_type_id: number
  quantity: number
  waypoints?: Array<{ order: number; pin_id: number }>
}

export interface PiLink {
  source_pin_id: number
  destination_pin_id: number
  link_level?: number
}

export type PiColonyRole = 'integrated' | 'factory_only' | 'extraction_only' | 'unknown'

export interface PiColonyLayout {
  pins: PiPin[]
  routes: PiRoute[]
  links: PiLink[]
}

export interface PiColonySummary {
  last_update?: string
  num_pins?: number
  owner_id: number
  planet_id: number
  planet_type: string
  solar_system_id: number
  upgrade_level?: number
}

export interface PiPlanetConfigView {
  planetId: number
  surplusForSale: boolean
}

export interface PiRecipeView {
  schematicId: number
  name: string
  cycleTimeSec: number
  pinId: number
  pinRole: PiPinRole
  inputs: Array<{ typeId: number; name: string; qty: number; tier?: PiCommodityTier }>
  output: { typeId: number; name: string; qty: number; tier?: PiCommodityTier }
  designedOutputPerHour: number
}

export interface PiCommodityFlow {
  typeId: number
  name: string
  tier?: PiCommodityTier
  extractedPerHour?: number
  producedPerHour?: number
  usedInternallyPerHour?: number
  exportedPerHour?: number
  importNeededPerHour?: number
  surplusPerHour?: number
  wastedPerHour?: number
  potentialExportedPerHour?: number
  currentExportedPerHour?: number
  role: 'extracted' | 'produced' | 'internal' | 'exported' | 'imported' | 'surplus' | 'wasted'
}

export interface PiExtractorView {
  pinId: number
  productTypeId: number
  productName: string
  qtyPerCycle: number
  cycleTimeSec: number
  installTime?: string
  expiryTime?: string
  isExpired: boolean
  designedUnitsPerHour: number
  currentUnitsPerHour: number
  /** Jita sell (or configured export price) per unit of extracted product. */
  productUnitPrice?: number
  /** ISK/h regained by resurveying when current output is below designed. */
  resurveyIskPerHour?: number
}

export type PiRouteEdgeKind =
  | 'extractorToFactory'
  | 'factoryToFactory'
  | 'toExportStore'
  | 'fromStoreToFactory'
  | 'extractorToStore'
  | 'other'

export interface PiPinView {
  pinId: number
  typeId: number
  role: PiPinRole
  roleIndex: number
  /** EVE structure type name (e.g. Basic Industry Facility) */
  structureName: string
  /** Display label: structure name + ESI pin id */
  label: string
  itemTypeId?: number
  itemName?: string
  schematicId?: number
}

export interface PiRouteView {
  routeId: number
  sourcePinId: number
  destPinId: number
  typeId: number
  name: string
  tier?: PiCommodityTier
  quantity: number
  kind: PiRouteEdgeKind
}

export interface PiRoutingView {
  pins: PiPinView[]
  routes: PiRouteView[]
}

export interface PiPinCommodityFlow {
  typeId: number
  name: string
  /**
   * Estoque usado nos cálculos: projetado até agora quando o motor de projeção
   * está ligado (= `amountMeasured` quando a flag está OFF ou o elapsed é 0).
   */
  amount: number
  /** Estoque cru do snapshot da ESI, sem projeção. */
  amountMeasured: number
  /** true quando `amount` foi avançado além do snapshot (`amount !== amountMeasured`). */
  projected: boolean
  inPerHour: number
  outPerHour: number
  netPerHour: number
  timeToEmptyHrs?: number
}

export interface PiPinBufferStatus {
  pinId: number
  typeId: number
  role: 'storage' | 'launchpad' | 'command_center'
  label: string
  capacityM3: number
  usedM3: number
  freeM3: number
  flows: PiPinCommodityFlow[]
  timeToFullHrs?: number
  timeToEmptyHrs?: number
  limitingEmptyTypeId?: number
  /**
   * Fase B1 — horizonte de reposição (cadência − idade do snapshot) de um buffer
   * só-import que está no ritmo. Presente no lugar do falso "vazio"; a UI mostra
   * "reabastecer em Xh". undefined quando não se aplica.
   */
  restockDueHrs?: number
  status: PiBufferStatusKind
}

export interface PiColonyAnalysis {
  characterId: number
  characterName: string
  planetId: number
  planetType: string
  planetTypeLabel: string
  /** Celestial name from ESI (e.g. WE-KK2 II). */
  planetName?: string
  /** Colony specialization: integrated chain, factory-only, or extraction-only. */
  colonyRole: PiColonyRole
  solarSystemId: number
  solarSystemName: string
  upgradeLevel: number
  numPins: number
  lastUpdate?: string
  isStale: boolean
  /**
   * Motor de projeção ativo para este usuário (Fase A). Quando true, os buffers
   * carregam estoque projetado e a UI mostra o selo de idade. undefined/false =
   * comportamento atual (sem projeção, sem selo).
   */
  projectionEnabled?: boolean
  entryTypeId?: number
  entryName?: string
  entryTier?: PiCommodityTier
  exitTypeId?: number
  exitName?: string
  exitTier?: PiCommodityTier
  potentialNetIskPerHour: number
  currentNetIskPerHour: number
  exportRevenuePerHour: number
  importCostPerHour: number
  potentialExportRevenuePerHour: number
  potentialImportCostPerHour: number
  currentExportRevenuePerHour: number
  currentImportCostPerHour: number
  // Real customs tax / gross export per mode (base-value taxed). Optional so the
  // many places that construct a bare analysis need not set them; consumers read
  // them via rate-mode helpers with a 0 fallback. Populated by applyColonyPricing.
  potentialExportTaxPerHour?: number
  potentialExportGrossPerHour?: number
  currentExportTaxPerHour?: number
  currentExportGrossPerHour?: number
  exitUnitPrice: number
  config: PiPlanetConfigView
  balances: {
    potential: PiCommodityBalance[]
    current: PiCommodityBalance[]
  }
  pins: PiPinNode[]
  bufferStatus: PiBufferStatus
  bufferStatusCurrent: PiBufferStatus
  pinBuffers: {
    potential: PiPinBufferStatus[]
    current: PiPinBufferStatus[]
  }
  extractors: PiExtractorView[]
  recipes: PiRecipeView[]
  commodities: PiCommodityFlow[]
  routing: PiRoutingView
  warnings: string[]
  /** Advisory autoproduce-vs-buy opportunities (margin-based, non-forced). */
  sourcingSuggestions?: string[]
  /** CPU / Powergrid utilization vs the Command Center budget (ESI-sourced, excludes links). */
  grid?: PiGridUsage
}

export interface PiColoniesResponse {
  colonies: PiColonyAnalysis[]
  totals: {
    colonyCount: number
    potentialNetIskPerHour: number
    currentNetIskPerHour: number
    /** Informational: ISK/h saveable by following the autoproduce suggestions. */
    autoproduceSavingsPerHour?: number
  }
  fetchedAt: string
  charactersWithoutScope: number[]
  /** Character IDs whose planet list could not be fetched from ESI this run (data below is incomplete). */
  charactersFailed: number[]
  /** Planets whose colony layout could not be fetched from ESI this run (data below is incomplete). */
  planetsFailed: Array<{ characterId: number; planetId: number }>
}

export type { PiCommodityBalance, PiBufferStatus, PiBufferStatusKind, PiPinNode }
