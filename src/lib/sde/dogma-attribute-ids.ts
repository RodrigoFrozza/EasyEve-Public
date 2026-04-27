/**
 * Canonical EVE dogma attribute and effect IDs used by EasyEve sync pipelines.
 * Single source of truth for hull stats (`ship-dogma-sync`) and module sync (`/api/dogma`).
 * @see docs/FITTING_GUIDE.md — resistance resonance IDs 271–274 (shield), etc.
 */

/** Dogma effect IDs for slot / hardpoint classification (ESI `dogma_effects`). */
export const DOGMA_EFFECT_IDS = {
  HI_POWER: 12,
  MED_POWER: 13,
  LO_POWER: 11,
  RIG_SLOT: 2663,
  SUBSYSTEM_SLOT: 3499,
  TURRET_FITTED: 42,
  LAUNCHER_FITTED: 40,
} as const

/**
 * Hull / ship-type attributes from ESI `universe/types/{id}` (`dogma_attributes` + merged capacity).
 * Aligned with `mapDogmaToShipStats` in `ship-dogma-sync.ts` and `SHIP_STATS_SYNC_FIELD_MATRIX`.
 */
export const SHIP_DOGMA_ATTRIBUTE_IDS = {
  // Fitting — modern vs legacy
  cpuLegacy: 19,
  powerLegacy: 21,
  lowSlots: 12,
  medSlots: 13,
  highSlots: 14,
  legacyHiSlot: 47,
  legacyLowSlot: 49,
  rigSlots: 1137,
  calibration: 115,
  calibrationCost: 1132,

  // Capacitor
  capacitorLegacy: 22,
  capacitorRechargeLegacy: 64,
  capacitorCapacity: 482,
  capacitorRechargeRate: 55,

  // HP
  shieldCapacityPool: 263,
  shieldCapacityAlt: 73,
  armorHP: 265,
  hullHP: 9,

  // Shield resonance (0–1)
  shieldEmResist: 271,
  shieldExpResist: 272,
  shieldKinResist: 273,
  shieldThermResist: 274,

  // Armor resonance
  armorEmResist: 267,
  armorExpResist: 268,
  armorKinResist: 269,
  armorThermResist: 270,

  // Hull resonance
  hullEmResist: 113,
  hullThermResist: 110,
  hullKinResist: 109,
  hullExpResist: 111,

  // Motion
  maxVelocity: 37,
  inertiaModifier: 39,
  agility: 70,
  mass: 4,
  warpSpeedLegacy: 30,
  warpSpeedMultiplier: 600,
  baseWarpSpeed: 1281,

  // Targeting
  maxLockedTargets: 154,
  maxLockedTargetsAlt: 192,
  maxTargetRange: 76,
  signatureRadius: 552,
  scanResolution: 310,
  scanRadar: 208,
  scanGravimetric: 210,
  scanLadar: 209,
  scanMagnetometric: 211,

  // Drones / cargo
  droneBay: 283,
  droneBandwidth: 1271,
  legacyDrone227: 227,
  legacyDrone1270: 1270,
  capacity: 5,

  // Hardpoints
  turretHardpoints: 102,
  launcherHardpoints: 101,
  legacyTurretHardpoints: 1024,
  legacyLauncherHardpoints: 1025,

  // Grid / CPU (modern outputs on hull)
  powerGridOutput: 11,
  cpuOutput: 48,

  // Subsystems / rig size
  subsystemSlots: 1544,
  rigSize: 1547,
} as const

