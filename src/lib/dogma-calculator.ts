// Dogma Calculator - Calculation system for EVE Online fits
// Version 2.1 - Cleaned up logic, resolved duplications, and fixed build errors.

import { prisma } from '@/lib/prisma'
import {
  simulateCapacitor,
  turretHitChance,
  missileApplicationFactor,
  effectiveHitPointsWithProfile,
} from '@/lib/fits-v2/engine'
import { 
  ShipStats as FitStats, 
  Modifier, 
  AttributeHistory, 
  Skill, 
  SkillProfile,
  Module,
  FitSlot
} from '@/types/fit'
import { logger } from '@/lib/server-logger'

// --- Constants ---
const STACKING_PENALTY_CURVE = 2.2229;

const PENALIZED_ATTRIBUTES = new Set([
  'armorEmResist', 'armorExpResist', 'armorKinResist', 'armorThermResist',
  'shieldEmResist', 'shieldExpResist', 'shieldKinResist', 'shieldThermResist',
  'hullEmResist', 'hullExpResist', 'hullKinResist', 'hullThermResist',
  'maxVelocity', 'agility', 'signatureRadius', 'scanResolution',
  'damageMultiplier', 'rofMultiplier', 'optimalRange', 'falloffRange',
  'trackingSpeed', 'missileDamageMultiplier', 'missileVelocityMultiplier',
  'missileExplosionRadiusMultiplier', 'missileExplosionVelocityMultiplier',
  'Shield HP', 'Armor HP', 'Hull HP',
  'Powergrid', 'CPU', 'Calibration',
  'Max Speed', 'Signature Radius', 'Scan Resolution', 'Agility', 'Warp Speed',
  'Damage Multiplier', 'Fire Rate', 'Optimal Range', 'Falloff Range', 'Tracking Speed',
  'Capacitor', 'Capacitor Recharge',
  'Shield EM Resist', 'Shield Thermal Resist', 'Shield Kinetic Resist', 'Shield Explosive Resist',
  'Armor EM Resist', 'Armor Thermal Resist', 'Armor Kinetic Resist', 'Armor Explosive Resist',
  'Hull EM Resist', 'Hull Thermal Resist', 'Hull Kinetic Resist', 'Hull Explosive Resist',
  'Sensor Strength', 'Max Target Range', 'Shield Boost Rate', 'Armor Repair Rate'
]);

function resonanceToResistance(value: number | undefined | null): number {
  // ShipStats persists resonance (damage taken), but UI/combat expects resistance.
  const resonance = Number(value ?? 0)
  if (!Number.isFinite(resonance)) return 0
  return Math.max(0, Math.min(1, 1 - resonance))
}

const SKILL_MAP: Record<number, { attr: string, bonus: number, type: 'percent' | 'flat', impact: 'positive' | 'negative' }> = {
  3394: { attr: 'Shield HP', bonus: 5, type: 'percent', impact: 'positive' }, // Shield Management
  3416: { attr: 'Capacitor Recharge', bonus: -5, type: 'percent', impact: 'positive' }, // Shield Operation
  3318: { attr: 'Powergrid', bonus: 5, type: 'percent', impact: 'positive' }, // Power Grid Management
  3319: { attr: 'CPU', bonus: 5, type: 'percent', impact: 'positive' }, // CPU Management
  3402: { attr: 'Max Speed', bonus: 5, type: 'percent', impact: 'positive' }, // Navigation
  3409: { attr: 'Agility', bonus: -5, type: 'percent', impact: 'positive' }, // Evasive Maneuvering
  3406: { attr: 'Agility', bonus: -2, type: 'percent', impact: 'positive' }, // Spaceship Command
  3320: { attr: 'Capacitor', bonus: 5, type: 'percent', impact: 'positive' }, // Capacitor Management
  3321: { attr: 'Capacitor Recharge', bonus: -5, type: 'percent', impact: 'positive' }, // Capacitor Systems Operation
}

export const DOGMA_EFFECTS = {
  HI_POWER: 12,
  MED_POWER: 13,
  LO_POWER: 11,
  RIG_SLOT: 2663,
  SUBSYSTEM_SLOT: 3499,
  TURRET_FITTED: 42,
  LAUNCHER_FITTED: 40,
}

export const DOGMA_ATTRIBUTES = {
  RIG_SIZE: 1547,
  CAN_FIT_SHIP_GROUP_1: 1298,
  CAN_FIT_SHIP_GROUP_2: 1299,
  CAN_FIT_SHIP_GROUP_3: 1300,
  CAN_FIT_SHIP_GROUP_4: 1301,
  CAN_FIT_SHIP_TYPE_1: 1302,
  CAN_FIT_SHIP_TYPE_2: 1303,
  CAN_FIT_SHIP_TYPE_3: 1304,
  CAN_FIT_SHIP_TYPE_4: 1305,
  CHARGE_SIZE: 128,
  MAX_GROUP_ACTIVE: 158,
}

/**
 * Derives hardware slot type from ESI dogma effects (authoritative per FITTING_ENGINE_PROTOCOL).
 * Falls back to persisted `slotType` when effect IDs are absent.
 */
export function inferModuleSlotTypeFromEffects(modStats: {
  effects?: unknown
  slotType?: string | null
}): 'high' | 'med' | 'low' | 'rig' | 'subsystem' | null {
  const ids = new Set<number>()
  const raw = modStats.effects
  if (Array.isArray(raw)) {
    raw.forEach((e: unknown) => {
      if (typeof e === 'number') ids.add(e)
      else if (e && typeof e === 'object' && 'effectId' in e) {
        ids.add(Number((e as { effectId: number }).effectId))
      }
    })
  } else if (raw && typeof raw === 'object') {
    const effectIds = (raw as { effectIds?: unknown }).effectIds
    if (Array.isArray(effectIds)) {
      effectIds.forEach((id: unknown) => ids.add(Number(id)))
    }
  }
  if (ids.has(DOGMA_EFFECTS.HI_POWER)) return 'high'
  if (ids.has(DOGMA_EFFECTS.MED_POWER)) return 'med'
  if (ids.has(DOGMA_EFFECTS.LO_POWER)) return 'low'
  if (ids.has(DOGMA_EFFECTS.RIG_SLOT)) return 'rig'
  if (ids.has(DOGMA_EFFECTS.SUBSYSTEM_SLOT)) return 'subsystem'
  const st = modStats.slotType
  if (!st) return null
  if (st === 'mid') return 'med'
  if (st === 'high' || st === 'med' || st === 'low' || st === 'rig' || st === 'subsystem') return st
  return null
}

// --- DB/API Interfaces ---
export interface DogmaAttribute {
  attributeId: number
  value: number
}

export interface DogmaEffect {
  effectId: number
  isDefault?: boolean
}

export interface ShipTrait {
  bonus: number | null
  bonusText: string | null
  unit: string | null
  skillID: number | null
  isFixed: boolean
}
interface ShipBaseStats {
  typeId: number
  groupId: number
  categoryId?: number
  name: string
  groupName?: string
  highSlots: number
  medSlots: number
  lowSlots: number
  rigSlots: number
  cpu: number
  powerGrid: number
  calibration: number
  capacitor: number
  capacitorRecharge: number
  shieldCapacity: number
  armorHP: number
  hullHP: number
  shieldEmResist: number
  shieldExpResist: number
  shieldKinResist: number
  shieldThermResist: number
  armorEmResist: number
  armorExpResist: number
  armorKinResist: number
  armorThermResist: number
  hullEmResist: number
  hullExpResist: number
  hullKinResist: number
  hullThermResist: number
  maxVelocity: number
  agility: number
  mass: number
  warpSpeed: number
  droneBay: number
  droneBandwidth: number
  cargo: number
  maxLockedTargets: number
  maxTargetRange: number
  signatureRadius: number
  scanResolution: number
  sensorStrength: number
  sensorType: string
  turretHardpoints: number
  launcherHardpoints: number
  rigSize: number
  subsystemSlots?: number
  calibrationLimit?: number
  dataQualityWarning?: string
  syncIdentity?: {
    raceSource?: string
    groupSource?: string
    warning?: string | null
  }
  dogmaAttributes?: DogmaAttribute[]
  traits?: ShipTrait[]
}

