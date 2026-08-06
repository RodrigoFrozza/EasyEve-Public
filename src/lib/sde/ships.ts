// Ship base attributes for fitting calculations
// Data sourced from database (SDE) with ESI fallback

import { prisma } from '../prisma'
import { logger } from '@/lib/server-logger'
import { esiClient } from '@/lib/esi-client'

export interface ShipBaseStats {
  typeId: number
  name: string
  cpu: number
  powerGrid: number
  highSlots: number
  medSlots: number
  lowSlots: number
  rigSlots: number
  subsystemSlots?: number
  capacitor: number
  capacitorRecharge: number
  shieldCapacity: number
  armorHP: number
  hullHP: number
  shieldEmResist: number
  shieldExplosiveResist: number
  shieldKineticResist: number
  shieldThermalResist: number
  armorEmResist: number
  armorExplosiveResist: number
  armorKineticResist: number
  armorThermalResist: number
  hullEmResist: number
  hullExplosiveResist: number
  hullKineticResist: number
  hullThermalResist: number
  maxVelocity: number
  agility: number
  mass: number
  warpSpeed: number
  droneBay: number
  cargo: number
  scanRange: number
  scanStrength: number
}

const ESI_BASE = 'https://esi.evetech.net/latest'

// === PERFORMANCE: In-memory cache ===
const shipStatsCache = new Map<string, { stats: ShipBaseStats | null; timestamp: number }>()
const SHIP_CACHE_TTL = 15 * 60 * 1000 // 15 minutes
const MAX_SHIP_CACHE_SIZE = 500

// Cache for dogma attributes (typeId -> attrs)
const dogmaAttrsCache = new Map<number, { attrs: Record<string, number>; timestamp: number }>()
const DOGMA_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const MAX_DOGMA_CACHE_SIZE = 500

// Cache for ship names list
let shipNamesCache: string[] = []
let shipNamesCacheTime = 0
const NAMES_CACHE_TTL = 60 * 60 * 1000 // 1 hour

const SHIP_DOGMA_ATTRS = {
  CPU: 19,
  POWER: 21,
  CAPACITOR: 22,
  CAPACITOR_RECHARGE: 64,
  HI_SLOTS: 47,
  MED_SLOTS: 48,
  LOW_SLOTS: 49,
  RIG_SLOTS: 1137,
  SHIELD_CAPACITY: 73,
  ARMOR_HP: 265,
  HULL_HP: 9,
  MAX_VELOCITY: 37,
  AGILITY: 70,
  MASS: 4,
  WARP_SPEED: 600,
  DRONE_BAY: 227,
  CARGO: 5,
  SHIELD_EM: 271,
  SHIELD_EXPLO: 272,
  SHIELD_KIN: 273,
  SHIELD_THERM: 274,
  ARMOR_EM: 267,
  ARMOR_EXPLO: 268,
  ARMOR_KIN: 269,
  ARMOR_THERM: 270,
  HULL_EM: 275,
  HULL_EXPLO: 276,
  HULL_KIN: 277,
  HULL_THERM: 278,
  SCAN_RANGE: 76,
  SCAN_STRENGTH: 564, // Base radar strength
}

// Default ship stats as fallback (used if ESI fails)
const DEFAULT_CPU = 400
const DEFAULT_PG = 400
const DEFAULT_HIGH = 5
const DEFAULT_MED = 5
const DEFAULT_LOW = 5
const DEFAULT_RIG = 3
const DEFAULT_SHIELD = 1000
const DEFAULT_ARMOR = 2000
const DEFAULT_HULL = 1000
const DEFAULT_CAP = 300
const DEFAULT_VEL = 150
const DEFAULT_DRONE = 50
const DEFAULT_CARGO = 300

