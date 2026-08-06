// Ship Dogma Attributes Sync
// Sincroniza atributos dogma das naves da ESI para o banco de dados

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'
import {
  SHIP_STATS_SYNC_CONTRACT_VERSION,
  computeAlignTimeSeconds,
  factionNameFromRaceId,
  isSlotExceptionAllowed,
  listBulkSyncBlockingGaps
} from '@/lib/sde/ship-stats-esi-scope'
import type { IdentitySource } from '@/lib/sde/type-identity-external'
import {
  asNullableInt,
  fetchAdam4EveTypeIdentity,
  fetchEverefTypeIdentity,
} from '@/lib/sde/type-identity-external'
import {
  SHIP_DOGMA_ATTRIBUTE_IDS as A,
  SHIP_DOGMA_ATTRIBUTE_NAMES,
} from '@/lib/sde/dogma-attribute-ids'

/** @deprecated Use SHIP_DOGMA_ATTRIBUTE_NAMES from `@/lib/sde/dogma-attribute-ids` */
export const DOGMA_ATTRIBUTE_NAMES = SHIP_DOGMA_ATTRIBUTE_NAMES

// Memory-limited cache for rate limiting
const CACHE_TTL = 60 * 60 * 1000 // 1 hora
const CACHE_LIMIT = 1000
const requestCache = new Map<string, { data: any; timestamp: number }>()

function setCache(key: string, value: any) {
  if (requestCache.size >= CACHE_LIMIT) {
    const firstKey = requestCache.keys().next().value
    if (firstKey) requestCache.delete(firstKey)
  }
  requestCache.set(key, { data: value, timestamp: Date.now() })
}

async function fetchWithCache<T>(url: string): Promise<T | null> {
  const cached = requestCache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  
  try {
    const res = await esiClient.get(url)
    const data = res.data
    setCache(url, data)
    return data as T
  } catch (error) {
    logger.error('ShipSync', `ESI request error for ${url}`, { error })
    return null
  }
}

/** Raw ESI `universe/types/{id}/` payload fields we read besides dogma_attributes. */
export type EsiUniverseTypePayload = {
  name?: string
  capacity?: number
  race_id?: number | null
  group_id?: number | null
  dogma_attributes?: Array<{ attribute_id: number; value: number }>
}

type ShipIdentityResolution = {
  raceId: number | null
  groupId: number | null
  groupName: string | null
  factionName: string
  raceSource: IdentitySource
  groupSource: IdentitySource
  qualityWarning?: string
}

function fallbackFactionNameFromFactionId(factionId: number | null | undefined): string {
  if (factionId == null) return 'Unknown'
  if (factionId === 500001) return 'Caldari'
  if (factionId === 500002) return 'Minmatar'
  if (factionId === 500003) return 'Amarr'
  if (factionId === 500004) return 'Gallente'
  if (factionId === 500005) return 'Jove'
  if (factionId === 500006) return 'CONCORD'
  if (factionId === 500007) return "Sansha's Nation"
  if (factionId === 500010) return 'Guristas'
  if (factionId === 500011) return 'Angel'
  if (factionId === 500012) return 'Blood Raider'
  if (factionId === 500018) return 'ORE'
  if (factionId === 500019) return 'Mordu'
  if (factionId === 500020) return 'Serpentis'
  if (factionId === 500026) return 'Sisters of EVE'
  if (factionId === 500027) return 'Deathless Circle'
  if (factionId === 500028) return 'EDENCOM'
  if (factionId === 500029) return 'Triglavian'
  return 'Unknown'
}