/** Human-readable names for persisted `ShipDogmaAttribute.attributeName` (subset used by sync). */
export const SHIP_DOGMA_ATTRIBUTE_NAMES: Record<number, string> = {
  [SHIP_DOGMA_ATTRIBUTE_IDS.cpuLegacy]: 'cpu',
  [SHIP_DOGMA_ATTRIBUTE_IDS.powerLegacy]: 'power',
  [SHIP_DOGMA_ATTRIBUTE_IDS.lowSlots]: 'lowSlots',
  [SHIP_DOGMA_ATTRIBUTE_IDS.medSlots]: 'medSlots',
  [SHIP_DOGMA_ATTRIBUTE_IDS.highSlots]: 'highSlots',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyHiSlot]: 'legacyHiSlot',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyLowSlot]: 'legacyLowSlot',
  [SHIP_DOGMA_ATTRIBUTE_IDS.rigSlots]: 'rigSlots',
  [SHIP_DOGMA_ATTRIBUTE_IDS.calibration]: 'calibration',
  [SHIP_DOGMA_ATTRIBUTE_IDS.capacitorLegacy]: 'capacitor',
  [SHIP_DOGMA_ATTRIBUTE_IDS.capacitorRechargeLegacy]: 'capacitorRecharge',
  [SHIP_DOGMA_ATTRIBUTE_IDS.shieldCapacityPool]: 'shieldCapacity',
  [SHIP_DOGMA_ATTRIBUTE_IDS.armorHP]: 'armorHP',
  [SHIP_DOGMA_ATTRIBUTE_IDS.hullHP]: 'hullHP',
  [SHIP_DOGMA_ATTRIBUTE_IDS.shieldEmResist]: 'shieldEmResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.shieldExpResist]: 'shieldExpResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.shieldKinResist]: 'shieldKinResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.shieldThermResist]: 'shieldThermResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.armorEmResist]: 'armorEmResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.armorExpResist]: 'armorExpResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.armorKinResist]: 'armorKinResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.armorThermResist]: 'armorThermResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.hullEmResist]: 'hullEmResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.hullThermResist]: 'hullThermResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.hullKinResist]: 'hullKinResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.hullExpResist]: 'hullExpResist',
  [SHIP_DOGMA_ATTRIBUTE_IDS.maxVelocity]: 'maxVelocity',
  [SHIP_DOGMA_ATTRIBUTE_IDS.inertiaModifier]: 'inertiaModifier',
  [SHIP_DOGMA_ATTRIBUTE_IDS.agility]: 'agility',
  [SHIP_DOGMA_ATTRIBUTE_IDS.mass]: 'mass',
  [SHIP_DOGMA_ATTRIBUTE_IDS.warpSpeedLegacy]: 'warpSpeed',
  [SHIP_DOGMA_ATTRIBUTE_IDS.warpSpeedMultiplier]: 'warpSpeedMultiplier',
  [SHIP_DOGMA_ATTRIBUTE_IDS.baseWarpSpeed]: 'baseWarpSpeed',
  [SHIP_DOGMA_ATTRIBUTE_IDS.maxLockedTargets]: 'maxLockedTargets',
  [SHIP_DOGMA_ATTRIBUTE_IDS.maxLockedTargetsAlt]: 'maxLockedTargetsAlt',
  [SHIP_DOGMA_ATTRIBUTE_IDS.maxTargetRange]: 'maxTargetRange',
  [SHIP_DOGMA_ATTRIBUTE_IDS.signatureRadius]: 'signatureRadius',
  [SHIP_DOGMA_ATTRIBUTE_IDS.scanResolution]: 'scanResolution',
  [SHIP_DOGMA_ATTRIBUTE_IDS.scanRadar]: 'scanRadarStrength',
  [SHIP_DOGMA_ATTRIBUTE_IDS.scanGravimetric]: 'scanGravimetricStrength',
  [SHIP_DOGMA_ATTRIBUTE_IDS.scanLadar]: 'scanLadarStrength',
  [SHIP_DOGMA_ATTRIBUTE_IDS.scanMagnetometric]: 'scanMagnetometricStrength',
  [SHIP_DOGMA_ATTRIBUTE_IDS.droneBay]: 'droneBay',
  [SHIP_DOGMA_ATTRIBUTE_IDS.droneBandwidth]: 'droneBandwidth',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyDrone227]: 'legacyAttr227',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyDrone1270]: 'legacyAttr1270',
  [SHIP_DOGMA_ATTRIBUTE_IDS.capacity]: 'capacity',
  [SHIP_DOGMA_ATTRIBUTE_IDS.turretHardpoints]: 'turretHardpoints',
  [SHIP_DOGMA_ATTRIBUTE_IDS.launcherHardpoints]: 'launcherHardpoints',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyTurretHardpoints]: 'legacyTurretHardpoints',
  [SHIP_DOGMA_ATTRIBUTE_IDS.legacyLauncherHardpoints]: 'legacyLauncherHardpoints',
  [SHIP_DOGMA_ATTRIBUTE_IDS.powerGridOutput]: 'powerGridOutput',
  [SHIP_DOGMA_ATTRIBUTE_IDS.cpuOutput]: 'cpuOutput',
  [SHIP_DOGMA_ATTRIBUTE_IDS.capacitorCapacity]: 'capacitorCapacity',
  [SHIP_DOGMA_ATTRIBUTE_IDS.calibrationCost]: 'calibrationCost',
  [SHIP_DOGMA_ATTRIBUTE_IDS.capacitorRechargeRate]: 'capacitorRechargeRate',
  [SHIP_DOGMA_ATTRIBUTE_IDS.subsystemSlots]: 'subsystemSlots',
  [SHIP_DOGMA_ATTRIBUTE_IDS.rigSize]: 'rigSize',
}

