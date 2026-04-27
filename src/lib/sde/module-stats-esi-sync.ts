/**
 * ESI → ModuleStats / ModuleDogmaAttribute sync (same pipeline as GET /api/dogma?sync=true&type=modules).
 * @see docs/SDE_DOGMA_SYNC_ENTRYPOINTS.md
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { batchPromiseAll } from '@/lib/utils'
import { verifyModuleReadinessForHardware } from '@/lib/fits/dogma-data-integrity'
import { resolveModuleTypeMetadata } from '@/lib/sde/module-type-metadata'
import {
  DOGMA_EFFECT_IDS as DOGMA_EFFECTS,
  MODULE_SYNC_DOGMA_IDS as DOGMA_ATTRS,
  moduleDogmaAttributeLabel,
} from '@/lib/sde/dogma-attribute-ids'

import { esiClient } from '@/lib/esi-client'

/** Progress for admin Script Runner / observability (HTTP route ignores this). */
export type SyncModuleStatsProgress =
  | {
      phase: 'list_built'
      totalTypeIds: number
      alreadyCompleteInDb: number
      pendingEsiWrites: number
    }
  | {
      phase: 'syncing'
      totalTypeIds: number
      /** 1-based index in the catalog walk (increments every iteration, including skips/failures). */
      positionsHandled: number
      failed: number
      lastTypeId: number
      /** Skips (already in DB) + successful ESI writes so far (same semantics as legacy `synced` counter). */
      successOrSkipCount: number
    }
  | {
      phase: 'sync_complete'
      totalTypeIds: number
      positionsHandled: number
      failed: number
      successOrSkipCount: number
    }

export type SyncModuleStatsOptions = {
  onProgress?: (p: SyncModuleStatsProgress) => void | Promise<void>
}

const MODULE_GROUPS = {
  ENERGY_TURRET: 76,
  PROJECTILE_TURRET: 77,
  HYBRID_TURRET: 78,
  MISSILE_LAUNCHER: 79,
  SHIELD_BOOSTER: 29,
  ECM: 111,
  SENSOR_DAMP: 112,
  TRACKING_DISRUPTOR: 113,
  STASIS_WEB: 65,
  REMOTE_REPAIR: 120,
  NOS: 35,
  NEUTRALIZER: 36,
  AFTERBURNER: 33,
  MICRO_WARP: 34,
  SHIELD_EXTENSION: 32,
  TRACKING_COMPUTER: 81,
  SENSOR_BOOSTER: 82,
  NAVIGATION_COMPUTER: 83,
  ARMOR_PLATING: 28,
  ARMOR_REPAIR: 30,
  HULL_MOD: 27,
  HULL_REPAIR: 31,
  SHIELD_RIG: 153,
  ARMOR_RIG: 154,
  NAVIGATION_RIG: 155,
  SUBSYSTEM: 186,
}