interface ModuleBaseStats {
  typeId: number
  categoryId?: number
  groupId: number
  name: string
  groupName?: string | null
  slotType?: string | null
  dogmaAttributes?: DogmaAttribute[]
  effects?: DogmaEffect[]
  cpu: number
  powerGrid: number
  calibration?: number
  damage?: number
  damageMultiplier: number
  rofMultiplier: number
  missileDamage?: number
  optimalRange: number
  falloffRange: number
  trackingSpeed: number
  fireRate: number
  speedBonus: number
  mass: number
  rigSize?: number
  shieldBonus: number
  armorBonus: number
  hullBonus: number
  shieldEmResistMultiplier: number
  shieldThermResistMultiplier: number
  shieldKinResistMultiplier: number
  shieldExpResistMultiplier: number
  armorEmResistMultiplier: number
  armorThermResistMultiplier: number
  armorKinResistMultiplier: number
  armorExpResistMultiplier: number
  cpuMultiplier: number
  powerMultiplier: number
  shieldBoost: number
  armorRepair: number
  hullRepair: number
  repairAmount?: number
  capacitorNeed: number
  /** From `ModuleStats.restrictions.syncIdentity` when metadata used SDE / external fallbacks. */
  dataQualityWarning?: string
  syncIdentity?: {
    nameSource?: string
    groupIdSource?: string
    categoryIdSource?: string
    warning?: string | null
  }
}

interface ChargeBaseStats {
  typeId: number
  name: string
  emDamage: number
  thermDamage: number
  kinDamage: number
  expDamage: number
  missileDamage: number
  explosionRadius?: number
  explosionVelocity?: number
}

type ChargeCompatibilityModuleShape = {
  name?: string
  chargeGroup1?: number | null
  chargeGroup2?: number | null
  chargeGroup3?: number | null
  chargeGroup4?: number | null
  chargeGroup5?: number | null
  chargeGroup6?: number | null
  chargeGroup7?: number | null
  chargeGroup8?: number | null
  chargeGroup9?: number | null
  chargeGroup10?: number | null
  chargeSize?: number | null
}

type ChargeCompatibilityChargeShape = {
  name?: string
  groupId?: number | null
  chargeSize?: number | null
}

export function getChargeCompatibilityErrors(
  modStats: ChargeCompatibilityModuleShape,
  charge: ChargeCompatibilityChargeShape
): string[] {
  const errors: string[] = []
  const allowed = [
    modStats.chargeGroup1,
    modStats.chargeGroup2,
    modStats.chargeGroup3,
    modStats.chargeGroup4,
    modStats.chargeGroup5,
    modStats.chargeGroup6,
    modStats.chargeGroup7,
    modStats.chargeGroup8,
    modStats.chargeGroup9,
    modStats.chargeGroup10,
  ].filter((g): g is number => typeof g === 'number' && g > 0)

  if (allowed.length > 0 && charge.groupId != null && !allowed.includes(charge.groupId)) {
    errors.push(`Charge "${charge.name || 'Unknown'}" is not allowed in module ${modStats.name || 'Unknown'}`)
  }

  if (
    modStats.chargeSize != null &&
    charge.chargeSize != null &&
    Number(modStats.chargeSize) !== Number(charge.chargeSize)
  ) {
    errors.push(`Charge size mismatch for module ${modStats.name || 'Unknown'}`)
  }

  return errors
}

// --- Cache ---
const CACHE_LIMIT = 500
const shipStatsCache = new Map<number, ShipBaseStats>()
const moduleStatsCache = new Map<number, ModuleBaseStats>()
const chargeStatsCache = new Map<number, ChargeBaseStats>()

function setCache<T>(cache: Map<number, T>, key: number, value: T) {
  if (cache.size >= CACHE_LIMIT) {
    // Simple pruning: clear cache if limit reached to prevent memory growth
    cache.clear()
  }
  cache.set(key, value)
}

// --- History Helpers ---
function initAttributeHistory(attrName: string, baseValue: number, stats: FitStats) {
  stats.history[attrName] = {
    base: baseValue,
    final: baseValue,
    modifiers: []
  }
}

function getStackingEfficiency(rank: number): number {
  if (rank <= 1) return 1.0;
  return Math.pow(0.5, Math.pow((rank - 1) / STACKING_PENALTY_CURVE, 2));
}

function addModifier(
  attrName: string,
  stats: FitStats,
  source: string,
  value: number,
  type: 'flat' | 'percent' | 'multiplier',
  impact: 'positive' | 'negative',
  manualFinalValue?: number,
  isSkillPass: boolean = false
) {
  if (!stats.history[attrName]) return
  
  const history = stats.history[attrName];
  const isPenalizedAttr = PENALIZED_ATTRIBUTES.has(attrName);
  const isExempt = source.includes('Bonus') || source.includes('Skill') || source.includes('Role') || isSkillPass;
  
  history.modifiers.push({ source, value, type, impact, isExempt });
  
  if (manualFinalValue !== undefined && !isPenalizedAttr) {
    history.final = manualFinalValue
    return
  }

  let currentFinal = history.base;
  history.modifiers.filter(m => m.type === 'flat').forEach(m => {
    const flatValue = m.impact === 'negative' ? -Math.abs(m.value) : m.value
    currentFinal += flatValue
  });
  
  const mults = history.modifiers.filter(m => m.type !== 'flat');
  if (!isPenalizedAttr) {
    mults.forEach(m => {
      const mult = m.type === 'percent' ? (1 + m.value / 100) : m.value;
      currentFinal *= mult;
    });
  } else {
    const sortedMults = mults.map(m => {
      const actualMult = m.type === 'percent' ? (1 + m.value / 100) : m.value;
      const strength = Math.abs(Math.log(actualMult));
      return { ...m, actualMult, strength };
    }).sort((a, b) => b.strength - a.strength);
    
    let penaltyRank = 1;
    for (const mod of sortedMults) {
      if (mod.isExempt) {
        currentFinal *= mod.actualMult;
      } else {
        const efficiency = getStackingEfficiency(penaltyRank);
        const penalizedMult = 1 + (mod.actualMult - 1) * efficiency;
        currentFinal *= penalizedMult;
        penaltyRank++;
      }
    }
  }
  history.final = currentFinal;
}

function initSlotHistory(slotKey: string, attribute: string, baseValue: number, stats: FitStats) {
  if (!stats.slotHistory) stats.slotHistory = {}
  if (!stats.slotHistory[slotKey]) stats.slotHistory[slotKey] = {}
  stats.slotHistory[slotKey][attribute] = {
    base: baseValue,
    final: baseValue,
    modifiers: []
  }
}