/**
 * Dogma attribute IDs for `syncModuleStats` (`src/app/api/dogma/route.ts`).
 * Hull `ShipStats` must use `syncShipDogmaData` + `SHIP_DOGMA_ATTRIBUTE_IDS`, not this table.
 *
 * Note: several EVE attributes intentionally share the same numeric ID across semantic keys
 * (e.g. stacking / resonance families). `moduleDogmaAttributeLabel` returns the first matching key.
 */
export const MODULE_SYNC_DOGMA_IDS = {
  DAMAGE: 6,
  FIRE_RATE: 47,
  OPTIMAL_RANGE: 54,
  FALLOFF_RANGE: 55,
  TRACKING_SPEED: 63,
  MISSILE_DAMAGE: 78,
  MISSILE_VELOCITY: 84,
  MISSILE_RANGE: 213,
  EXPLOSION_RADIUS: 89,
  EXPLOSION_VELOCITY: 90,
  CPU_NEEDED: 129,
  POWER_NEEDED: 30,
  SHIELD_BOOST: 68,
  ARMOR_BOOST: 73,
  HULL_BOOST: 77,
  CAPACITOR_NEEDED: 100,
  ECCM_SENSOR_STRENGTH: 220,
  SENSOR_DAMPENER_RANGE: 241,
  TRACKING_DISRUPTOR_RANGE: 212,
  WEB_RANGE: 103,
  WEB_SPEED_FACTOR: 127,
  /** Same dogma id as legacy `capacitorRecharge` constant in older ship sync (64). */
  DAMAGE_MULTIPLIER: 64,
  ROF_MULTIPLIER: 204,
  CPU_OUTPUT_BONUS: 48,
  POWER_OUTPUT_BONUS: 147,
  CALIBRATION_COST: 1132,
  SHIELD_EM_MULTIPLIER: 271,
  SHIELD_THERM_MULTIPLIER: 274,
  SHIELD_KIN_MULTIPLIER: 273,
  SHIELD_EXP_MULTIPLIER: 272,
  ARMOR_EM_MULTIPLIER: 267,
  TURRET_HARDPOINTS: 41,
  LAUNCHER_HARDPOINTS: 42,
  ARMOR_THERM_MULTIPLIER: 270,
  ARMOR_KIN_MULTIPLIER: 269,
  ARMOR_EXP_MULTIPLIER: 268,
  HULL_EM_MULTIPLIER: 272,
  HULL_THERM_MULTIPLIER: 275,
  HULL_KIN_MULTIPLIER: 274,
  HULL_EXP_MULTIPLIER: 273,
  CAN_FIT_SHIP_GROUP_01: 1298,
  CAN_FIT_SHIP_GROUP_02: 1299,
  CAN_FIT_SHIP_GROUP_03: 1300,
  CAN_FIT_SHIP_GROUP_04: 1301,
  CAN_FIT_SHIP_TYPE_01: 1302,
  CAN_FIT_SHIP_TYPE_02: 1303,
  CAN_FIT_SHIP_TYPE_03: 1304,
  CAN_FIT_SHIP_TYPE_04: 1305,
  CHARGE_SIZE: 128,
  CHARGE_GROUP_1: 604,
  CHARGE_GROUP_2: 605,
  CHARGE_GROUP_3: 606,
  CHARGE_GROUP_4: 607,
  CHARGE_GROUP_5: 608,
  CHARGE_GROUP_6: 609,
  CHARGE_GROUP_7: 610,
  CHARGE_GROUP_8: 611,
  CHARGE_GROUP_9: 612,
  CHARGE_GROUP_10: 613,
  MAX_GROUP_ACTIVE: 158,
  SKILL_1: 182,
  SKILL_1_LEVEL: 277,
  SKILL_2: 183,
  SKILL_2_LEVEL: 278,
  SKILL_3: 184,
  SKILL_3_LEVEL: 279,
  SKILL_4: 1285,
  SKILL_4_LEVEL: 1286,
  SKILL_5: 1287,
  SKILL_5_LEVEL: 1288,
  SKILL_6: 1289,
  SKILL_6_LEVEL: 1290,
  META_LEVEL: 633,
  META_GROUP: 1692,
  /** Flat shield HP on shield-tank modules (`ModuleStats.shieldBonus`). */
  SHIELD_CAPACITY: 73,
  ARMOR_HP: 265,
  STRUCTURAL_INTEGRITY: 9,
  RIG_SIZE: 1547,
} as const

export function moduleDogmaAttributeLabel(attributeId: number): string {
  for (const [name, value] of Object.entries(MODULE_SYNC_DOGMA_IDS)) {
    if (value === attributeId) return name
  }
  return `attr_${attributeId}`
}
