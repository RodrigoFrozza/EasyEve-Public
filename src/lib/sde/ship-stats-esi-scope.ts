/**
 * Single source of truth for which ShipStats columns we populate from ESI `universe/types`
 * and how bulk sync decides “complete enough” vs skip (avoids repeated full re-sync).
 *
 * Contract version: bump when adding/removing required fields for bulk sync.
 */
export const SHIP_STATS_SYNC_CONTRACT_VERSION = 2

export type ShipStatsSyncFieldSource = {
  /** Prisma / API field name on ShipStats */
  field: string
  /** Human-readable provenance */
  sources: string[]
}

/** Every column on ShipStats we intend to drive from sync (or explicit default). */
export const SHIP_STATS_SYNC_FIELD_MATRIX: readonly ShipStatsSyncFieldSource[] = [
  { field: 'name', sources: ['EveType.name (DB) or ESI type.name'] },
  { field: 'raceId', sources: ['ESI type.race_id'] },
  { field: 'groupId', sources: ['ESI type.group_id (fallback EveType.groupId)'] },
  { field: 'factionName', sources: ['Derived from ESI type.race_id'] },
  { field: 'groupName', sources: ['EveGroup.name via Prisma join on EveType'] },
  { field: 'highSlots', sources: ['dogma 14 (modern) or 47 (legacy)'] },
  { field: 'medSlots', sources: ['dogma 13 (modern) or 48 legacy slot count path'] },
  { field: 'lowSlots', sources: ['dogma 12 (modern) or 49 (legacy)'] },
  { field: 'rigSlots', sources: ['dogma 1137'] },
  { field: 'subsystemSlots', sources: ['dogma 1544'] },
  { field: 'cpu', sources: ['dogma 48 (modern output tf) or 19'] },
  { field: 'powerGrid', sources: ['dogma 11 (modern MW) or 21'] },
  { field: 'calibration', sources: ['dogma 1132 or 115'] },
  { field: 'capacitor', sources: ['dogma 482 or 22'] },
  { field: 'capacitorRecharge', sources: ['dogma 55 (rechargeRate) or 64 or default 280000'] },
  { field: 'shieldCapacity', sources: ['dogma 263 (shield HP pool)'] },
  { field: 'armorHP', sources: ['dogma 265'] },
  { field: 'hullHP', sources: ['dogma 9'] },
  { field: 'shieldEmResist', sources: ['dogma 271 resonance 0–1'] },
  { field: 'shieldExpResist', sources: ['dogma 272'] },
  { field: 'shieldKinResist', sources: ['dogma 273'] },
  { field: 'shieldThermResist', sources: ['dogma 274'] },
  { field: 'armorEmResist', sources: ['dogma 267'] },
  { field: 'armorExpResist', sources: ['dogma 268'] },
  { field: 'armorKinResist', sources: ['dogma 269'] },
  { field: 'armorThermResist', sources: ['dogma 270'] },
  { field: 'hullEmResist', sources: ['dogma 113 structure'] },
  { field: 'hullThermResist', sources: ['dogma 110'] },
  { field: 'hullKinResist', sources: ['dogma 109'] },
  { field: 'hullExpResist', sources: ['dogma 111'] },
  { field: 'maxVelocity', sources: ['dogma 37'] },
  { field: 'agility', sources: ['dogma 70'] },
  { field: 'mass', sources: ['dogma 4'] },
  { field: 'warpSpeed', sources: ['dogma 600 (AU/s mult) or 30'] },
  {
    field: 'alignTime',
    sources: ['Derived: mass*agility/500000*0.6931 (same baseline as dogma-calculator)']
  },
  { field: 'droneBay', sources: ['dogma 283 (m³)'] },
  { field: 'droneBandwidth', sources: ['dogma 1271 (Mbit/s)'] },
  { field: 'cargo', sources: ['ESI type.capacity (m³) merged as dogma slot 5 for storage'] },
  { field: 'maxLockedTargets', sources: ['dogma 154'] },
  { field: 'maxTargetRange', sources: ['dogma 76'] },
  { field: 'signatureRadius', sources: ['dogma 552'] },
  { field: 'scanResolution', sources: ['dogma 310'] },
  { field: 'sensorStrength', sources: ['max of dogma 208/209/210/211'] },
  { field: 'sensorType', sources: ['Argmax of sensor strengths'] },
  { field: 'scanRange', sources: ['default 0 (legacy UI)'] },
  { field: 'scanResolving', sources: ['default 0 (legacy UI)'] },
  { field: 'turretHardpoints', sources: ['dogma 102 or 1024'] },
  { field: 'launcherHardpoints', sources: ['dogma 101 or 1025'] },
  { field: 'restrictions', sources: ['JSON { rigSize } from dogma 1547'] },
  { field: 'traits', sources: ['ESI type.traits via getShipTraits (separate write)'] },
  { field: 'dogmaAttributes', sources: ['Full dogma map persisted to ShipDogmaAttribute'] }
] as const