function addSlotModifier(
  slotKey: string,
  attribute: string,
  stats: FitStats,
  source: string,
  value: number,
  type: 'flat' | 'percent' | 'multiplier',
  impact: 'positive' | 'negative',
  manualFinalValue?: number
) {
  if (!stats.slotHistory?.[slotKey]?.[attribute]) return
  
  const hist = stats.slotHistory[slotKey][attribute]
  const isExempt = source.includes('Bonus') || source.includes('Skill') || source.includes('Role');
  hist.modifiers.push({ source, value, type, impact, isExempt })
  
  if (manualFinalValue !== undefined) {
    hist.final = manualFinalValue
    return
  }

  let currentFinal = hist.base;
  hist.modifiers.filter(m => m.type === 'flat').forEach(m => {
    const flatValue = m.impact === 'negative' ? -Math.abs(m.value) : m.value
    currentFinal += flatValue
  });
  
  const mults = hist.modifiers.filter(m => m.type !== 'flat');
  const sortedMults = mults.map(m => {
    const actualMult = m.type === 'percent' ? (1 + m.value / 100) : m.value;
    const strength = Math.abs(Math.log(actualMult));
    return { ...m, actualMult, strength };
  }).sort((a, b) => b.strength - a.strength);
  
  let penaltyRank = 1;
  for (const mod of sortedMults) {
    if (mod.isExempt) {
      currentFinal *= mod.actualMult;
    } else {
      const efficiency = getStackingEfficiency(penaltyRank);
      const penalizedMult = 1 + (mod.actualMult - 1) * efficiency;
      currentFinal *= penalizedMult;
      penaltyRank++;
    }
  }
  hist.final = currentFinal;
}

// --- Validation Logic ---
export function checkModuleCompatibility(modStats: ModuleBaseStats, ship: ShipBaseStats, stats: FitStats, slotKey?: string) {
  const addError = (msg: string) => {
    stats.validation.errors.push(msg)
    if (slotKey) {
      if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
      stats.validation.slotErrors[slotKey].push(msg)
    }
  }

  // Hardware Slot Isolation (Hardware slots vs Drones/Cargo)
  if (modStats.categoryId === 18) { // Drones
    addError(`Item ${modStats.name} is a drone and must be placed in the Drone Bay.`)
    stats.validation.canFit = false
  }
  if (modStats.categoryId === 8) { // Charges
    addError(`Item ${modStats.name} is a charge and cannot be fitted directly into a ship slot.`)
    stats.validation.canFit = false
  }

  // Ship Group/Type Restrictions (authoritative dogmaAttributes from ModuleStats row)
  const attributes = modStats.dogmaAttributes || []
  const shipGroupIds = [
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_GROUP_1)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_GROUP_2)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_GROUP_3)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_GROUP_4)?.value,
  ].filter(id => id && id > 0)

  if (shipGroupIds.length > 0 && !shipGroupIds.includes(ship.groupId)) {
    addError(`Module ${modStats.name} cannot be fitted on this ship group.`)
    stats.validation.canFit = false
  }

  const shipTypeIds = [
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_TYPE_1)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_TYPE_2)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_TYPE_3)?.value,
    attributes.find((a) => a.attributeId === DOGMA_ATTRIBUTES.CAN_FIT_SHIP_TYPE_4)?.value,
  ].filter(id => id && id > 0)

  if (shipTypeIds.length > 0 && !shipTypeIds.includes(ship.typeId)) {
    addError(`Module ${modStats.name} is restricted to specific ship types.`)
    stats.validation.canFit = false
  }

  // Rig Size Validation
  if (modStats.slotType === 'rig' || slotKey?.startsWith('rig')) {
    const modRigSize = modStats.rigSize || 0
    const shipRigSize = ship.rigSize || 0
    
    if (modRigSize > 0 && shipRigSize > 0 && modRigSize !== shipRigSize) {
      const sizeNames: Record<number, string> = { 1: 'Small', 2: 'Medium', 3: 'Large', 4: 'Capital' }
      addError(`Cannot fit ${sizeNames[modRigSize] || 'unknown size'} rig on a ship that requires ${sizeNames[shipRigSize] || 'a different size'} rigs.`)
      stats.validation.canFit = false
    }
  }

  // Specialized checks that still require some group name matching (mostly for UI clarity)
  // but we prefer effect-based checks where possible.
  const groupLower = modStats.groupName?.toLowerCase() || ''
  if (groupLower.includes('vorton projector')) {
    const isEdencom = [3528, 3529, 3530].includes(ship.groupId) // Skybreaker, Stormbringer, Thunderchild
    if (!isEdencom) {
       addError(`Module ${modStats.name} can only be fitted on EDENCOM ships.`)
       stats.validation.canFit = false
    }
  }
}

// --- Calculation Helpers ---
function initializeStats(ship: ShipBaseStats): FitStats {
  const shieldRes = {
    em: resonanceToResistance(ship.shieldEmResist),
    therm: resonanceToResistance(ship.shieldThermResist),
    kin: resonanceToResistance(ship.shieldKinResist),
    exp: resonanceToResistance(ship.shieldExpResist)
  }
  const armorRes = {
    em: resonanceToResistance(ship.armorEmResist),
    therm: resonanceToResistance(ship.armorThermResist),
    kin: resonanceToResistance(ship.armorKinResist),
    exp: resonanceToResistance(ship.armorExpResist)
  }
  const hullRes = {
    em: resonanceToResistance(ship.hullEmResist),
    therm: resonanceToResistance(ship.hullThermResist),
    kin: resonanceToResistance(ship.hullKinResist),
    exp: resonanceToResistance(ship.hullExpResist)
  }
  return {
    groupId: ship.groupId,
    rigSize: ship.rigSize,
    cost: 0,
    cpu: { used: 0, total: ship.cpu, remaining: ship.cpu, overflow: false, percent: 0 },
    power: { used: 0, total: ship.powerGrid, remaining: ship.powerGrid, overflow: false, percent: 0 },
    powergrid: { used: 0, total: ship.powerGrid, remaining: ship.powerGrid, percent: 0 },
    calibration: { used: 0, total: ship.calibration, remaining: ship.calibration, overflow: false, percent: 0 },
    slots: {
      high: { used: 0, total: ship.highSlots, overflow: false },
      med: { used: 0, total: ship.medSlots, overflow: false },
      low: { used: 0, total: ship.lowSlots, overflow: false },
      rig: { used: 0, total: ship.rigSlots, overflow: false },
      service: { used: 0, total: 0, overflow: false },
      drone: { used: 0, total: 0, overflow: false }
    },
    hardpoints: {
      turrets: { used: 0, total: ship.turretHardpoints || 0, overflow: false },
      launchers: { used: 0, total: ship.launcherHardpoints || 0, overflow: false }
    },
    dps: { total: 0, turret: 0, missile: 0, drone: 0 },
    volley: { total: 0 },
    range: { optimal: 0, falloff: 0 },
    resistance: {
      shield: shieldRes,
      armor: armorRes,
      hull: hullRes
    },
    tank: {
      shield: { hp: ship.shieldCapacity, regen: 0, maxRegen: 0 },
      armor: { hp: ship.armorHP, repair: 0 },
      hull: { hp: ship.hullHP, repair: 0 }
    },
    ehp: { shield: 0, armor: 0, hull: 0, total: 0 },
    capacitor: {
      capacity: ship.capacitor,
      rechargeRate: ship.capacitorRecharge,
      stable: true,
      usePerSecond: 0,
      deltaPerSecond: 0,
      peakDelta: 0,
      timeToEmpty: Infinity,
      percent: 100
    },
    targeting: {
      maxTargets: ship.maxLockedTargets || 5,
      range: ship.maxTargetRange || 50000,
      scanRes: ship.scanResolution || 100,
      sensorStrength: ship.sensorStrength || 10,
      signature: ship.signatureRadius || 100
    },
    velocity: {
      maxSpeed: ship.maxVelocity,
      alignTime: 0,
      warpSpeed: ship.warpSpeed
    },
    mass: ship.mass,
    agility: ship.agility,
    history: {},
    slotHistory: {},
    validation: {
      canFit: true,
      powergridOverflow: false,
      cpuOverflow: false,
      slotsOverflow: { 
        high: false, 
        med: false, 
        low: false, 
        rig: false,
        subsystem: false
      },
      calibrationOverflow: false,
      errors: [],
      warnings: [],
      moduleDataQualityWarnedTypeIds: [],
      slotErrors: {}
    }
  }
}