/** Single cached fetch: dogma map + type identity fields (race/group/capacity). */
export async function fetchShipTypeFromEsi(typeId: number): Promise<{
  attrs: Record<number, number>
  type: EsiUniverseTypePayload | null
}> {
  const attrs: Record<number, number> = {}
  let typeData: EsiUniverseTypePayload | null = null
  try {
    typeData = (await fetchWithCache<EsiUniverseTypePayload>(
      `/universe/types/${typeId}/`
    )) as EsiUniverseTypePayload | null

    if (typeData?.dogma_attributes) {
      for (const attr of typeData.dogma_attributes) {
        attrs[attr.attribute_id] = attr.value
      }
    }
    if (typeData && typeof typeData.capacity === 'number') {
      attrs[A.capacity] = typeData.capacity
    }
  } catch (error) {
    logger.error('ShipSync', `Error fetching type ${typeId}`, { error, typeId })
  }

  return { attrs, type: typeData }
}

// ESI returns an array of { attribute_id, value }
export async function getShipDogmaAttributes(typeId: number): Promise<Record<number, number>> {
  const { attrs } = await fetchShipTypeFromEsi(typeId)
  return attrs
}

export interface EsiTrait {
  bonus?: number
  bonus_text?: string
  unit_id?: number
}

export interface EsiTraitsResponse {
  types?: Array<{
    type_id: number
    traits: EsiTrait[]
  }>
  role_traits?: EsiTrait[]
}

export async function getShipTraits(typeId: number): Promise<EsiTraitsResponse | null> {
  try {
    const typeData = await fetchWithCache<any>(
      `/universe/types/${typeId}/`
    )
    return typeData?.traits || null
  } catch (error) {
    logger.error('ShipSync', `Error fetching traits for ${typeId}`, { error, typeId })
    return null
  }
}

// Alternative function that uses hardcoded data for some popular ships
// This is a fallback until we have the complete SDE
export async function getShipDogmaAttributesFromCache(typeId: number): Promise<Record<number, number> | null> {
  return null // Will be implemented when we have the SDE
}

export interface ShipStatsUpdate {
  raceId?: number | null
  groupId?: number | null
  factionName?: string
  groupName?: string
  cpu?: number
  powerGrid?: number
  calibration?: number
  highSlots?: number
  medSlots?: number
  lowSlots?: number
  rigSlots?: number
  subsystemSlots?: number
  capacitor?: number
  capacitorRecharge?: number
  shieldCapacity?: number
  armorHP?: number
  hullHP?: number
  shieldEmResist?: number
  shieldExpResist?: number
  shieldKinResist?: number
  shieldThermResist?: number
  armorEmResist?: number
  armorExpResist?: number
  armorKinResist?: number
  armorThermResist?: number
  hullEmResist?: number
  hullExpResist?: number
  hullKinResist?: number
  hullThermResist?: number
  maxVelocity?: number
  agility?: number
  mass?: number
  warpSpeed?: number
  alignTime?: number
  droneBay?: number
  droneBandwidth?: number
  cargo?: number
  maxLockedTargets?: number
  maxTargetRange?: number
  signatureRadius?: number
  scanResolution?: number
  sensorStrength?: number
  sensorType?: string
  scanRange?: number
  scanResolving?: number
  turretHardpoints?: number
  launcherHardpoints?: number
  restrictions?: Prisma.InputJsonValue
}

async function getEsiTypeName(typeId: number): Promise<string> {
  const data = await fetchWithCache<{ name?: string }>(`/universe/types/${typeId}/`)
  return data?.name?.trim() || `Type ${typeId}`
}

/** Current ESI ship layouts expose slot counts on 12/13/14 (low/med/high); CPU output on 48; grid on 11. */
function usesModernSlotLayout(attrs: Record<number, number>): boolean {
  return (
    attrs[A.lowSlots] !== undefined ||
    attrs[A.medSlots] !== undefined ||
    attrs[A.highSlots] !== undefined
  )
}

export type ShipEsiLayoutMeta = {
  raceId?: number | null
  groupId?: number | null
  groupName?: string | null
  factionName?: string | null
  raceSource?: IdentitySource
  groupSource?: IdentitySource
  qualityWarning?: string
}

