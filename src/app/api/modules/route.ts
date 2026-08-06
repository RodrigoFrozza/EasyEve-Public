import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Module groups by slot type (ESI group IDs)
const MODULE_GROUPS: Record<string, number> = {
  // HIGH SLOT - Weapons, Mining
  ENERGY_TURRET: 53,
  MINING_LASER: 54,
  PROJECTILE_TURRET: 55,
  HYBRID_TURRET: 74,
  SMART_BOMB: 72,
  FIGHTER_SUPPORT: 407,
  STRIP_MINER: 464,
  FREQUENCY_MINING_LASER: 483,
  CLOAKING_DEVICE: 330,

  // HIGH - Missile Launchers
  MISSILE_LAUNCHER_CRUISE: 506,
  MISSILE_LAUNCHER_ROCKET: 507,
  MISSILE_LAUNCHER_TORPEDO: 508,
  MISSILE_LAUNCHER_LIGHT: 509,
  MISSILE_LAUNCHER_HEAVY: 510,
  MISSILE_LAUNCHER_RAPID_LIGHT: 511,
  MISSILE_LAUNCHER_DEFENDER: 512,
  MISSILE_LAUNCHER_XL_TORPEDO: 524,
  MISSILE_LAUNCHER_BOMB: 862,
  MISSILE_LAUNCHER_RAPID_HEAVY: 1245,
  MISSILE_LAUNCHER_RAPID_TORPEDO: 1673,
  MISSILE_LAUNCHER_XL_CRUISE: 1674,
  ENTOSIS_LINK: 1313,
  VORTON_PROJECTOR: 4060,
  GAS_CLOUD_HARVESTER: 4138,

  // MED SLOT - Shield, EW, Propulsion, Sensors
  SHIELD_EXTENDER: 38,
  SHIELD_RECHARGER: 39,
  SHIELD_BOOSTER: 40,
  REMOTE_SHIELD_BOOSTER: 41,
  CAPACITOR_RECHARGER: 43,
  PROPULSION_MODULE: 46,
  CARGO_SCANNER: 47,
  SHIP_SCANNER: 48,
  WARP_SCRAMBLER: 52,
  SHIELD_POWER_RELAY: 57,
  CAPACITOR_BATTERY: 61,
  STASIS_WEB: 65,
  REMOTE_CAPACITOR_TRANSMITTER: 67,
  ENERGY_NOSFERATU: 68,
  ENERGY_NEUTRALIZER: 71,
  CAPACITOR_BOOSTER: 76,
  SHIELD_HARDENER: 77,
  BURST_JAMMER: 80,
  PASSIVE_TARGETING: 82,
  AUTOMATED_TARGETING: 96,
  ECM: 201,
  ECCM: 202,
  SENSOR_BACKUP: 203,
  SENSOR_DAMPENER: 208,
  REMOTE_TRACKING: 209,
  SIGNAL_AMPLIFIER: 210,
  TRACKING_ENHANCER: 211,
  SENSOR_BOOSTER: 212,
  TRACKING_COMPUTER: 213,
  PROJECTED_ECCM: 289,
  REMOTE_SENSOR_BOOSTER: 290,
  WEAPON_DISRUPTOR: 291,
  SHIELD_RESISTANCE_AMPLIFIER: 295,
  SHIELD_DISRUPTOR: 321,
  REMOTE_ARMOR_REPAIRER: 325,
  SHIELD_BOOST_AMPLIFIER: 338,
  TARGET_PAINTER: 379,
  SCAN_PROBE_LAUNCHER: 481,
  SIEGE_MODULE: 515,
  DATA_MINERS: 538,
  REMOTE_HULL_REPAIRER: 585,
  INTERDICTION_SPHERE: 589,
  JUMP_PORTAL_GENERATOR: 590,
  TRACTOR_BEAM: 650,
  CYNOSURAL_FIELD: 658,
  GAS_CLOUD_SCOOPS: 737,
  SALVAGER: 1122,
  SIGNATURE_SUPPRESSOR: 1154,
  ANCILLARY_SHIELD_BOOSTER: 1156,
  MICRO_JUMP_DRIVE: 1189,
  SURVEY_PROBE_LAUNCHER: 1226,
  MISSILE_GUIDANCE_COMPUTER: 1396,
  MICRO_JUMP_FIELD: 1533,
  STASIS_GRAPPLER: 1672,
  ANCILLARY_REMOTE_SHIELD: 1697,
  ANCILLARY_REMOTE_ARMOR: 1698,
  FLEX_SHIELD_HARDENER: 1700,
  CAPITAL_SENSOR_ARRAY: 1706,
  COMMAND_BURST: 1770,
  STASIS_NULLIFIERS: 2013,
  MUTADAPTIVE_REMOTE_ARMOR: 2018,
  INTERDICTION_NULLIFIER: 4117,
  COVERT_JUMP_PORTAL: 4127,
  INDUSTRIAL_JUMP_PORTAL: 4184,

  // LOW SLOT - Armor, Hull, Weapon upgrades
  GYROSTABILIZER: 59,
  DAMAGE_CONTROL: 60,
  ARMOR_REPAIR_UNIT: 62,
  HULL_REPAIR_UNIT: 63,
  REINFORCED_BULKHEAD: 78,
  ARMOR_COATING: 98,
  HEAT_SINK: 205,
  CPU_ENHANCER: 285,
  MAGNETIC_FIELD_STABILIZER: 302,
  WARP_CORE_STABILIZER: 315,
  ENERGIZED_ARMOR_MEMBRANE: 326,
  ARMOR_HARDENER: 328,
  ARMOR_PLATE: 329,
  AUXILIARY_POWER_CORE: 339,
  BALLISTIC_CONTROL_SYSTEM: 367,
  ECM_STABILIZER: 514,
  MINING_UPGRADE: 546,
  DRONE_NAVIGATION: 644,
  DRONE_DAMAGE: 645,
  DRONE_CONTROL_RANGE: 646,
  INERTIAL_STABILIZER: 762,
  NANOFIBER_INTERNAL: 763,
  OVERDRIVE_INJECTOR: 764,
  EXPANDED_CARGO: 765,
  POWER_DIAGNOSTIC_SYSTEM: 766,
  CAPACITOR_POWER_RELAY: 767,
  CAPACITOR_FLUX_COIL: 768,
  REACTOR_CONTROL_UNIT: 769,
  SHIELD_FLUX_COIL: 770,
  ANCILLARY_ARMOR_REPAIRER: 1199,
  SCANNING_UPGRADE: 1223,
  WARP_ACCELERATOR: 1289,
  DRONE_TRACKING_ENHANCER: 1292,
  JUMP_DRIVE_ECONOMIZER: 1299,
  SHIP_MODIFIERS: 1306,
  MISSILE_GUIDANCE_ENHANCER: 1395,
  FLEX_ARMOR_HARDENER: 1699,
  VORTON_PROJECTOR_UPGRADE: 4067,
  CAPITAL_MOBILITY: 4769,

  // RIG SLOT
  RIG_ARMOR: 773,
  RIG_SHIELD: 774,
  RIG_ENERGY: 775,
  RIG_HYBRID: 776,
  RIG_PROJECTILE: 777,
  RIG_DRONES: 778,
  RIG_LAUNCHER: 779,
  RIG_CORE: 781,
  RIG_NAVIGATION: 782,
  RIG_ELECTRONIC: 786,
  RIG_RESOURCE_PROCESSING: 1232,
  RIG_SCANNING: 1233,
  RIG_TARGETING: 1234,
  RIG_ANCHOR: 1308,

  // SUBSYSTEM
  SUBSYSTEM: 1240,
}