function mapShipStats(typeId: number, name: string, attrs: Record<string, number>): ShipBaseStats {
  return {
    typeId,
    name,
    cpu: attrs.cpu || DEFAULT_CPU,
    powerGrid: attrs.power || DEFAULT_PG,
    highSlots: attrs.high || DEFAULT_HIGH,
    medSlots: attrs.med || DEFAULT_MED,
    lowSlots: attrs.low || DEFAULT_LOW,
    rigSlots: attrs.rig || DEFAULT_RIG,
    capacitor: attrs.capacitor || DEFAULT_CAP,
    capacitorRecharge: attrs.capacitorRecharge || 280000,
    shieldCapacity: attrs.shield || DEFAULT_SHIELD,
    armorHP: attrs.armor || DEFAULT_ARMOR,
    hullHP: attrs.hull || DEFAULT_HULL,
    shieldEmResist: attrs.shieldEm || 0,
    shieldExplosiveResist: attrs.shieldExplo || 0.2,
    shieldKineticResist: attrs.shieldKin || 0.5,
    shieldThermalResist: attrs.shieldTherm || 0.2,
    armorEmResist: attrs.armorEm || 0.5,
    armorExplosiveResist: attrs.armorExplo || 0.7,
    armorKineticResist: attrs.armorKin || 0.625,
    armorThermalResist: attrs.armorTherm || 0.8125,
    hullEmResist: attrs.hullEm || 0.33,
    hullExplosiveResist: attrs.hullExplo || 0.5,
    hullKineticResist: attrs.hullKin || 0.375,
    hullThermalResist: attrs.hullTherm || 0.125,
    maxVelocity: attrs.velocity || DEFAULT_VEL,
    agility: attrs.agility || 3.0,
    mass: attrs.mass || 10000000,
    warpSpeed: attrs.warpSpeed || 3,
    droneBay: attrs.drone || DEFAULT_DRONE,
    cargo: attrs.cargo || DEFAULT_CARGO,
    scanRange: attrs.scanRange || 0,
    scanStrength: attrs.scanStrength || 0
  }
}

export async function getShipStats(shipName: string): Promise<ShipBaseStats | null> {
  const now = Date.now()
  
  // Check cache
  const cached = shipStatsCache.get(shipName)
  if (cached && (now - cached.timestamp < SHIP_CACHE_TTL)) {
    return cached.stats
  }
  
  try {
    // First try to get from database
    const shipType = await prisma.eveType.findFirst({
      where: { name: shipName, published: true },
      include: { group: true }
    })
    
    if (shipType) {
      // Get additional stats from ESI
      const attrs = await getShipDogmaAttributes(shipType.id)
      const stats = mapShipStats(shipType.id, shipType.name, attrs)
      
      // Cache result with size cap
      shipStatsCache.set(shipName, { stats, timestamp: now })
      if (shipStatsCache.size > MAX_SHIP_CACHE_SIZE) {
        const firstKey = shipStatsCache.keys().next().value
        if (firstKey !== undefined) shipStatsCache.delete(firstKey)
      }
      return stats
    }
  } catch (error) {
    logger.error('SDE', 'Error fetching ship from DB', error)
  }
  
  // Fallback to ESI
  const esiStats = await getShipFromESI(shipName)
  
  // Cache result (even if null) with size cap
  shipStatsCache.set(shipName, { stats: esiStats, timestamp: now })
  if (shipStatsCache.size > MAX_SHIP_CACHE_SIZE) {
    const firstKey = shipStatsCache.keys().next().value
    if (firstKey !== undefined) shipStatsCache.delete(firstKey)
  }
  return esiStats
}

export async function getShipFromESI(shipName: string): Promise<ShipBaseStats | null> {
  try {
    const searchRes = await esiClient.get(`/search/?categories=ship&search=${encodeURIComponent(shipName)}&strict=true`)
    const searchData = searchRes.data
    if (!searchData.ship || !searchData.ship[0]) return null
    
    const typeId = searchData.ship[0]
    const typeRes = await esiClient.get(`/universe/types/${typeId}/`)
    const typeData = typeRes.data
    const attrs = await getShipDogmaAttributes(typeId)
    
    return mapShipStats(typeId, typeData.name, attrs)
  } catch (error) {
    logger.error('SDE', 'Error fetching ship from ESI', error)
    return null
  }
}