export function mapDogmaToShipStats(
  attrs: Record<number, number>,
  meta?: ShipEsiLayoutMeta
): ShipStatsUpdate {
  // EVE dogma: 208 radar, 209 ladar, 210 gravimetric, 211 magnetometric
  const sensors = {
    radar: attrs[A.scanRadar] || 0,
    ladar: attrs[A.scanLadar] || 0,
    gravimetric: attrs[A.scanGravimetric] || 0,
    magnetometric: attrs[A.scanMagnetometric] || 0
  }

  const maxSensor = Object.entries(sensors).reduce(
    (max, [type, value]) => (value > max.value ? { type, value } : max),
    { type: '', value: 0 }
  )

  const modern = usesModernSlotLayout(attrs)

  const highSlots = Math.floor(modern ? (attrs[A.highSlots] ?? 0) : (attrs[A.legacyHiSlot] ?? 0))
  const medSlots = Math.floor(modern ? (attrs[A.medSlots] ?? 0) : (attrs[A.cpuOutput] ?? 0))
  const lowSlots = Math.floor(modern ? (attrs[A.lowSlots] ?? 0) : (attrs[A.legacyLowSlot] ?? 0))

  const cpu = modern ? (attrs[A.cpuOutput] ?? attrs[A.cpuLegacy]) : (attrs[A.cpuLegacy] ?? attrs[A.cpuOutput])
  const powerGrid = modern ? (attrs[A.powerGridOutput] ?? attrs[A.powerLegacy]) : (attrs[A.powerLegacy] ?? attrs[A.powerGridOutput])
  const mass = attrs[A.mass]
  const agility = attrs[A.agility]
  const rigSize = attrs[A.rigSize] ?? 0

  return {
    raceId: meta?.raceId ?? null,
    groupId: meta?.groupId ?? null,
    factionName: meta?.factionName?.trim() || factionNameFromRaceId(meta?.raceId ?? null),
    groupName: meta?.groupName?.trim() || '',
    cpu,
    powerGrid,
    calibration: attrs[A.calibrationCost] ?? attrs[A.calibration],
    highSlots,
    medSlots,
    lowSlots,
    rigSlots: Math.floor(attrs[A.rigSlots] ?? 0),
    subsystemSlots: Math.floor(attrs[A.subsystemSlots] ?? 0),

    capacitor: attrs[A.capacitorCapacity] ?? attrs[A.capacitorLegacy],
    capacitorRecharge: (attrs[A.capacitorRechargeRate] ?? attrs[A.capacitorRechargeLegacy] ?? 280000) / 1000, // Convert ms to seconds

    shieldCapacity: attrs[A.shieldCapacityPool] ?? attrs[A.shieldCapacityAlt],
    armorHP: attrs[A.armorHP],
    hullHP: attrs[A.hullHP],

    // Shield damage resonance (0–1); 263 is shield HP, not EM resist
    shieldEmResist: attrs[A.shieldEmResist],
    shieldExpResist: attrs[A.shieldExpResist],
    shieldKinResist: attrs[A.shieldKinResist],
    shieldThermResist: attrs[A.shieldThermResist],

    // Armor damage resonance (0–1)
    armorEmResist: attrs[A.armorEmResist],
    armorExpResist: attrs[A.armorExpResist],
    armorKinResist: attrs[A.armorKinResist],
    armorThermResist: attrs[A.armorThermResist],

    // Structure (hull) damage resonance (0–1)
    hullEmResist: attrs[A.hullEmResist],
    hullThermResist: attrs[A.hullThermResist],
    hullKinResist: attrs[A.hullKinResist],
    hullExpResist: attrs[A.hullExpResist],

    maxVelocity: attrs[A.maxVelocity],
    agility,
    mass,
    // AU/s: modern ships expose 600 (warpSpeedMultiplier); 30 is legacy.
    warpSpeed: attrs[A.warpSpeedMultiplier] ?? attrs[A.warpSpeedLegacy],
    alignTime: computeAlignTimeSeconds(mass || 0, agility || 0),

    droneBay: attrs[A.droneBay] ?? attrs[A.legacyDrone227],
    droneBandwidth: attrs[A.droneBandwidth] ?? attrs[A.legacyDrone1270],
    cargo: attrs[A.capacity],

    maxLockedTargets: Math.floor(attrs[A.maxLockedTargets] ?? attrs[A.maxLockedTargetsAlt] ?? 5),
    maxTargetRange: attrs[A.maxTargetRange],
    signatureRadius: attrs[A.signatureRadius],
    scanResolution: attrs[A.scanResolution],
    sensorStrength: maxSensor.value,
    sensorType: maxSensor.type || '',
    scanRange: 0,
    scanResolving: 0,

    turretHardpoints: Math.floor(attrs[A.turretHardpoints] ?? attrs[A.legacyTurretHardpoints] ?? 0),
    launcherHardpoints: Math.floor(attrs[A.launcherHardpoints] ?? attrs[A.legacyLauncherHardpoints] ?? 0),

    restrictions: {
      rigSize,
      syncMeta: {
        identity: {
          raceSource: meta?.raceSource ?? 'unknown',
          groupSource: meta?.groupSource ?? 'unknown',
          warning: meta?.qualityWarning ?? null,
        },
      },
      // Legacy key kept for backward compatibility with already-synced rows.
      syncIdentity: {
        raceSource: meta?.raceSource ?? 'unknown',
        groupSource: meta?.groupSource ?? 'unknown',
        warning: meta?.qualityWarning ?? null,
      },
    } as Prisma.InputJsonValue
  }
}