export function factionNameFromRaceId(raceId: number | null | undefined): string {
  if (raceId == null) return 'Unknown'
  if (raceId === 1) return 'Caldari'
  if (raceId === 2) return 'Minmatar'
  if (raceId === 4) return 'Amarr'
  if (raceId === 8) return 'Gallente'
  if (raceId === 3) return 'ORE'
  if (raceId === 135 || raceId === 134) return 'Triglavian'
  return 'Unknown'
}

/** Baseline align time (s); matches `dogma-calculator` post-trait formula for empty fit. */
export function computeAlignTimeSeconds(mass: number, agility: number): number {
  if (!mass || !agility) return 0
  return (mass * agility) / 500000 * 0.6931
}

export type ShipStatsLike = {
  highSlots?: number
  medSlots?: number
  lowSlots?: number
  subsystemSlots?: number
  cpu?: number
  powerGrid?: number
  mass?: number
  agility?: number
  factionName?: string
  raceId?: number | null
  groupId?: number | null
}

const SLOTLESS_ALLOWED_GROUP_IDS = new Set<number>([
  29, // Capsule
  31, // Shuttle
])
const SLOTLESS_ALLOWED_TYPE_IDS = new Set<number>([
  29984, // Tengu (base hull depends on subsystems for slot profile)
  29986, // Legion
  29988, // Proteus
  29990, // Loki
])
const CPU_GRID_OPTIONAL_TYPE_IDS = new Set<number>([
  2078, // Zephyr
  3532, // Echelon
])
const RACE_OPTIONAL_TYPE_IDS = new Set<number>([
  34496, // Council Diplomatic Shuttle
  44993, // Pacifier
  44995, // Enforcer
  44996, // Marshal
  85062, // Sidewinder
  85229, // Cobra
  85236, // Python
])

export function isSlotExceptionAllowed(u: ShipStatsLike, typeId?: number): boolean {
  if ((u.subsystemSlots ?? 0) > 0) return true
  if (typeId != null && SLOTLESS_ALLOWED_TYPE_IDS.has(typeId)) return true
  if (u.groupId != null && SLOTLESS_ALLOWED_GROUP_IDS.has(u.groupId)) return true
  return false
}

function isCpuPowerExceptionAllowed(typeId: number): boolean {
  return CPU_GRID_OPTIONAL_TYPE_IDS.has(typeId)
}

function isRaceExceptionAllowed(typeId: number, u: ShipStatsLike): boolean {
  if (RACE_OPTIONAL_TYPE_IDS.has(typeId)) return true
  return u.factionName?.toLowerCase() === 'concord'
}

/**
 * Returns human reasons if this row should NOT be committed during a “full scope” bulk sync.
 * Strict on hull identity + layout + mass model; zeros for drones/cargo are acceptable.
 */
export function listBulkSyncBlockingGaps(
  typeId: number,
  shipName: string,
  u: ShipStatsLike,
  ctx: { hasGroupName: boolean }
): string[] {
  const missing: string[] = []
  const slots = (u.highSlots ?? 0) + (u.medSlots ?? 0) + (u.lowSlots ?? 0)
  if (slots <= 0 && !isSlotExceptionAllowed(u, typeId)) missing.push('slots')
  if (!(u.cpu! > 0) && !(u.powerGrid! > 0) && !isCpuPowerExceptionAllowed(typeId)) missing.push('cpu_or_powerGrid')
  if (!(u.mass! > 0)) missing.push('mass')
  if (!(u.agility! > 0)) missing.push('agility')
  if (u.raceId == null && !isRaceExceptionAllowed(typeId, u)) missing.push('raceId')
  if (u.groupId == null) missing.push('groupId')
  if (!ctx.hasGroupName) missing.push('groupName')
  if (!shipName?.trim()) missing.push('name')
  return missing
}
