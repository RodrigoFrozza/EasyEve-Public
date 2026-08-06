export type HubKind = 'region' | 'structure'

export interface IndustryHub {
  kind: HubKind
  /** regionId (as string) for 'region', structureId for 'structure'. */
  id: string
  name: string
}

/** EVE Ref industry-cost security classes. */
export type StructureSecurity = 'HIGH_SEC' | 'LOW_SEC' | 'NULL_SEC'

export interface FactoryRig {
  typeId: number
  name: string
}

/**
 * The manufacturing facility, entered manually (ESI doesn't expose a structure's
 * rigs). Feeds EVE Ref's industry-cost API to get rig/security-adjusted material
 * quantities. structureTypeId omitted => NPC station (no bonuses).
 */
export interface FactoryConfig {
  structureTypeId: number | null
  structureName: string
  rigs: FactoryRig[]
  security: StructureSecurity
  /** Manufacturing solar system for job-cost system cost index (null = not configured, job cost excluded). */
  solarSystemId: number | null
  solarSystemName: string
  /** Structure facility tax, percent (e.g. 1 = 1%). User-entered — ESI doesn't expose it. Default 0. */
  facilityTaxPct: number
}

export interface IndustryConfigData {
  /** Hubs whose prices are compared when buying input materials. */
  buyHubs: IndustryHub[]
  /** Where the produced output is valued for sale (null = same as first buy hub). */
  sellHub: IndustryHub | null
  defaultMe: number
  /** Manufacturing facility for rig/ME material adjustments (null = NPC station). */
  factory: FactoryConfig | null
  /**
   * Structures whose order books the "what to produce" scanner sweeps for market
   * deficits (manufacturable items in short supply). Structures only — scanning a
   * whole NPC region's order book is too heavy.
   */
  monitoredStations: IndustryHub[]
  /** Sales tax percent (e.g. 2.25 = 2.25%). Null = not configured — never applied silently. */
  salesTaxPct: number | null
  /** Broker fee percent. Null = not configured — never applied silently. */
  brokerFeePct: number | null
  /**
   * Character whose Industry/Advanced Industry skills feed the build-time (ISK/h)
   * calculation. Null = no skill bonus applied (labeled). Read from that
   * character's profile snapshot, which can be stale/absent — the UI surfaces
   * freshness.
   */
  industryCharacterId: number | null
}