async function resolveShipIdentity(
  typeId: number,
  esiType: EsiUniverseTypePayload | null,
  row: { groupId?: number; groupName?: string | null; raceId?: number | null; factionId?: number | null }
): Promise<ShipIdentityResolution> {
  let raceSource: IdentitySource = 'unknown'
  let groupSource: IdentitySource = 'unknown'
  const everef = await fetchEverefTypeIdentity(typeId)
  const adam4eve = await fetchAdam4EveTypeIdentity(typeId)

  const sdeRace = asNullableInt(row.raceId)
  const esiRace = asNullableInt(esiType?.race_id)
  const everefRace = asNullableInt(everef?.race_id)
  let raceId = sdeRace
  if (raceId != null) raceSource = 'sde'
  else if (esiRace != null) {
    raceId = esiRace
    raceSource = 'esi'
  } else if (everefRace != null) {
    raceId = everefRace
    raceSource = 'everef'
  } else {
    raceId = null
  }

  const sdeGroup = asNullableInt(row.groupId)
  const esiGroup = asNullableInt(esiType?.group_id)
  const everefGroup = asNullableInt(everef?.group_id)
  const adamGroup = asNullableInt(adam4eve?.group_id)
  let groupId = sdeGroup
  if (groupId != null) groupSource = 'sde'
  else if (esiGroup != null) {
    groupId = esiGroup
    groupSource = 'esi'
  } else if (everefGroup != null) {
    groupId = everefGroup
    groupSource = 'everef'
  } else if (adamGroup != null) {
    groupId = adamGroup
    groupSource = 'adam4eve'
  } else {
    groupId = null
  }

  const sdeFactionName = fallbackFactionNameFromFactionId(asNullableInt(row.factionId))
  const everefFactionName = fallbackFactionNameFromFactionId(asNullableInt(everef?.faction_id))
  const factionName =
    factionNameFromRaceId(raceId) !== 'Unknown'
      ? factionNameFromRaceId(raceId)
      : sdeFactionName !== 'Unknown'
        ? sdeFactionName
        : everefFactionName

  const qualityWarning =
    raceSource === 'everef' ||
    raceSource === 'unknown' ||
    groupSource === 'everef' ||
    groupSource === 'adam4eve' ||
    groupSource === 'unknown'
      ? 'Ship identity partially resolved by external fallback (EVE Ref/Adam4EVE). Values may diverge from CCP SDE.'
      : undefined

  return {
    raceId,
    groupId,
    groupName: row.groupName ?? null,
    factionName,
    raceSource,
    groupSource,
    qualityWarning,
  }
}