const SLOT_TYPE_MAP: Record<string, string> = {
  [MODULE_GROUPS.ENERGY_TURRET]: 'high',
  [MODULE_GROUPS.PROJECTILE_TURRET]: 'high',
  [MODULE_GROUPS.HYBRID_TURRET]: 'high',
  [MODULE_GROUPS.MISSILE_LAUNCHER]: 'high',
  [MODULE_GROUPS.SHIELD_BOOSTER]: 'high',
  [MODULE_GROUPS.ECM]: 'high',
  [MODULE_GROUPS.SENSOR_DAMP]: 'high',
  [MODULE_GROUPS.TRACKING_DISRUPTOR]: 'high',
  [MODULE_GROUPS.STASIS_WEB]: 'high',
  [MODULE_GROUPS.REMOTE_REPAIR]: 'high',
  [MODULE_GROUPS.NOS]: 'high',
  [MODULE_GROUPS.NEUTRALIZER]: 'high',

  [MODULE_GROUPS.AFTERBURNER]: 'med',
  [MODULE_GROUPS.MICRO_WARP]: 'med',
  [MODULE_GROUPS.SHIELD_EXTENSION]: 'med',
  [MODULE_GROUPS.TRACKING_COMPUTER]: 'med',
  [MODULE_GROUPS.SENSOR_BOOSTER]: 'med',
  [MODULE_GROUPS.NAVIGATION_COMPUTER]: 'med',

  [MODULE_GROUPS.ARMOR_PLATING]: 'low',
  [MODULE_GROUPS.ARMOR_REPAIR]: 'low',
  [MODULE_GROUPS.HULL_MOD]: 'low',
  [MODULE_GROUPS.HULL_REPAIR]: 'low',

  [MODULE_GROUPS.SHIELD_RIG]: 'rig',
  [MODULE_GROUPS.ARMOR_RIG]: 'rig',
  [MODULE_GROUPS.NAVIGATION_RIG]: 'rig',

  [MODULE_GROUPS.SUBSYSTEM]: 'subsystem',

  506: 'high',
  507: 'high',
  508: 'high',
  509: 'high',
  510: 'high',
  511: 'high',
  512: 'high',
  524: 'high',
  862: 'high',
  1245: 'high',
  1673: 'high',
  1674: 'high',

  38: 'med',
  39: 'med',
  40: 'high',
  41: 'med',
  77: 'med',
  57: 'med',
  295: 'med',
  338: 'high',
  1156: 'high',
  1697: 'med',
  1700: 'med',

  43: 'med',
  61: 'med',
  76: 'high',

  201: 'high',
  202: 'high',
  203: 'high',
  208: 'high',
  65: 'high',
  80: 'high',
  379: 'med',
  289: 'high',
  290: 'high',
  291: 'high',

  46: 'med',
  131: 'med',
  132: 'med',
  1189: 'med',
  1190: 'med',
  1533: 'med',

  62: 'low',
  63: 'low',
  78: 'low',
  98: 'low',
  329: 'low',
  328: 'med',
  326: 'low',
  205: 'low',
  302: 'low',
  367: 'low',

  60: 'low',
  315: 'low',

  59: 'low',
  646: 'low',
  647: 'low',
  648: 'low',

  54: 'high',
  464: 'high',
  483: 'high',
  4138: 'high',

  773: 'rig',
  774: 'rig',
  775: 'rig',
  776: 'rig',
  777: 'rig',
  778: 'rig',
  779: 'rig',
  780: 'rig',
  781: 'rig',
  782: 'rig',

  100: 'med',
  516: 'med',
  831: 'med',
  641: 'med',
  1111: 'med',

  67: 'med',
  68: 'med',
  71: 'high',
  658: 'med',
  766: 'med',

  82: 'med',
  96: 'med',
  210: 'med',
  211: 'med',
  212: 'med',
  213: 'med',

  330: 'high',
  72: 'high',
  141: 'high',
  515: 'high',
  1770: 'high',
  538: 'high',
  589: 'med',
  650: 'med',
  481: 'high',
  1226: 'high',

  4060: 'high',
  4067: 'high',
}

async function fetchDogmaDetails(typeId: number): Promise<{ attrs: Record<number, number>; effects: number[] }> {
  const attrs: Record<number, number> = {}
  const effects: number[] = []
  try {
    const res = await esiClient.get(`/universe/types/${typeId}/`)
    const data = res.data
    const dogmaAttrs = data.dogma_attributes || []
    for (const attr of dogmaAttrs) {
      attrs[attr.attribute_id] = attr.value
    }
    const dogmaEffects = data.dogma_effects || []
    for (const effect of dogmaEffects) {
      effects.push(effect.effect_id)
    }
  } catch (e) {
    logger.error('DogmaSync', `Failed to get dogma for type ${typeId}`, e)
  }
  return { attrs, effects }
}