async function getShipDogmaAttributes(typeId: number): Promise<Record<string, number>> {
  const now = Date.now()
  
  // Check cache first
  const cached = dogmaAttrsCache.get(typeId)
  if (cached && (now - cached.timestamp < DOGMA_CACHE_TTL)) {
    return cached.attrs
  }
  
  const attrs: Record<string, number> = {}
  
  try {
    const res = await esiClient.get(`/dogma/attributes/?type_id=${typeId}`)
    const data = res.data as Array<{ attribute_id: number; value: number }>
    for (const item of data) {
      const attrId = item.attribute_id
      const value = item.value
      
      if (attrId === SHIP_DOGMA_ATTRS.CPU) attrs.cpu = value
      else if (attrId === SHIP_DOGMA_ATTRS.POWER) attrs.power = value
      else if (attrId === SHIP_DOGMA_ATTRS.HI_SLOTS) attrs.high = value
      else if (attrId === SHIP_DOGMA_ATTRS.MED_SLOTS) attrs.med = value
      else if (attrId === SHIP_DOGMA_ATTRS.LOW_SLOTS) attrs.low = value
      else if (attrId === SHIP_DOGMA_ATTRS.RIG_SLOTS) attrs.rig = value
      else if (attrId === SHIP_DOGMA_ATTRS.SHIELD_CAPACITY) attrs.shield = value
      else if (attrId === SHIP_DOGMA_ATTRS.ARMOR_HP) attrs.armor = value
      else if (attrId === SHIP_DOGMA_ATTRS.HULL_HP) attrs.hull = value
      else if (attrId === SHIP_DOGMA_ATTRS.CAPACITOR) attrs.capacitor = value
      else if (attrId === SHIP_DOGMA_ATTRS.CAPACITOR_RECHARGE) attrs.capacitorRecharge = value
      else if (attrId === SHIP_DOGMA_ATTRS.MAX_VELOCITY) attrs.velocity = value
      else if (attrId === SHIP_DOGMA_ATTRS.AGILITY) attrs.agility = value
      else if (attrId === SHIP_DOGMA_ATTRS.MASS) attrs.mass = value
      else if (attrId === SHIP_DOGMA_ATTRS.WARP_SPEED) attrs.warpSpeed = value
      else if (attrId === SHIP_DOGMA_ATTRS.DRONE_BAY) attrs.drone = value
      else if (attrId === SHIP_DOGMA_ATTRS.CARGO) attrs.cargo = value
      else if (attrId === SHIP_DOGMA_ATTRS.SHIELD_EM) attrs.shieldEm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.SHIELD_EXPLO) attrs.shieldExplo = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.SHIELD_KIN) attrs.shieldKin = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.SHIELD_THERM) attrs.shieldTherm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.ARMOR_EM) attrs.armorEm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.ARMOR_EXPLO) attrs.armorExplo = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.ARMOR_KIN) attrs.armorKin = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.ARMOR_THERM) attrs.armorTherm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.HULL_EM) attrs.hullEm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.HULL_EXPLO) attrs.hullExplo = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.HULL_KIN) attrs.hullKin = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.HULL_THERM) attrs.hullTherm = 1 - value
      else if (attrId === SHIP_DOGMA_ATTRS.SCAN_RANGE) attrs.scanRange = value
      else if (attrId === SHIP_DOGMA_ATTRS.SCAN_STRENGTH) attrs.scanStrength = value
    }
  } catch (error) {
    // Ignore errors, return what's available
  }
  
  // Cache result with size cap
  dogmaAttrsCache.set(typeId, { attrs, timestamp: now })
  if (dogmaAttrsCache.size > MAX_DOGMA_CACHE_SIZE) {
    const firstKey = dogmaAttrsCache.keys().next().value
    if (firstKey !== undefined) dogmaAttrsCache.delete(firstKey)
  }
  
  return attrs
}

export async function getAllShipNames(): Promise<string[]> {
  const now = Date.now()
  
  // Check cache
  if (shipNamesCache.length > 0 && (now - shipNamesCacheTime < NAMES_CACHE_TTL)) {
    return shipNamesCache
  }
  
  try {
    const ships = await prisma.eveType.findMany({
      where: {
        published: true,
        group: { categoryId: 6 } // Ship category
      },
      select: { name: true },
      orderBy: { name: 'asc' },
      take: 500
    })
    shipNamesCache = ships.map(s => s.name)
    shipNamesCacheTime = now
    return shipNamesCache
  } catch {
    return []
  }
}

export async function getShipByTypeId(typeId: number): Promise<ShipBaseStats | null> {
  try {
    const shipType = await prisma.eveType.findUnique({
      where: { id: typeId }
    })
    
    if (shipType) {
      const attrs = await getShipDogmaAttributes(typeId)
      return mapShipStats(typeId, shipType.name, attrs)
    }
  } catch (error) {
    logger.error('SDE', `Error getting ship by typeId ${typeId}`, error)
  }
  
  return null
}