export interface SyncResult {
  success: boolean
  shipsProcessed: number
  attributesProcessed: number
  errors: string[]
  lastSync: Date
  /** Rows skipped because `requireCompleteScope` flagged missing mapped fields. */
  skippedIncomplete?: number
  contractVersion?: number
  /**
   * Bulk mode only: number of `EveType` hull candidates selected before the ESI loop
   * (`published` + group category Ship).
   */
  candidateHulls?: number
  raceSourceCounts?: { esi: number; sde: number; everef: number; adam4eve: number; unknown: number }
  slotExceptionsApplied?: number
}

export type SyncShipDogmaOptions = {
  /** When syncing all ships, cap how many rows to process (ops / staging). */
  maxShips?: number
  /**
   * When true (recommended for `shipTypeIds` omitted), refuse to upsert a hull if the mapped
   * row does not satisfy `listBulkSyncBlockingGaps` — avoids shipping partial ShipStats that
   * force a later full re-sync.
   */
  requireCompleteScope?: boolean
}

export async function syncShipDogmaData(
  shipTypeIds?: number[],
  onProgress?: (progress: { current: number; total: number; ship: string }) => void,
  options?: SyncShipDogmaOptions
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    shipsProcessed: 0,
    attributesProcessed: 0,
    errors: [],
    lastSync: new Date(),
    skippedIncomplete: 0,
    contractVersion: SHIP_STATS_SYNC_CONTRACT_VERSION,
    raceSourceCounts: { esi: 0, sde: 0, everef: 0, adam4eve: 0, unknown: 0 },
    slotExceptionsApplied: 0,
  }

  const isBulkAll = !shipTypeIds || shipTypeIds.length === 0
  const requireComplete = options?.requireCompleteScope ?? isBulkAll

  type SyncShipRow = {
    typeId: number
    name: string
    groupId?: number
    groupName?: string | null
    raceId?: number | null
    factionId?: number | null
  }

  try {
    let shipsToSync: SyncShipRow[]

    if (shipTypeIds && shipTypeIds.length > 0) {
      const rows = await prisma.eveType.findMany({
        where: { id: { in: shipTypeIds } },
        select: {
          id: true,
          name: true,
          groupId: true,
          raceId: true,
          factionId: true,
          group: { select: { name: true } },
        }
      })
      const byId = new Map(rows.map((r) => [r.id, r]))
      shipsToSync = []
      for (const id of shipTypeIds) {
        const row = byId.get(id)
        const name = row?.name ?? (await getEsiTypeName(id))
        shipsToSync.push({
          typeId: id,
          name,
          groupId: row?.groupId,
          groupName: row?.group?.name ?? null,
          raceId: row?.raceId ?? null,
          factionId: row?.factionId ?? null,
        })
      }
    } else {
      const allShips = await prisma.eveType.findMany({
        where: { published: true, group: { categoryId: 6 } },
        select: {
          id: true,
          name: true,
          groupId: true,
          raceId: true,
          factionId: true,
          group: { select: { name: true } },
        },
        orderBy: { id: 'asc' }
      })
      shipsToSync = allShips.map((s) => ({
        typeId: s.id,
        name: s.name,
        groupId: s.groupId,
        groupName: s.group?.name ?? null,
        raceId: s.raceId ?? null,
        factionId: s.factionId ?? null,
      }))
      const cap = options?.maxShips
      if (typeof cap === 'number' && cap > 0 && shipsToSync.length > cap) {
        shipsToSync = shipsToSync.slice(0, cap)
      }
    }
    
    const total = shipsToSync.length
    if (isBulkAll) {
      result.candidateHulls = total
      if (total === 0) {
        result.success = false
        result.errors.push(
          '[sde] No EveType rows matched published ships (category 6). Run `npm run import:sde` against this database (official CCP JSONL), then retry bulk ship sync.'
        )
      }
    }

    for (let i = 0; i < shipsToSync.length; i++) {
      const ship = shipsToSync[i]
      
      onProgress?.({
        current: i + 1,
        total,
        ship: ship.name
      })
      
      try {
        const { attrs, type } = await fetchShipTypeFromEsi(ship.typeId)

        logger.debug('ShipSync', `Checking ship ${ship.name} (${ship.typeId})`, {
          attrCount: Object.keys(attrs).length,
          cpu: attrs[A.cpuOutput] ?? attrs[A.cpuLegacy],
          power: attrs[A.powerGridOutput] ?? attrs[A.powerLegacy],
          hiSlot: attrs[A.highSlots] ?? attrs[A.legacyHiSlot]
        })

        if (Object.keys(attrs).length === 0) {
          logger.warn('ShipSync', `No attributes for ${ship.name}, skipping`, { typeId: ship.typeId })
          continue
        }

        if (
          !attrs[A.cpuLegacy] &&
          !attrs[A.powerLegacy] &&
          !(usesModernSlotLayout(attrs) && (attrs[A.cpuOutput] || attrs[A.powerGridOutput]))
        ) {
          logger.warn('ShipSync', `${ship.name} has no CPU/Power, likely not a ship`, { typeId: ship.typeId })
          continue
        }

        const identity = await resolveShipIdentity(ship.typeId, type, ship)
        result.raceSourceCounts![identity.raceSource]++
        const meta: ShipEsiLayoutMeta = {
          raceId: identity.raceId,
          groupId: identity.groupId,
          groupName: identity.groupName,
          factionName: identity.factionName,
          raceSource: identity.raceSource,
          groupSource: identity.groupSource,
          qualityWarning: identity.qualityWarning,
        }
        const statsUpdate = mapDogmaToShipStats(attrs, meta)
        if (isSlotExceptionAllowed(statsUpdate, ship.typeId)) {
          const slots = (statsUpdate.highSlots ?? 0) + (statsUpdate.medSlots ?? 0) + (statsUpdate.lowSlots ?? 0)
          if (slots <= 0) {
            result.slotExceptionsApplied = (result.slotExceptionsApplied ?? 0) + 1
          }
        }

        if (requireComplete) {
          const gaps = listBulkSyncBlockingGaps(ship.typeId, ship.name, statsUpdate, {
            hasGroupName: !!statsUpdate.groupName?.trim()
          })
          if (gaps.length > 0) {
            result.skippedIncomplete = (result.skippedIncomplete ?? 0) + 1
            result.errors.push(`[incomplete] ${ship.name} (${ship.typeId}): ${gaps.join(', ')}`)
            continue
          }
        }

        await prisma.shipStats.upsert({
          where: { typeId: ship.typeId },
          update: {
            ...statsUpdate,
            name: ship.name,
            syncedAt: new Date()
          },
          create: {
            typeId: ship.typeId,
            name: ship.name,
            ...statsUpdate,
            syncedAt: new Date()
          }
        })
        
        // Save all dogma attributes in the separate table
        const dogmaRecords = Object.entries(attrs).map(([attrId, value]) => ({
          shipTypeId: ship.typeId,
          attributeId: parseInt(attrId),
          attributeName: SHIP_DOGMA_ATTRIBUTE_NAMES[parseInt(attrId)] || `attr_${attrId}`,
          value
        }))
        
        // Batch upsert para atributos dogma
        for (const record of dogmaRecords) {
          await prisma.shipDogmaAttribute.upsert({
            where: {
              shipTypeId_attributeId: {
                shipTypeId: record.shipTypeId,
                attributeId: record.attributeId
              }
            },
            update: { value: record.value },
            create: record
          })
          result.attributesProcessed++
        }

        // --- NEW: Sync Ship Traits ---
        const traits = await getShipTraits(ship.typeId)
        if (traits) {
          // Clean existing traits first to avoid duplicates or stale data
          await prisma.shipTrait.deleteMany({ where: { shipTypeId: ship.typeId } })

          // Skill-based traits
          if (traits.types) {
            for (const skillGroup of traits.types) {
              for (const trait of skillGroup.traits) {
                await prisma.shipTrait.create({
                  data: {
                    shipTypeId: ship.typeId,
                    skillID: skillGroup.type_id,
                    bonus: trait.bonus,
                    bonusText: trait.bonus_text,
                    unit: trait.unit_id?.toString(),
                    isFixed: false
                  }
                })
              }
            }
          }

          // Role traits (Fixed)
          if (traits.role_traits) {
            for (const trait of traits.role_traits) {
              await prisma.shipTrait.create({
                data: {
                  shipTypeId: ship.typeId,
                  bonus: trait.bonus,
                  bonusText: trait.bonus_text,
                  unit: trait.unit_id?.toString(),
                  isFixed: true
                }
              })
            }
          }
        }
        
        result.shipsProcessed++
        
        // Rate limiting - aguardar entre requests
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        const errorMsg = `Error syncing ${ship.name} (${ship.typeId}): ${error instanceof Error ? error.message : 'Unknown error'}`
        result.errors.push(errorMsg)
        logger.error('ShipSync', errorMsg, { error, ship: ship.name, typeId: ship.typeId })
      }
    }
    
  } catch (error) {
    result.success = false
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return result
}