async function syncSpecificModules(
  allModuleTypeIds: number[],
  groupNames: Record<number, string>,
  existingTypeIds: Set<number>,
  options?: SyncModuleStatsOptions
) {
  let synced = 0
  let failed = 0
  const results: unknown[] = []
  const total = allModuleTypeIds.length

  const emitSyncProgress = async (turn: number, lastTypeId: number) => {
    const onProgress = options?.onProgress
    if (!onProgress) return
    if (turn === 1 || turn === total || turn % 25 === 0) {
      await onProgress({
        phase: 'syncing',
        totalTypeIds: total,
        positionsHandled: turn,
        failed,
        lastTypeId,
        successOrSkipCount: synced,
      })
    }
  }

  await batchPromiseAll(
    allModuleTypeIds,
    15,
    async (typeId, idx) => {
      const turn = idx + 1

      if (existingTypeIds.has(typeId)) {
        synced++
        await emitSyncProgress(turn, typeId)
        return
      }

      try {
        const typeResponse = await esiClient.get(`/universe/types/${typeId}/`)
        const typeData = typeResponse.data

        const eveTypeRow = await prisma.eveType.findUnique({
          where: { id: typeId },
          select: {
            id: true,
            name: true,
            groupId: true,
            group: { select: { name: true, categoryId: true } },
          },
        })

        const meta = await resolveModuleTypeMetadata({
          typeId,
          esiType: {
            name: typeData.name,
            group_id: typeData.group_id,
            category_id: typeData.category_id,
          },
          eveType: eveTypeRow,
          esiWalkGroupName: groupNames[typeId],
        })

        const esiGroupId =
          typeof typeData.group_id === 'number' && Number.isFinite(typeData.group_id)
            ? Math.floor(typeData.group_id)
            : null
        const effectiveGroupId = meta.groupId ?? esiGroupId ?? 0
        const resolvedCategoryId =
          meta.categoryId ??
          (typeof typeData.category_id === 'number' && Number.isFinite(typeData.category_id)
            ? Math.floor(typeData.category_id)
            : null)

        const modName = meta.name

        const { attrs, effects } = await fetchDogmaDetails(typeId)

        let slotType: string | null = null
        if (effects.includes(DOGMA_EFFECTS.HI_POWER)) slotType = 'high'
        else if (effects.includes(DOGMA_EFFECTS.MED_POWER)) slotType = 'med'
        else if (effects.includes(DOGMA_EFFECTS.LO_POWER)) slotType = 'low'
        else if (effects.includes(DOGMA_EFFECTS.RIG_SLOT)) slotType = 'rig'
        else if (effects.includes(DOGMA_EFFECTS.SUBSYSTEM_SLOT)) slotType = 'subsystem'

        if (!slotType) {
          for (const [gid, slot] of Object.entries(SLOT_TYPE_MAP)) {
            if (Number(gid) === effectiveGroupId) {
              slotType = slot
              break
            }
          }
        }

        const isTurret = effects.includes(DOGMA_EFFECTS.TURRET_FITTED)
        const isLauncher = effects.includes(DOGMA_EFFECTS.LAUNCHER_FITTED)

        const groupId = effectiveGroupId
        const isWeapon = [76, 77, 78, 79].includes(groupId)
        const isMissile = groupId === 79

        const metaLevel = attrs[633] || 0
        const metaGroupId = attrs[1692] || 1

        let metaGroupName = 'Tech I'
        if (metaGroupId === 2) metaGroupName = 'Tech II'
        else if (metaGroupId === 3) metaGroupName = 'Storyline'
        else if (metaGroupId === 4) metaGroupName = 'Faction'
        else if (metaGroupId === 5) metaGroupName = 'Officer'
        else if (metaGroupId === 6) metaGroupName = 'Deadspace'
        else if (modName.includes('Tech II') || modName.includes('II')) metaGroupName = 'Tech II'
        else if (modName.includes('Faction')) metaGroupName = 'Faction'
        else if (modName.includes('Deadspace')) metaGroupName = 'Deadspace'
        else if (modName.includes('Officer')) metaGroupName = 'Officer'
        else if (modName.includes('Storyline')) metaGroupName = 'Storyline'

        const stats = {
          typeId: typeId,
          name: modName,
          groupId: meta.groupId ?? esiGroupId ?? null,
          groupName: meta.groupName,
          slotType,
          metaLevel: metaLevel,
          metaGroupName: metaGroupName,
          categoryId: resolvedCategoryId,
          cpu: attrs[DOGMA_ATTRS.CPU_NEEDED] || 0,
          powerGrid: attrs[DOGMA_ATTRS.POWER_NEEDED] || 0,

          damage: isWeapon ? attrs[DOGMA_ATTRS.DAMAGE] || 0 : 0,
          fireRate: isWeapon ? attrs[DOGMA_ATTRS.FIRE_RATE] || 0 : 0,
          optimalRange: isWeapon ? attrs[DOGMA_ATTRS.OPTIMAL_RANGE] || 0 : 0,
          falloffRange: isWeapon ? attrs[DOGMA_ATTRS.FALLOFF_RANGE] || 0 : 0,
          trackingSpeed: isWeapon ? attrs[DOGMA_ATTRS.TRACKING_SPEED] || 0 : 0,

          missileDamage: isMissile ? attrs[DOGMA_ATTRS.MISSILE_DAMAGE] || 0 : 0,
          missileRange: isMissile ? attrs[DOGMA_ATTRS.MISSILE_RANGE] || 0 : 0,
          missileVelocity: isMissile ? attrs[DOGMA_ATTRS.MISSILE_VELOCITY] || 0 : 0,

          shieldBoost: groupId === 29 ? attrs[DOGMA_ATTRS.SHIELD_BOOST] || 0 : 0,
          armorRepair: groupId === 30 ? attrs[DOGMA_ATTRS.ARMOR_BOOST] || 0 : 0,
          hullRepair: groupId === 31 ? attrs[DOGMA_ATTRS.HULL_BOOST] || 0 : 0,

          capacitorNeed: attrs[DOGMA_ATTRS.CAPACITOR_NEEDED] || 0,
          capacitorDrain: 0,

          ecmStrength: groupId === 111 ? attrs[DOGMA_ATTRS.ECCM_SENSOR_STRENGTH] || 0 : 0,
          sensorDampStrength: groupId === 112 ? attrs[DOGMA_ATTRS.SENSOR_DAMPENER_RANGE] || 0 : 0,
          trackingDisruptStrength: groupId === 113 ? attrs[DOGMA_ATTRS.TRACKING_DISRUPTOR_RANGE] || 0 : 0,
          webSpeedPenalty: groupId === 65 ? attrs[DOGMA_ATTRS.WEB_SPEED_FACTOR] || 0 : 0,
          webRangeBonus: groupId === 65 ? attrs[DOGMA_ATTRS.WEB_RANGE] || 0 : 0,

          shieldBonus: attrs[DOGMA_ATTRS.SHIELD_CAPACITY] || 0,
          armorBonus: attrs[DOGMA_ATTRS.ARMOR_HP] || 0,
          hullBonus: attrs[DOGMA_ATTRS.STRUCTURAL_INTEGRITY] || 0,
          calibration: Math.round(attrs[DOGMA_ATTRS.CALIBRATION_COST] || 0),

          damageMultiplier: attrs[DOGMA_ATTRS.DAMAGE_MULTIPLIER] || 1,
          rofMultiplier: attrs[DOGMA_ATTRS.ROF_MULTIPLIER] || 1,

          shieldEmResistMultiplier: attrs[DOGMA_ATTRS.SHIELD_EM_MULTIPLIER] || 1,
          shieldThermResistMultiplier: attrs[DOGMA_ATTRS.SHIELD_THERM_MULTIPLIER] || 1,
          shieldKinResistMultiplier: attrs[DOGMA_ATTRS.SHIELD_KIN_MULTIPLIER] || 1,
          shieldExpResistMultiplier: attrs[DOGMA_ATTRS.SHIELD_EXP_MULTIPLIER] || 1,

          armorEmResistMultiplier: attrs[DOGMA_ATTRS.ARMOR_EM_MULTIPLIER] || 1,
          armorThermResistMultiplier: attrs[DOGMA_ATTRS.ARMOR_THERM_MULTIPLIER] || 1,
          armorKinResistMultiplier: attrs[DOGMA_ATTRS.ARMOR_KIN_MULTIPLIER] || 1,
          armorExpResistMultiplier: attrs[DOGMA_ATTRS.ARMOR_EXP_MULTIPLIER] || 1,

          hullEmResistMultiplier: attrs[DOGMA_ATTRS.HULL_EM_MULTIPLIER] || 1,
          hullThermResistMultiplier: attrs[DOGMA_ATTRS.HULL_THERM_MULTIPLIER] || 1,
          hullKinResistMultiplier: attrs[DOGMA_ATTRS.HULL_KIN_MULTIPLIER] || 1,
          hullExpResistMultiplier: attrs[DOGMA_ATTRS.HULL_EXP_MULTIPLIER] || 1,

          cpuMultiplier: attrs[DOGMA_ATTRS.CPU_OUTPUT_BONUS] || 1,
          powerMultiplier: attrs[DOGMA_ATTRS.POWER_OUTPUT_BONUS] || 1,

          restrictions: {
            rigSize: attrs[DOGMA_ATTRS.RIG_SIZE] || 0,
            allowedGroups: [
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_GROUP_01],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_GROUP_02],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_GROUP_03],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_GROUP_04],
            ].filter(Boolean),
            allowedTypes: [
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_TYPE_01],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_TYPE_02],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_TYPE_03],
              attrs[DOGMA_ATTRS.CAN_FIT_SHIP_TYPE_04],
            ].filter(Boolean),
            requiredSkills: [
              { id: attrs[182], level: attrs[277] },
              { id: attrs[183], level: attrs[278] },
              { id: attrs[184], level: attrs[279] },
              { id: attrs[1285], level: attrs[1286] },
              { id: attrs[1287], level: attrs[1288] },
              { id: attrs[1289], level: attrs[1290] },
            ].filter(s => s.id && s.level),
            syncMeta: {
              identity: {
                nameSource: meta.nameSource,
                groupIdSource: meta.groupIdSource,
                categoryIdSource: meta.categoryIdSource,
                warning: meta.qualityWarning ?? null,
              },
            },
            syncIdentity: {
              nameSource: meta.nameSource,
              groupIdSource: meta.groupIdSource,
              categoryIdSource: meta.categoryIdSource,
              warning: meta.qualityWarning ?? null,
            },
          },

          chargeSize:
            attrs[DOGMA_ATTRS.CHARGE_SIZE] != null && Number.isFinite(Number(attrs[DOGMA_ATTRS.CHARGE_SIZE]))
              ? Math.round(Number(attrs[DOGMA_ATTRS.CHARGE_SIZE]))
              : null,
          chargeGroup1: attrs[DOGMA_ATTRS.CHARGE_GROUP_1] || null,
          chargeGroup2: attrs[DOGMA_ATTRS.CHARGE_GROUP_2] || null,
          chargeGroup3: attrs[DOGMA_ATTRS.CHARGE_GROUP_3] || null,
          chargeGroup4: attrs[DOGMA_ATTRS.CHARGE_GROUP_4] || null,
          chargeGroup5: attrs[DOGMA_ATTRS.CHARGE_GROUP_5] || null,
          chargeGroup6: attrs[DOGMA_ATTRS.CHARGE_GROUP_6] || null,
          chargeGroup7: attrs[DOGMA_ATTRS.CHARGE_GROUP_7] || null,
          chargeGroup8: attrs[DOGMA_ATTRS.CHARGE_GROUP_8] || null,
          chargeGroup9: attrs[DOGMA_ATTRS.CHARGE_GROUP_9] || null,
          chargeGroup10: attrs[DOGMA_ATTRS.CHARGE_GROUP_10] || null,

          effects: {
            isTurret,
            isLauncher,
            effectIds: effects,
            isDrone: resolvedCategoryId === 18,
            isCharge: resolvedCategoryId === 8,
          },
        }

        const result = await prisma.moduleStats.upsert({
          where: { typeId: typeId },
          update: stats,
          create: stats,
        })

        const attributeRecords = Object.entries(attrs).map(([attrId, value]) => ({
          moduleTypeId: typeId,
          attributeId: parseInt(attrId, 10),
          attributeName: moduleDogmaAttributeLabel(parseInt(attrId, 10)),
          value: value as number,
        }))

        if (attributeRecords.length > 0) {
          await prisma.moduleDogmaAttribute.deleteMany({ where: { moduleTypeId: typeId } })
          await prisma.moduleDogmaAttribute.createMany({
            data: attributeRecords,
            skipDuplicates: true,
          })
        }

        results.push(result)

        const integrityIssues = verifyModuleReadinessForHardware({
          typeId,
          slotType: stats.slotType as string | null,
          effects: stats.effects,
        })
        if (integrityIssues.length > 0) {
          logger.warn('DogmaSync', 'Module missing authoritative slot data after sync', {
            typeId,
            issues: integrityIssues,
          })
        }

        synced++
        if (synced % 50 === 0) logger.info('DogmaSync', `Synced ${synced}/${total} modules`)
        await emitSyncProgress(turn, typeId)
      } catch (e) {
        failed++
        await emitSyncProgress(turn, typeId)
        logger.error('DogmaSync', `Failed to sync module ${typeId}`, { error: e })
        if (total === 1) {
          throw e
        }
      }
    }
  )

  logger.info('DogmaSync', `Module stats sync complete: ${synced} synced, ${failed} failed`)
  await options?.onProgress?.({
    phase: 'sync_complete',
    totalTypeIds: total,
    positionsHandled: total,
    failed,
    successOrSkipCount: synced,
  })
  return results
}