// Blueprint group IDs to exclude (category 9)
const BLUEPRINT_GROUPS = [
  104, 106, 109, 110, 111, 112, 113, 114, 115, 116,
  117, 118, 119, 120, 121, 122, 123, 124, 125, 126,
  127, 128, 129, 130, 131, 132, 133, 134, 135, 136,
  137, 138, 139, 140, 141, 142, 143, 144, 145, 146,
  147, 148, 149, 150, 151, 152, 153, 154, 155, 156,
  157, 158, 159, 160, 161, 162, 163, 164, 165, 166,
  167, 168, 169, 170, 171, 172, 173, 174, 175, 176,
  177, 178, 179, 180, 181, 182, 183, 184, 185, 186,
]

/**
 * GET /api/modules - List available modules
 * Query params:
 *   - slot: high, med, low, rig, subsystem
 *   - group: specific group ID
 *   - search: search by name
 *   - page: page number
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slot = searchParams.get('slot')
    const group = searchParams.get('group')
    const meta = searchParams.get('meta')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1000)
    
    // Build where clause for ModuleStats
    const where: any = {
      // Exclude blueprints by checking group IDs that start with known blueprint patterns
      // We'll filter out groups that contain "Blueprint" in the name
      NOT: {
        name: { contains: 'Blueprint', mode: 'insensitive' }
      }
    }
    
    if (search) {
      where.name = { ...where.name, contains: search, mode: 'insensitive' }
    }

    if (slot) {
      where.slotType = slot
    }
    
    if (meta && meta !== 'all') {
      where.metaGroupName = meta
    }

    if (group) {
        where.groupId = parseInt(group)
    }

    const modules = await prisma.moduleStats.findMany({
      where,
      select: {
        typeId: true,
        name: true,
        groupId: true,
        groupName: true,
        slotType: true,
        metaLevel: true,
        metaGroupName: true,
        cpu: true,
        powerGrid: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    })

    // Fetch type info (iconId) for all modules at once
    const typeIds = modules.map(m => m.typeId)
    const types = await prisma.eveType.findMany({
      where: { id: { in: typeIds } },
      select: { id: true, iconId: true }
    })
    const typeMap = new Map(types.map(t => [t.id, t.iconId]))

    const modulesFormatted = modules.map(mod => ({
      ...mod,
      id: mod.typeId,
      iconId: typeMap.get(mod.typeId)
    }))

    return NextResponse.json({
      modules: modulesFormatted,
      total: modulesFormatted.length
    })
  } catch (error) {
    console.error('GET /api/modules error:', error)
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 })
  }
}