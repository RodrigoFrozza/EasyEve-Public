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
 *
 * Every ID below was re-validated against live ESI (`universe/types/{id}` + `dogma/attributes/{id}`)
 * on 2026-07-14 using real reference modules (see `docs/TROUBLESHOOTING.md` / Brain audit notes):
 * Light Neutron Blaster II (3178), Multispectrum Shield Hardener II (2281), Damage Control II (2048),
 * Large Shield Extender II (3841), Medium Armor Repairer II (3530), Caldari Navy Cruise Missile
 * Launcher (16062), Ogre II (2446), Stasis Webifier I (526). Fields with no real module-level
 * attribute (or not yet validated against a real fixture) use the `-1` sentinel — never a real ESI
 * attribute id — so they always resolve to 0 instead of silently reading an unrelated attribute.
 */
export const MODULE_SYNC_DOGMA_IDS = {
  // No real per-shot damage attribute exists on turret/launcher module types — damage comes from the
  // fitted charge/ammo. Old id 6 is actually `capacitorNeed` (Activation Cost), not damage.
  DAMAGE: -1,
  // attr 51 = `speed` (Rate of fire, ms). Old id 47 = `slots` (# of module slots required) — unrelated.
  FIRE_RATE: 51,
  // attr 54 = `maxRange` (Optimal Range). Confirmed via LNB II (value 1800). Unchanged — already correct.
  OPTIMAL_RANGE: 54,
  // attr 158 = `falloff` (Accuracy falloff). Old id 55 = `rechargeRate` (Capacitor Recharge time) — unrelated.
  FALLOFF_RANGE: 158,
  // attr 160 = `trackingSpeed` (Turret Tracking). Old id 63 = undocumented `accuracyBonus`, never confirmed as tracking.
  TRACKING_SPEED: 160,
  // Missile damage/velocity/range/explosion stats live on the CHARGE (ammo) type, not the launcher
  // itself — confirmed absent from Caldari Navy Cruise Missile Launcher's dogma_attributes. Old ids
  // (78 = 404/doesn't exist, 84 = armorDamageAmount, 213 = missileDamageMultiplierBonus,
  // 89 = shieldDrainRange, 90 = powerTransferAmount) all pointed at unrelated or nonexistent attributes.
  MISSILE_DAMAGE: -1,
  MISSILE_VELOCITY: -1,
  MISSILE_RANGE: -1,
  EXPLOSION_RADIUS: -1,
  EXPLOSION_VELOCITY: -1,
  // attr 50 = `cpu` (CPU usage). Old id 129 = `maxPassengers` — a ship attribute, totally unrelated.
  CPU_NEEDED: 50,
  // attr 30 = `power` (Powergrid Usage). Unchanged — already correct.
  POWER_NEEDED: 30,
  // attr 68 = `shieldBonus` (Shield Bonus — active shield booster HP restored per cycle). Unchanged — already correct.
  SHIELD_BOOST: 68,
  // attr 84 = `armorDamageAmount` (Armor Hitpoints Repaired). Old id 73 = `duration` (activation time) — unrelated.
  ARMOR_BOOST: 84,
  // No validated hull-repair-amount attribute found among the provided reference modules (old id 77 =
  // `miningAmount`, nonsense for a repair module). Needs a real Hull Repairer II ESI fixture before
  // wiring back up — sentinel keeps it at 0 rather than guessing.
  HULL_BOOST: -1,
  // attr 6 = `capacitorNeed` (Activation Cost). Old id 100 does not exist (404 from ESI).
  CAPACITOR_NEEDED: 6,
  // ECM jam strength is split per sensor type (radar/ladar/magnetometric/gravimetric) and old id 220
  // (`blueprintResearchTimeMultiplierBonus`) is entirely unrelated. Needs a real ECM module fixture.
  ECCM_SENSOR_STRENGTH: -1,
  // Old id 241 (`scanRadarStrengthBonus`) is itself a real ECM radar jam-strength attribute — just not
  // "sensor dampener range". Needs a real Sensor Dampener fixture to confirm the correct id.
  SENSOR_DAMPENER_RANGE: -1,
  // Old id 212 (`missileDamageMultiplier`) is unrelated to tracking disruptors. Needs a real fixture.
  TRACKING_DISRUPTOR_RANGE: -1,
  // attr 54 = `maxRange` — the same universal range attribute turrets use for optimal range. Confirmed
  // via Stasis Webifier I (value 10000). Old id 103 = `warpScrambleRange` (warp scram range) — unrelated.
  WEB_RANGE: 54,
  // attr 20 = `speedFactor` (Maximum Velocity Bonus). Confirmed via Stasis Webifier I (value -50).
  // Old id 127 = `ammoLoaded` (temporary loaded-charge marker) — unrelated.
  WEB_SPEED_FACTOR: 20,
  /** attr 64 = `damageMultiplier` (Damage Modifier). Confirmed via LNB II. Unchanged — already correct. */
  DAMAGE_MULTIPLIER: 64,
  ROF_MULTIPLIER: 204,
  CPU_OUTPUT_BONUS: 48,
  POWER_OUTPUT_BONUS: 147,
  // attr 1153 = `upgradeCost` ("Calibration cost" — how much of a ship's calibration pool a rig
  // consumes). Old id 1132 = `upgradeCapacity`, the ship's OWN calibration pool size — wrong attribute.
  CALIBRATION_COST: 1153,
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
  // attr 974/975/976/977 = hull resonance bonus family (`hullEmDamageResonance` etc.), confirmed via
  // Damage Control II (typeId 2048, all four = 0.6). Old ids (272/275/274/273) collided numerically
  // with the SHIELD_* keys above and were always wrong for hull.
  HULL_EM_MULTIPLIER: 974,
  HULL_THERM_MULTIPLIER: 977,
  HULL_KIN_MULTIPLIER: 976,
  HULL_EXP_MULTIPLIER: 975,
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
  // Unused in module-stats-esi-sync.ts (not referenced in the `stats` object). Shares 158 with
  // FALLOFF_RANGE only because 158 is really `falloff` — this key was never a real "max active
  // modules of this group" attribute id. Left as a documented dead alias rather than removed, since a
  // separate local copy of this table exists in dogma-calculator.ts (out of scope for this fix).
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
  // attr 72 = `capacityBonus` (Shield Hitpoint Bonus). Confirmed via Large Shield Extender II (typeId
  // 3841, value 2600). Old id 73 = `duration` (activation time) — present on nearly every active
  // module, so this silently reported a module's cycle time (seconds) as its "shield bonus". Root
  // cause of the "shieldBonus receiving duration" bug.
  SHIELD_CAPACITY: 72,
  /** attr 265 = `armorHP` (Armor Hitpoints). Confirmed correct — sparse (only present on armor plates). */
  ARMOR_HP: 265,
  // No validated flat hull-HP-bonus attribute found. Old id 9 = `hp`, the module's OWN structure
  // hitpoints (present on ~every module at a junk value, e.g. 40) — root cause of "hullBonus=40 on
  // almost everything". Reinforced-Bulkheads-style modules likely apply a % bonus via effect rather
  // than a flat attribute; needs a real bulkhead fixture before re-enabling. Sentinel keeps this at 0.
  STRUCTURAL_INTEGRITY: -1,
  RIG_SIZE: 1547,
} as const

export function moduleDogmaAttributeLabel(attributeId: number): string {
  for (const [name, value] of Object.entries(MODULE_SYNC_DOGMA_IDS)) {
    if (value === attributeId) return name
  }
  return `attr_${attributeId}`
}