export async function syncSingleShip(typeId: number): Promise<boolean> {
  try {
    const { attrs, type } = await fetchShipTypeFromEsi(typeId)
    const row = await prisma.eveType.findUnique({
      where: { id: typeId },
      select: { name: true, groupId: true, raceId: true, factionId: true, group: { select: { name: true } } }
    })
    const identity = await resolveShipIdentity(typeId, type, {
      groupId: row?.groupId,
      groupName: row?.group?.name ?? null,
      raceId: row?.raceId ?? null,
      factionId: row?.factionId ?? null,
    })
    const meta: ShipEsiLayoutMeta = {
      raceId: identity.raceId,
      groupId: identity.groupId,
      groupName: identity.groupName,
      factionName: identity.factionName,
      raceSource: identity.raceSource,
      groupSource: identity.groupSource,
      qualityWarning: identity.qualityWarning,
    }
    const statsUpdate = mapDogmaToShipStats(attrs, meta)
    const name = row?.name?.trim() || type?.name?.trim() || `Type ${typeId}`

    await prisma.shipStats.upsert({
      where: { typeId },
      update: {
        ...statsUpdate,
        name,
        syncedAt: new Date()
      },
      create: {
        typeId,
        name,
        ...statsUpdate,
        syncedAt: new Date()
      }
    })
    
    // Save dogma attributes
    for (const [attrId, value] of Object.entries(attrs)) {
      await prisma.shipDogmaAttribute.upsert({
        where: {
          shipTypeId_attributeId: {
            shipTypeId: typeId,
            attributeId: parseInt(attrId)
          }
        },
        update: { value },
        create: {
          shipTypeId: typeId,
          attributeId: parseInt(attrId),
          attributeName: SHIP_DOGMA_ATTRIBUTE_NAMES[parseInt(attrId)] || `attr_${attrId}`,
          value
        }
      })
    }
    
    return true
  } catch (error) {
    logger.error('ShipSync', `Error syncing ship ${typeId}`, { error, typeId })
    return false
  }
}

export async function getShipDogmaAttributesFromDB(typeId: number): Promise<Record<number, number>> {
  const attrs = await prisma.shipDogmaAttribute.findMany({
    where: { shipTypeId: typeId },
    select: { attributeId: true, value: true }
  })
  
  return attrs.reduce((acc, attr) => {
    acc[attr.attributeId] = attr.value
    return acc
  }, {} as Record<number, number>)
}

export async function getShipStatsFromDB(typeId: number) {
  return prisma.shipStats.findUnique({
    where: { typeId },
    include: {
      dogmaAttributes: true
    }
  })
}