/**
 * Full or single-type module dogma sync from ESI (canonical pipeline).
 */
export async function syncModuleStats(targetTypeId?: number, options?: SyncModuleStatsOptions) {
  if (targetTypeId) {
    logger.info('DogmaSync', `Syncing specific module TypeID: ${targetTypeId}`)
    await options?.onProgress?.({
      phase: 'list_built',
      totalTypeIds: 1,
      alreadyCompleteInDb: 0,
      pendingEsiWrites: 1,
    })
    const results = await syncSpecificModules([targetTypeId], {}, new Set(), options)
    return results[0] || null
  }

  logger.info('DogmaSync', 'Starting module stats sync from ESI...')

  const existingModules = await prisma.moduleStats.findMany({
    where: {
      AND: [{ metaGroupName: { not: 'Tech I' } }, { slotType: { not: null } }],
    },
    select: { typeId: true },
  })
  const existingTypeIds = new Set(existingModules.map(m => m.typeId))
  logger.info('DogmaSync', `Found ${existingTypeIds.size} modules fully synced`)

  const MODULE_CATEGORIES = [7, 18, 489, 32]

  let allModuleTypeIds: number[] = []
  const groupNames: Record<number, string> = {}

  // Fetch categories and their groups in parallel with controlled concurrency
  await batchPromiseAll(
    MODULE_CATEGORIES,
    2,
    async (categoryId) => {
      try {
        const catRes = await esiClient.get(`/universe/categories/${categoryId}/`)
        const catData = catRes.data
        const groupIds = catData.groups || []

        // Fetch groups in parallel within each category
        await batchPromiseAll(
          groupIds,
          10,
          async (groupId: number) => {
            try {
              const groupRes = await esiClient.get(`/universe/groups/${groupId}/`)
              const groupData = groupRes.data
              if (groupData.types) {
                allModuleTypeIds.push(...groupData.types)
                for (const tid of groupData.types) {
                  groupNames[tid] = groupData.name
                }
              }
            } catch (err) {
              logger.error('DogmaSync', `Failed to fetch group ${groupId}`, err)
            }
          }
        )
      } catch (err) {
        logger.error('DogmaSync', `Failed to fetch category ${categoryId}`, err)
      }
    }
  )

  allModuleTypeIds = Array.from(new Set(allModuleTypeIds))

  let alreadyCompleteInDb = 0
  for (const id of allModuleTypeIds) {
    if (existingTypeIds.has(id)) alreadyCompleteInDb++
  }
  
  await options?.onProgress?.({
    phase: 'list_built',
    totalTypeIds: allModuleTypeIds.length,
    alreadyCompleteInDb,
    pendingEsiWrites: allModuleTypeIds.length - alreadyCompleteInDb,
  })

  await syncSpecificModules(allModuleTypeIds, groupNames, existingTypeIds, options)
}