function calculateEHP(stats: FitStats, ship: ShipBaseStats) {
  const sRes = stats.resistance.shield
  const aRes = stats.resistance.armor
  const hRes = stats.resistance.hull
  const shieldMult = 1 / (1 - (sRes.em + sRes.therm + sRes.kin + sRes.exp) / 4)
  const armorMult = 1 / (1 - (aRes.em + aRes.therm + aRes.kin + aRes.exp) / 4)
  const hullMult = 1 / (1 - (hRes.em + hRes.therm + hRes.kin + hRes.exp) / 4)
  stats.ehp.shield = stats.tank.shield.hp * shieldMult
  stats.ehp.armor = stats.tank.armor.hp * armorMult
  stats.ehp.hull = stats.tank.hull.hp * hullMult
  stats.ehp.total = stats.ehp.shield + stats.ehp.armor + stats.ehp.hull
}

function pushModuleDataQualityWarning(stats: FitStats, modStats: ModuleBaseStats, typeId: number) {
  if (!modStats.dataQualityWarning) return
  const seen = stats.validation.moduleDataQualityWarnedTypeIds ?? []
  if (seen.includes(typeId)) return
  seen.push(typeId)
  stats.validation.moduleDataQualityWarnedTypeIds = seen
  const label =
    modStats.name.length > 48 ? `${modStats.name.slice(0, 45)}…` : modStats.name
  stats.validation.warnings.push(`${label} (type ${typeId}): ${modStats.dataQualityWarning}`)
}

async function getDroneDps(
  typeId: number,
  stats?: FitStats
): Promise<{ dps: number; tracking: number }> {
  const droneStats = await getModuleStats(typeId)
  if (!droneStats) return { dps: 0, tracking: 0 }
  if (stats) pushModuleDataQualityWarning(stats, droneStats, typeId)
  const attrs = Array.isArray(droneStats.dogmaAttributes) ? droneStats.dogmaAttributes : []
  const damage = Number(droneStats.damage || 0)
  const fireRate = Number(droneStats.fireRate || 1)
  const dps = fireRate > 0 ? damage / fireRate : 0
  const trackingAttr = attrs.find((a) => Number(a.attributeId) === 160)
  const tracking = Number(trackingAttr?.value ?? droneStats.trackingSpeed ?? 0)
  return { dps, tracking }
}

// --- Trait Application ---
function applyShipTraits(traits: ShipTrait[], stats: FitStats, ship: ShipBaseStats, slots: FitSlot) {
  const shipGroup = ship.groupName?.toLowerCase() || ''

  if (shipGroup === 'marauder') {
    const hasBastion = slots.high.some(m => m && m.groupName?.toLowerCase() === 'bastion module' && !m.offline)
    if (hasBastion) {
      addModifier('Shield Boost Rate', stats, 'Bastion Mode', 100, 'percent', 'positive')
      addModifier('Armor Repair Rate', stats, 'Bastion Mode', 100, 'percent', 'positive')
      addModifier('Optimal Range', stats, 'Bastion Mode', 25, 'percent', 'positive')
      addModifier('Falloff Range', stats, 'Bastion Mode', 25, 'percent', 'positive')
      addModifier('Tracking Speed', stats, 'Bastion Mode', 25, 'percent', 'positive')
      addModifier('Max Speed', stats, 'Bastion Mode', -100, 'percent', 'negative')
      const bastionResistMult = 0.5 
      applyResistanceBonus('shield em resistance', 'shield', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('shield thermal resistance', 'shield', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('shield kinetic resistance', 'shield', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('shield explosive resistance', 'shield', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('armor em resistance', 'armor', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('armor thermal resistance', 'armor', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('armor kinetic resistance', 'armor', stats, 'Bastion Mode', bastionResistMult, 'positive')
      applyResistanceBonus('armor explosive resistance', 'armor', stats, 'Bastion Mode', bastionResistMult, 'positive')
    }
  }
  
  if (shipGroup === 'black ops') {
    addModifier('Max Speed', stats, 'Black Ops Role', 25, 'percent', 'positive')
    addModifier('Agility', stats, 'Black Ops Role', -20, 'percent', 'positive')
  }

  if (shipGroup === 'interceptor') {
    addModifier('Signature Radius', stats, 'Interceptor Role', -15, 'percent', 'positive')
  }
}

function applyResistanceBonus(text: string, type: 'shield' | 'armor' | 'hull', stats: FitStats, source: string, mult: number, impact: string) {
  const resists = ['em', 'thermal', 'kinetic', 'explosive']
  for (const res of resists) {
    if (text.includes(`${type} ${res} resistance`)) {
      const key = res === 'thermal' ? 'therm' : (res === 'explosive' ? 'exp' : (res === 'kinetic' ? 'kin' : 'em'))
      const resName = res === 'em' ? 'EM' : (res === 'thermal' ? 'Thermal' : (res === 'kinetic' ? 'Kinetic' : 'Explosive'))
      const attrName = `${type.charAt(0).toUpperCase() + type.slice(1)} ${resName} Resist`
      const resistanceMap = stats.resistance[type] as Record<string, number>
      const incoming = 1 - resistanceMap[key]
      const newIncoming = incoming * mult
      resistanceMap[key] = 1 - newIncoming
      addModifier(attrName, stats, source, mult, 'multiplier', impact as any, resistanceMap[key])
    }
  }
}

function applyModuleTraits(slotKey: string, modStats: ModuleBaseStats, shipTraits: ShipTrait[], stats: FitStats) {
  const effectIds = Array.isArray(modStats.effects)
    ? modStats.effects.map((e) => Number(e.effectId))
    : []

  if (modStats.damageMultiplier && modStats.damageMultiplier !== 1) {
    const pct = (modStats.damageMultiplier - 1) * 100
    addSlotModifier(
      slotKey,
      'Damage Multiplier',
      stats,
      `${modStats.name} effect`,
      pct,
      'percent',
      pct >= 0 ? 'positive' : 'negative'
    )
  }
  if (modStats.rofMultiplier && modStats.rofMultiplier !== 1) {
    const pct = (modStats.rofMultiplier - 1) * 100
    addSlotModifier(
      slotKey,
      'Fire Rate',
      stats,
      `${modStats.name} effect`,
      pct,
      'percent',
      pct <= 0 ? 'positive' : 'negative'
    )
  }
  if (modStats.optimalRange) {
    addSlotModifier(slotKey, 'Optimal Range', stats, `${modStats.name} effect`, modStats.optimalRange, 'flat', 'positive')
  }
  if (modStats.falloffRange) {
    addSlotModifier(slotKey, 'Falloff Range', stats, `${modStats.name} effect`, modStats.falloffRange, 'flat', 'positive')
  }
  if (modStats.trackingSpeed) {
    addSlotModifier(slotKey, 'Tracking Speed', stats, `${modStats.name} effect`, modStats.trackingSpeed, 'flat', 'positive')
  }
  if (modStats.capacitorNeed) {
    addSlotModifier(
      slotKey,
      'Capacitor Need',
      stats,
      `${modStats.name} effect`,
      modStats.capacitorNeed,
      'flat',
      modStats.capacitorNeed <= 0 ? 'positive' : 'negative'
    )
  }
  if (modStats.repairAmount) {
    addSlotModifier(slotKey, 'Repair Amount', stats, `${modStats.name} effect`, modStats.repairAmount, 'flat', 'positive')
  }
  if (modStats.speedBonus) {
    addSlotModifier(
      slotKey,
      'Velocity Bonus',
      stats,
      `${modStats.name} effect`,
      modStats.speedBonus,
      'percent',
      modStats.speedBonus >= 0 ? 'positive' : 'negative'
    )
  }

  if (effectIds.includes(DOGMA_EFFECTS.TURRET_FITTED) && modStats.damageMultiplier && modStats.damageMultiplier > 1) {
    addSlotModifier(
      slotKey,
      'Damage Multiplier',
      stats,
      'Turret role modifier',
      (modStats.damageMultiplier - 1) * 100,
      'percent',
      'positive'
    )
  }
  if (effectIds.includes(DOGMA_EFFECTS.LAUNCHER_FITTED) && modStats.damageMultiplier && modStats.damageMultiplier > 1) {
    addSlotModifier(
      slotKey,
      'Damage Multiplier',
      stats,
      'Launcher role modifier',
      (modStats.damageMultiplier - 1) * 100,
      'percent',
      'positive'
    )
  }
}

// --- API Functions ---
export async function getShipStats(typeId: number): Promise<ShipBaseStats | null> {
  if (shipStatsCache.has(typeId)) return shipStatsCache.get(typeId)!
  try {
    const stats = await prisma.shipStats.findUnique({ 
      where: { typeId }, 
      include: { traits: true, dogmaAttributes: true } 
    }) 
    if (stats) {
      const s = stats as any
      const restrictions = (s.restrictions as any) || {}
      const syncIdentity = restrictions.syncMeta?.identity || restrictions.syncIdentity || {}
      const rigSizeFromRestriction = typeof restrictions.rigSize === 'number' ? restrictions.rigSize : 0
      const fullStats: ShipBaseStats = {
        typeId: stats.typeId, groupId: (stats as any).groupId || 0, name: stats.name, groupName: s.groupName,
        highSlots: stats.highSlots || 0, medSlots: stats.medSlots || 0, lowSlots: stats.lowSlots || 0, rigSlots: stats.rigSlots || 0,
        cpu: stats.cpu || 0, powerGrid: stats.powerGrid || 0, calibration: s.calibration || 0,
        capacitor: stats.capacitor || 0, capacitorRecharge: stats.capacitorRecharge || 280000,
        shieldCapacity: stats.shieldCapacity || 0, armorHP: stats.armorHP || 0, hullHP: stats.hullHP || 0,
        shieldEmResist: stats.shieldEmResist || 0, shieldExpResist: stats.shieldExpResist || 0, shieldKinResist: stats.shieldKinResist || 0, shieldThermResist: stats.shieldThermResist || 0,
        armorEmResist: stats.armorEmResist || 0, armorExpResist: stats.armorExpResist || 0, armorKinResist: stats.armorKinResist || 0, armorThermResist: stats.armorThermResist || 0,
        hullEmResist: stats.hullEmResist || 0, hullExpResist: stats.hullExpResist || 0, hullKinResist: stats.hullKinResist || 0, hullThermResist: stats.hullThermResist || 0,
        maxVelocity: stats.maxVelocity || 0, agility: stats.agility || 1, mass: stats.mass || 0, warpSpeed: stats.warpSpeed || 0,
        droneBay: stats.droneBay || 0, droneBandwidth: s.droneBandwidth || 0, cargo: stats.cargo || 0,
        maxLockedTargets: s.maxLockedTargets || 5, maxTargetRange: s.maxTargetRange || 50000,
        signatureRadius: s.signatureRadius || 100, scanResolution: s.scanResolution || 100,
        sensorStrength: s.sensorStrength || 0, sensorType: s.sensorType || '',
        turretHardpoints: s.turretHardpoints || 0, launcherHardpoints: s.launcherHardpoints || 0,
        rigSize: rigSizeFromRestriction || stats.dogmaAttributes.find((a) => a.attributeId === 1547)?.value || 0,
        categoryId: s.categoryId || 0,
        dataQualityWarning: typeof syncIdentity.warning === 'string' && syncIdentity.warning.length > 0 ? syncIdentity.warning : undefined,
        syncIdentity,
        traits: s.traits || []
      }
      setCache(shipStatsCache, typeId, fullStats); return fullStats
    }
  } catch (e) { logger.error('DogmaCalculator', `Error fetching ship stats for type ${typeId}`, e) }
  return null
}

export async function getShipByName(name: string): Promise<ShipBaseStats | null> {
  try {
    const stats = await prisma.shipStats.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, include: { traits: true } })
    if (stats) return getShipStats(stats.typeId)
  } catch (e) { logger.error('DogmaCalculator', `Error fetching ship by name ${name}:`, e) }
  return null
}

export async function getModuleStats(typeId: number): Promise<ModuleBaseStats | null> {
  if (moduleStatsCache.has(typeId)) return moduleStatsCache.get(typeId)!
  try {
    const stats = await prisma.moduleStats.findUnique({ 
      where: { typeId },
      include: { dogmaAttributes: true }
    })
    if (stats) { 
      const mod = stats as any
      const effects = (mod.effects as DogmaEffect[]) || []
      const rigSize = (mod.dogmaAttributes as DogmaAttribute[])?.find((a) => a.attributeId === DOGMA_ATTRIBUTES.RIG_SIZE)?.value || 0
      const restrictions = (mod.restrictions as Record<string, unknown>) || {}
      const syncIdentity = restrictions.syncIdentity as
        | { warning?: string | null; nameSource?: string; groupIdSource?: string; categoryIdSource?: string }
        | undefined
      const syncMetaIdentity = (restrictions.syncMeta as { identity?: { warning?: string | null } } | undefined)
        ?.identity
      const warn =
        (typeof syncIdentity?.warning === 'string' && syncIdentity.warning.length > 0
          ? syncIdentity.warning
          : undefined) ??
        (typeof syncMetaIdentity?.warning === 'string' && syncMetaIdentity.warning.length > 0
          ? syncMetaIdentity.warning
          : undefined)
      const fullStats: ModuleBaseStats = { 
        ...stats, 
        effects, 
        rigSize,
        groupId: stats.groupId || 0,
        categoryId: (stats as any).categoryId,
        dogmaAttributes: mod.dogmaAttributes,
        dataQualityWarning: warn,
        syncIdentity: syncIdentity
          ? {
              nameSource: syncIdentity.nameSource,
              groupIdSource: syncIdentity.groupIdSource,
              categoryIdSource: syncIdentity.categoryIdSource,
              warning: syncIdentity.warning ?? null,
            }
          : undefined,
      }
      setCache(moduleStatsCache, typeId, fullStats)
      return fullStats
    }
  } catch (e) { logger.error('DogmaCalculator', `Error fetching module stats for type ${typeId}`, e) }
  return null
}

export async function getChargeStats(typeId: number): Promise<ChargeBaseStats | null> {
  if (chargeStatsCache.has(typeId)) return chargeStatsCache.get(typeId)!
  try {
    const stats = await prisma.chargeStats.findUnique({ where: { typeId } })
    if (stats) { 
      const fullStats = stats as ChargeBaseStats
      setCache(chargeStatsCache, typeId, fullStats)
      return stats
    }
  } catch (e) { logger.error('DogmaCalculator', `Error fetching module stats for name ${name}`, e) }
  return null
}

export async function getModuleByName(name: string): Promise<ModuleBaseStats | null> {
  try {
    const stats = await prisma.moduleStats.findFirst({ where: { name: { contains: name, mode: 'insensitive' } } })
    if (stats) return getModuleStats(stats.typeId)
  } catch (e) { logger.error('DogmaCalculator', `Error fetching module by name ${name}:`, e) }
  return null
}

export async function calculateFitStats(
  shipInput: number | ShipBaseStats,
  slots: FitSlot,
  skillProfile?: SkillProfile
): Promise<FitStats> {
  let ship: ShipBaseStats | null
  if (typeof shipInput === 'number') {
    ship = await getShipStats(shipInput)
  } else if (!shipInput.dogmaAttributes) {
    ship = await getShipStats(shipInput.typeId)
  } else {
    ship = shipInput
  }
  
  if (!ship) throw new Error(`Ship statistics not found`)

  const stats = initializeStats(ship)
  if (ship.dataQualityWarning) {
    stats.validation.warnings.push(ship.dataQualityWarning)
  }

  initAttributeHistory('CPU', ship.cpu, stats)
  initAttributeHistory('Powergrid', ship.powerGrid, stats)
  initAttributeHistory('Shield HP', ship.shieldCapacity, stats)
  initAttributeHistory('Armor HP', ship.armorHP, stats)
  initAttributeHistory('Hull HP', ship.hullHP, stats)
  initAttributeHistory('Capacitor', ship.capacitor, stats)
  initAttributeHistory('Capacitor Recharge', ship.capacitorRecharge, stats)
  initAttributeHistory('Max Speed', ship.maxVelocity, stats)
  initAttributeHistory('Scan Resolution', ship.scanResolution || 100, stats)
  initAttributeHistory('Signature Radius', ship.signatureRadius || 100, stats)
  initAttributeHistory('Agility', ship.agility || 1, stats)
  initAttributeHistory('Warp Speed', ship.warpSpeed || 0, stats)
  initAttributeHistory('Sensor Strength', ship.sensorStrength || 0, stats)
  initAttributeHistory('Max Target Range', ship.maxTargetRange || 50000, stats)
  initAttributeHistory('Max Locked Targets', ship.maxLockedTargets || 5, stats)
  initAttributeHistory('Mass', ship.mass || 0, stats)
  initAttributeHistory('Shield Boost Rate', 100, stats)
  initAttributeHistory('Armor Repair Rate', 100, stats)
  initAttributeHistory('Shield EM Resist', resonanceToResistance(ship.shieldEmResist), stats)
  initAttributeHistory('Shield Thermal Resist', resonanceToResistance(ship.shieldThermResist), stats)
  initAttributeHistory('Shield Kinetic Resist', resonanceToResistance(ship.shieldKinResist), stats)
  initAttributeHistory('Shield Explosive Resist', resonanceToResistance(ship.shieldExpResist), stats)
  initAttributeHistory('Armor EM Resist', resonanceToResistance(ship.armorEmResist), stats)
  initAttributeHistory('Armor Thermal Resist', resonanceToResistance(ship.armorThermResist), stats)
  initAttributeHistory('Armor Kinetic Resist', resonanceToResistance(ship.armorKinResist), stats)
  initAttributeHistory('Armor Explosive Resist', resonanceToResistance(ship.armorExpResist), stats)
  initAttributeHistory('Hull EM Resist', resonanceToResistance(ship.hullEmResist), stats)
  initAttributeHistory('Hull Thermal Resist', resonanceToResistance(ship.hullThermResist), stats)
  initAttributeHistory('Hull Kinetic Resist', resonanceToResistance(ship.hullKinResist), stats)
  initAttributeHistory('Hull Explosive Resist', resonanceToResistance(ship.hullExpResist), stats)

  if (skillProfile) {
    for (const skill of skillProfile.skills) {
      const effect = SKILL_MAP[skill.id]
      if (effect) {
        addModifier(
          effect.attr,
          stats,
          `Skill: ${skill.name || skill.id}`,
          effect.bonus * skill.level,
          effect.type,
          effect.impact,
          undefined,
          true
        )
      }
    }
    for (const implant of skillProfile.implants || []) {
      if (!implant.value || !implant.bonusTag) continue
      addModifier(
        implant.bonusTag,
        stats,
        `Implant: ${implant.name || implant.typeId}`,
        implant.value,
        'percent',
        implant.value >= 0 ? 'positive' : 'negative',
        undefined,
        true
      )
    }
    for (const booster of skillProfile.boosters || []) {
      if (booster.value && booster.bonusTag) {
        addModifier(
          booster.bonusTag,
          stats,
          `Booster: ${booster.name || booster.typeId}`,
          booster.value,
          'percent',
          booster.value >= 0 ? 'positive' : 'negative',
          undefined,
          true
        )
      }
      if (booster.sideEffectTag && booster.sideEffectValue) {
        addModifier(
          booster.sideEffectTag,
          stats,
          `Booster side effect: ${booster.name || booster.typeId}`,
          booster.sideEffectValue,
          'percent',
          booster.sideEffectValue >= 0 ? 'negative' : 'positive',
          undefined,
          true
        )
      }
    }
    if ((skillProfile.fleet?.warfareLinkStrength || 0) > 0) {
      addModifier(
        'Max Speed',
        stats,
        'Fleet burst',
        skillProfile.fleet?.warfareLinkStrength || 0,
        'percent',
        'positive',
        undefined,
        true
      )
    }
  }

  applyShipTraits(ship.traits || [], stats, ship, slots)

  await processSlot(slots.high, 'high', stats, ship.traits, ship)
  await processSlot(slots.med, 'med', stats, ship.traits, ship)
  await processSlot(slots.low, 'low', stats, ship.traits, ship)
  await processSlot(slots.rig, 'rig', stats, ship.traits, ship)
  if (slots.subsystem) await processSlot(slots.subsystem, 'subsystem', stats, ship.traits, ship)

  if (slots.drone) {
    for (const drone of slots.drone) {
      const d = await getDroneDps(drone.typeId, stats)
      const droneDpsTotal = d.dps * (drone.quantity || 1)
      stats.dps.drone += droneDpsTotal
      stats.dps.total += droneDpsTotal
    }
  }

  stats.cpu.total = stats.history['CPU'].final
  stats.power.total = stats.history['Powergrid'].final
  stats.tank.shield.hp = stats.history['Shield HP'].final
  stats.tank.armor.hp = stats.history['Armor HP'].final
  stats.tank.hull.hp = stats.history['Hull HP'].final
  stats.capacitor.capacity = stats.history['Capacitor'].final
  stats.capacitor.rechargeRate = stats.history['Capacitor Recharge'].final
  const capUsePerSecond = Object.values(stats.slotHistory || {}).reduce((acc, slot) => {
    const need = slot['Capacitor Need']?.final
    const cycle = slot['Fire Rate']?.final
    if (!need || !cycle || cycle <= 0) return acc
    return acc + need / cycle
  }, 0)
  const capSim = simulateCapacitor({
    capacity: stats.capacitor.capacity,
    rechargeTimeMs: stats.capacitor.rechargeRate,
    usagePerSecond: capUsePerSecond,
  })
  stats.capacitor.usePerSecond = capUsePerSecond
  stats.capacitor.peakDelta = capSim.peakDelta
  stats.capacitor.deltaPerSecond = capSim.deltaPerSecond
  stats.capacitor.stable = capSim.stable
  stats.capacitor.percent = capSim.percent
  stats.capacitor.timeToEmpty = capSim.timeToEmpty
  stats.velocity.maxSpeed = stats.history['Max Speed'].final
  stats.velocity.warpSpeed = stats.history['Warp Speed'].final
  stats.targeting.scanRes = stats.history['Scan Resolution'].final
  stats.targeting.signature = stats.history['Signature Radius'].final
  stats.targeting.sensorStrength = stats.history['Sensor Strength'].final
  stats.targeting.range = stats.history['Max Target Range'].final
  stats.targeting.maxTargets = Math.round(stats.history['Max Locked Targets'].final)
  stats.mass = stats.history['Mass'].final


  // Max One Per Ship Validation (Authoritative + Fallback)
  const maxOneGroups = ['Damage Control', 'Micro Jump Drive', 'Warp Core Stabilizer', 'Interdiction Nullifier', 'Micro Jump Field Generator'];
  const uniqueGroupCounts = new Map<number, { count: number, max: number, name: string, modules: any[] }>()
  
  const allModules = [
    ...slots.high, 
    ...slots.med, 
    ...slots.low, 
    ...slots.rig, 
    ...(slots.subsystem || [])
  ].filter(m => m !== null)

  allModules.forEach(m => {
    if (!m || m.offline) return
    const modStats = moduleStatsCache.get(m.typeId)
    if (!modStats) return

    const maxActiveAttr = modStats.dogmaAttributes?.find((a: any) => a.attributeId === DOGMA_ATTRIBUTES.MAX_GROUP_ACTIVE)
    const maxActive = maxActiveAttr ? maxActiveAttr.value : (maxOneGroups.includes(modStats.groupName || '') ? 1 : 0)

    if (maxActive > 0) {
      const groupId = modStats.groupId || -1
      const current = uniqueGroupCounts.get(groupId) || { count: 0, max: maxActive, name: modStats.groupName || 'Unknown Group', modules: [] as Module[] }
      current.count++
      current.modules.push(m)
      uniqueGroupCounts.set(groupId, current)
    }
  })

  uniqueGroupCounts.forEach((data) => {
    if (data.count > data.max) {
      const msg = `Only ${data.max} ${data.name} allowed per ship`
      stats.validation.errors.push(msg)
      data.modules.forEach((m, i) => {
        const slotType = m.slot || 'unknown'
        const slotIdx = m.slotIndex !== undefined ? m.slotIndex : i
        const key = `${slotType}-${slotIdx}`
        if (!stats.validation.slotErrors[key]) stats.validation.slotErrors[key] = []
        stats.validation.slotErrors[key].push(msg)
      })
      stats.validation.canFit = false
    }
  });

  if (ship.groupId === 1305) { // Strategic Cruiser
    const subCount = (slots.subsystem || []).filter(m => !!m).length
    if (subCount < 4) {
      stats.validation.errors.push(`Strategic Cruisers require exactly 4 subsystems to be complete.`)
      stats.validation.canFit = false
    }
  }

  if (stats.calibration.used > stats.calibration.total) {
    stats.validation.calibrationOverflow = true
    stats.validation.canFit = false
    stats.validation.errors.push(
      `Calibration overflow (${stats.calibration.used.toFixed(0)} / ${stats.calibration.total.toFixed(0)})`
    )
  }

  stats.cpu.overflow = stats.cpu.used > stats.cpu.total
  stats.power.overflow = stats.power.used > stats.power.total
  stats.hardpoints.turrets.overflow = stats.hardpoints.turrets.used > stats.hardpoints.turrets.total
  stats.hardpoints.launchers.overflow = stats.hardpoints.launchers.used > stats.hardpoints.launchers.total

  stats.cpu.percent = (stats.cpu.used / stats.cpu.total) * 100
  stats.power.percent = (stats.power.used / stats.power.total) * 100
  
  if (stats.cpu.overflow) stats.validation.errors.push('CPU overflow')
  if (stats.power.overflow) stats.validation.errors.push('Powergrid overflow')
  if (stats.hardpoints.turrets.overflow) stats.validation.errors.push(`Turret hardpoints exceeded (${stats.hardpoints.turrets.used}/${stats.hardpoints.turrets.total})`)
  if (stats.hardpoints.launchers.overflow) stats.validation.errors.push(`Launcher hardpoints exceeded (${stats.hardpoints.launchers.used}/${stats.hardpoints.launchers.total})`)

  if (stats.cpu.overflow || stats.power.overflow || stats.hardpoints.turrets.overflow || stats.hardpoints.launchers.overflow) {
    stats.validation.canFit = false
  }

  calculateEHP(stats, ship)
  stats.ehp.total = effectiveHitPointsWithProfile(stats)
  if (stats.mass > 0 && stats.history['Agility'].final > 0) stats.velocity.alignTime = (stats.mass * stats.history['Agility'].final / 500000) * 0.6931
  stats.provenance = Object.fromEntries(
    Object.entries(stats.history).map(([attribute, h]) => [
      attribute,
      h.modifiers.map((m) => ({
        source: m.source,
        phase: 'mulStack' as const,
        value: m.value,
        type: m.type,
        impact: m.impact,
        penaltyRank: m.penaltyRank,
        note: m.isExempt ? 'stacking_exempt' : undefined,
      })),
    ])
  )
  
  return stats
}

async function processSlot(modules: Module[], slotType: string, stats: FitStats, shipTraits: any[] = [], ship: ShipBaseStats) {
  const isRig = slotType === 'rig'
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]
    if (!mod || mod.offline) continue
    const modStats = await getModuleStats(mod.typeId)
    if (!modStats) continue
    const slotIndex = mod.slotIndex !== undefined ? mod.slotIndex : i
    const slotKey = `${slotType}-${slotIndex}`

    pushModuleDataQualityWarning(stats, modStats, mod.typeId)

    checkModuleCompatibility(modStats, ship, stats, slotKey)

    const requiredSlot = inferModuleSlotTypeFromEffects(modStats)
    if (requiredSlot && requiredSlot !== slotType) {
      const msg = `Module ${modStats.name} requires a ${requiredSlot} slot, not ${slotType}.`
      stats.validation.errors.push(msg)
      if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
      stats.validation.slotErrors[slotKey].push(msg)
      stats.validation.canFit = false
    } else if (!requiredSlot && modStats.slotType) {
      const dbSlot = modStats.slotType === 'mid' ? 'med' : modStats.slotType
      if (['high', 'med', 'low', 'rig', 'subsystem'].includes(dbSlot) && dbSlot !== slotType) {
        const msg = `Module ${modStats.name} requires a ${dbSlot} slot, not ${slotType}.`
        stats.validation.errors.push(msg)
        if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
        stats.validation.slotErrors[slotKey].push(msg)
        stats.validation.canFit = false
      }
    }
    
    let baseDamage = modStats.damage || 0
    const chargeTypeId = mod.charge?.id ?? mod.chargeTypeId
    if (chargeTypeId) {
      const chargeRow = await prisma.chargeStats.findUnique({ where: { typeId: chargeTypeId } })
      if (!chargeRow) {
        const msg = `Charge type ${chargeTypeId} not found`
        stats.validation.errors.push(msg)
        if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
        stats.validation.slotErrors[slotKey].push(msg)
        stats.validation.canFit = false
      } else {
        const chargeErrors = getChargeCompatibilityErrors(
          modStats as unknown as ChargeCompatibilityModuleShape,
          chargeRow
        )
        for (const msg of chargeErrors) {
          stats.validation.errors.push(msg)
          if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
          stats.validation.slotErrors[slotKey].push(msg)
          stats.validation.canFit = false
        }
        const charge = await getChargeStats(chargeTypeId)
        if (charge) baseDamage = charge.emDamage + charge.thermDamage + charge.kinDamage + charge.expDamage
      }
    }

    initSlotHistory(slotKey, 'Base Damage', baseDamage, stats)
    initSlotHistory(slotKey, 'Damage Multiplier', modStats.damageMultiplier || 1, stats)
    initSlotHistory(slotKey, 'Optimal Range', modStats.optimalRange || 0, stats)
    initSlotHistory(slotKey, 'Falloff Range', modStats.falloffRange || 0, stats)
    initSlotHistory(slotKey, 'Tracking Speed', modStats.trackingSpeed || 0, stats)
    initSlotHistory(slotKey, 'Fire Rate', modStats.fireRate || 1, stats)

    applyModuleTraits(slotKey, modStats, shipTraits || [], stats)
    if (mod.state === 'overloaded') {
      addSlotModifier(slotKey, 'Damage Multiplier', stats, `${modStats.name} overheat`, 10, 'percent', 'positive')
      addSlotModifier(slotKey, 'Fire Rate', stats, `${modStats.name} overheat`, -10, 'percent', 'positive')
      addSlotModifier(slotKey, 'Capacitor Need', stats, `${modStats.name} overheat`, 10, 'percent', 'negative')
    }

    stats.cpu.used += modStats.cpu
    addModifier('CPU', stats, modStats.name, modStats.cpu, 'flat', 'negative')
    stats.power.used += modStats.powerGrid
    addModifier('Powergrid', stats, modStats.name, modStats.powerGrid, 'flat', 'negative')
    if (isRig) {
      const calib = modStats.calibration || 0
      stats.calibration.used += calib
      addModifier('Calibration', stats, modStats.name, calib, 'flat', 'negative')
    }    // Hardpoint Validation
    const rawEffects = modStats.effects
    const effectIds = new Set<number>()
    if (Array.isArray(rawEffects)) {
      rawEffects.forEach((e: any) => {
        if (typeof e === 'number') effectIds.add(e)
        else if (e && typeof e === 'object' && 'effectId' in e) effectIds.add(Number(e.effectId))
      })
    } else if (rawEffects && typeof rawEffects === 'object') {
      const ids = (rawEffects as any).effectIds
      if (Array.isArray(ids)) {
        ids.forEach((id: any) => effectIds.add(Number(id)))
      }
    }

    const isTurret = effectIds.has(DOGMA_EFFECTS.TURRET_FITTED) || modStats.groupName?.includes('Turret')
    const isLauncher = effectIds.has(DOGMA_EFFECTS.LAUNCHER_FITTED) || modStats.groupName?.includes('Launcher')

    if (isTurret) {
      stats.hardpoints.turrets.used += 1
      if (stats.hardpoints.turrets.used > stats.hardpoints.turrets.total) {
        const msg = `Turret hardpoints exceeded: ship only supports ${stats.hardpoints.turrets.total} Turrets`
        stats.validation.errors.push(msg)
        if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
        stats.validation.slotErrors[slotKey].push(msg)
      }
    }
    if (isLauncher) {
      stats.hardpoints.launchers.used += 1
      if (stats.hardpoints.launchers.used > stats.hardpoints.launchers.total) {
        const msg = `Launcher hardpoints exceeded: ship only supports ${stats.hardpoints.launchers.total} Launchers`
        stats.validation.errors.push(msg)
        if (!stats.validation.slotErrors[slotKey]) stats.validation.slotErrors[slotKey] = []
        stats.validation.slotErrors[slotKey].push(msg)
      }
    } 

    if (modStats.speedBonus > 0) addModifier('Max Speed', stats, modStats.name, modStats.speedBonus, 'percent', 'positive')
    if (modStats.mass > 0) addModifier('Mass', stats, modStats.name, modStats.mass, 'flat', 'negative')
    if (modStats.shieldBonus > 0) addModifier('Shield HP', stats, modStats.name, modStats.shieldBonus, 'flat', 'positive')
    if (modStats.armorBonus > 0) addModifier('Armor HP', stats, modStats.name, modStats.armorBonus, 'flat', 'positive')
    
    const finalDamageMult = stats.slotHistory[slotKey]['Damage Multiplier'].final
    const finalFireRate = stats.slotHistory[slotKey]['Fire Rate'].final
    const finalVolley = stats.slotHistory[slotKey]['Base Damage'].final * finalDamageMult
    if (finalVolley > 0) {
      const baseDps = finalVolley / finalFireRate
      const defaultTarget = {
        signatureRadius: 125,
        velocity: 180,
        angularVelocity: 0.04,
      }
      const groupName = String(modStats.groupName || '').toLowerCase()
      let applicationFactor = 1
      if (groupName.includes('turret')) {
        applicationFactor = turretHitChance({
          optimal: Math.max(1, stats.slotHistory[slotKey]['Optimal Range'].final || 1),
          falloff: Math.max(1, stats.slotHistory[slotKey]['Falloff Range'].final || 1),
          tracking: Math.max(0.0001, stats.slotHistory[slotKey]['Tracking Speed'].final || 0.0001),
          rangeToTarget: Math.max(1, stats.slotHistory[slotKey]['Optimal Range'].final || 1),
          target: defaultTarget,
        })
      } else if (groupName.includes('launcher')) {
        const charge = chargeTypeId ? await getChargeStats(chargeTypeId) : null
        applicationFactor = missileApplicationFactor({
          explosionRadius: Math.max(1, Number(charge?.explosionRadius || 140)),
          explosionVelocity: Math.max(1, Number(charge?.explosionVelocity || 120)),
          target: defaultTarget,
        })
      }
      const dps = baseDps * applicationFactor
      stats.dps.total += dps
      if (modStats.groupName?.includes('Turret')) stats.dps.turret += dps
      if (modStats.groupName?.includes('Launcher')) stats.dps.missile += dps
      stats.volley.total += finalVolley
    }
  }
}

export function parseEftFormat(eftText: string): Partial<FitSlot> & { shipName: string; fitName: string } {
  const lines = eftText.trim().split('\n')
  const header = lines[0].replace(/[\[\]]/g, '').split(',')
  const result: any = { shipName: header[0]?.trim(), fitName: header[1]?.trim() || 'Unnamed', high: [], med: [], low: [], rig: [] }
  let current: keyof FitSlot = 'high'
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line || line.startsWith('[')) continue
    if (line.toLowerCase().includes('rig ')) current = 'rig'
    else if (line.toLowerCase().includes('mid ') || line.toLowerCase().includes('med ')) current = 'med'
    else if (line.toLowerCase().includes('low ')) current = 'low'
    if (line.toLowerCase().includes('empty')) continue
    const offline = line.endsWith('/offline')
    result[current].push({ typeId: 0, name: line.replace('/offline', '').trim(), offline })
  }
  return result
}

export function fitToEftFormat(shipName: string, fitName: string, slots: FitSlot): string {
  const lines = [`[${shipName}, ${fitName}]`, '']
  const add = (arr: any[]) => arr.forEach(m => {
    if (m) lines.push(m.offline ? `${m.name} /offline` : `${m.name}`)
  })
  add(slots.high); lines.push(''); add(slots.med); lines.push(''); add(slots.low); lines.push(''); add(slots.rig)
  return lines.join('\n')
}

const DogmaCalculator = {
  getShipStats,
  getShipByName,
  getModuleStats,
  getModuleByName,
  calculateFitStats,
  parseEftFormat,
  fitToEftFormat,
  inferModuleSlotTypeFromEffects,
}
export default DogmaCalculator