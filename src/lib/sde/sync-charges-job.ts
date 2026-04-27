import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'
import path from 'path'
import os from 'os'

const STATUS_FILE = path.join(os.tmpdir(), 'sync-charges-status.json')

const DOGMA = {
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
  CHARGE_SIZE: 128,
  EM_DAMAGE: 114,
  THERM_DAMAGE: 117,
  KIN_DAMAGE: 118,
  EXP_DAMAGE: 119,
  MISSILE_DAMAGE: 116,
  EXPLOSION_RADIUS: 37,
  EXPLOSION_VELOCITY: 33,
  CAPACITOR_BONUS: 73,
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function getTypeInfo(typeId: number) {
  try {
    const res = await esiClient.get(`/universe/types/${typeId}/`)
    const data = res.data
    const attrs: Record<number, number> = {}
    if (data.dogma_attributes) {
      for (const a of data.dogma_attributes) {
        attrs[a.attribute_id] = a.value
      }
    }
    return { ...data, attrs }
  } catch (error) {
    logger.debug('SyncCharges', `Failed to get type info for ${typeId}`, { error })
    return null
  }
}

async function getGroupInfo(groupId: number) {
  try {
    const res = await esiClient.get(`/universe/groups/${groupId}/`)
    return res.data
  } catch (error) {
    logger.debug('SyncCharges', `Failed to get group info for ${groupId}`, { error })
    return null
  }
}

export interface SyncChargesStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  jobId: string
  startedAt: string | null
  completedAt: string | null
  target: string
  charges: { total: number; synced: number; errors: number }
  modules: { total: number; synced: number; errors: number }
  error?: string
}

export function getSyncChargesStatus(): SyncChargesStatus {
  try {
    if (existsSync(STATUS_FILE)) {
      const data = readFileSync(STATUS_FILE, 'utf-8')
      return JSON.parse(data) as SyncChargesStatus
    }
  } catch {
    /* ignore */
  }
  return {
    status: 'idle',
    jobId: '',
    startedAt: null,
    completedAt: null,
    target: 'all',
    charges: { total: 0, synced: 0, errors: 0 },
    modules: { total: 0, synced: 0, errors: 0 },
  }
}

function setStatus(status: SyncChargesStatus) {
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2))
}

export function clearSyncChargesStatusFile(): void {
  if (existsSync(STATUS_FILE)) {
    unlinkSync(STATUS_FILE)
  }
}

export type SyncChargesTarget = 'all' | 'charges' | 'modules'

export type RunSyncChargesJobOptions = {
  /** Called after each status write (throttle in callback if needed). */
  onAfterSetStatus?: (s: SyncChargesStatus) => void | Promise<void>
  /** When set (e.g. from POST /api/admin/sync-charges), returned `jobId` matches status file. */
  presetJobId?: string
}

/**
 * Same job as POST /api/admin/sync-charges. Await from admin scripts; fire-and-forget from HTTP.
 */
export async function runSyncChargesJob(
  target: SyncChargesTarget,
  options?: RunSyncChargesJobOptions
): Promise<void> {
  const status = getSyncChargesStatus()
  if (status.status === 'running') {
    return
  }

  const jobId = options?.presetJobId ?? Date.now().toString(36)
  const startTime = new Date().toISOString()

  const write = async (s: SyncChargesStatus) => {
    setStatus(s)
    if (options?.onAfterSetStatus) {
      await options.onAfterSetStatus(s)
    }
  }

  await write({
    status: 'running',
    jobId,
    startedAt: startTime,
    completedAt: null,
    target,
    charges: { total: 0, synced: 0, errors: 0 },
    modules: { total: 0, synced: 0, errors: 0 },
  })

  try {
    if (target === 'all' || target === 'charges') {
      logger.info('SyncCharges', 'Starting charge sync...')

      const catRes = await esiClient.get('/universe/categories/8/')
      const catData = catRes.data
      const chargeIds: number[] = []

      for (const gid of catData.groups || []) {
        const gData = await getGroupInfo(gid)
        if (gData?.types) {
          chargeIds.push(...gData.types)
        }
      }

      const current = getSyncChargesStatus()
      current.charges.total = chargeIds.length
      await write(current)

      for (const cid of chargeIds) {
        if (getSyncChargesStatus().status !== 'running') break

        try {
          const d = await getTypeInfo(cid)
          if (!d) {
            const s = getSyncChargesStatus()
            s.charges.errors++
            await write(s)
            continue
          }

          await prisma.chargeStats.upsert({
            where: { typeId: cid },
            update: {
              name: d.name || `Charge ${cid}`,
              groupId: d.group_id,
              chargeSize: Math.round(d.attrs[DOGMA.CHARGE_SIZE] || 0) || null,
              emDamage: d.attrs[DOGMA.EM_DAMAGE] || 0,
              thermDamage: d.attrs[DOGMA.THERM_DAMAGE] || 0,
              kinDamage: d.attrs[DOGMA.KIN_DAMAGE] || 0,
              expDamage: d.attrs[DOGMA.EXP_DAMAGE] || 0,
              missileDamage: d.attrs[DOGMA.MISSILE_DAMAGE] || 0,
              explosionRadius: d.attrs[DOGMA.EXPLOSION_RADIUS] || 0,
              explosionVelocity: d.attrs[DOGMA.EXPLOSION_VELOCITY] || 0,
              capacitorAmount: d.attrs[DOGMA.CAPACITOR_BONUS] || 0,
            },
            create: {
              typeId: cid,
              name: d.name || `Charge ${cid}`,
              groupId: d.group_id,
              chargeSize: Math.round(d.attrs[DOGMA.CHARGE_SIZE] || 0) || null,
              emDamage: d.attrs[DOGMA.EM_DAMAGE] || 0,
              thermDamage: d.attrs[DOGMA.THERM_DAMAGE] || 0,
              kinDamage: d.attrs[DOGMA.KIN_DAMAGE] || 0,
              expDamage: d.attrs[DOGMA.EXP_DAMAGE] || 0,
              missileDamage: d.attrs[DOGMA.MISSILE_DAMAGE] || 0,
              explosionRadius: d.attrs[DOGMA.EXPLOSION_RADIUS] || 0,
              explosionVelocity: d.attrs[DOGMA.EXPLOSION_VELOCITY] || 0,
              capacitorAmount: d.attrs[DOGMA.CAPACITOR_BONUS] || 0,
              syncedAt: new Date(),
            },
          })

          const s = getSyncChargesStatus()
          s.charges.synced++
          await write(s)

          await sleep(20)
        } catch {
          const s = getSyncChargesStatus()
          s.charges.errors++
          await write(s)
        }
      }
    }

    if (target === 'all' || target === 'modules') {
      logger.info('SyncCharges', 'Starting module charge group sync...')

      const catRes = await esiClient.get('/universe/categories/7/')
      const catData = catRes.data
      const modIds: number[] = []

      for (const gid of catData.groups || []) {
        const gData = await getGroupInfo(gid)
        if (gData?.types) {
          modIds.push(...gData.types)
        }
      }

      const current = getSyncChargesStatus()
      current.modules.total = modIds.length
      await write(current)

      for (const mid of modIds) {
        if (getSyncChargesStatus().status !== 'running') break

        try {
          const d = await getTypeInfo(mid)
          if (!d) {
            const s = getSyncChargesStatus()
            s.modules.errors++
            await write(s)
            continue
          }

          const chargeGroup1 = d.attrs[DOGMA.CHARGE_GROUP_1] || null
          if (chargeGroup1) {
            await prisma.moduleStats.upsert({
              where: { typeId: mid },
              update: {
                chargeGroup1: chargeGroup1 ? Math.round(chargeGroup1) : null,
                chargeGroup2: d.attrs[DOGMA.CHARGE_GROUP_2] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_2]) : null,
                chargeGroup3: d.attrs[DOGMA.CHARGE_GROUP_3] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_3]) : null,
                chargeGroup4: d.attrs[DOGMA.CHARGE_GROUP_4] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_4]) : null,
                chargeGroup5: d.attrs[DOGMA.CHARGE_GROUP_5] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_5]) : null,
                chargeGroup6: d.attrs[DOGMA.CHARGE_GROUP_6] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_6]) : null,
                chargeGroup7: d.attrs[DOGMA.CHARGE_GROUP_7] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_7]) : null,
                chargeGroup8: d.attrs[DOGMA.CHARGE_GROUP_8] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_8]) : null,
                chargeGroup9: d.attrs[DOGMA.CHARGE_GROUP_9] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_9]) : null,
                chargeGroup10: d.attrs[DOGMA.CHARGE_GROUP_10] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_10]) : null,
                chargeSize:
                  d.attrs[DOGMA.CHARGE_SIZE] != null && Number.isFinite(Number(d.attrs[DOGMA.CHARGE_SIZE]))
                    ? Math.round(Number(d.attrs[DOGMA.CHARGE_SIZE]))
                    : null,
              },
              create: {
                typeId: mid,
                name: d.name || `Module ${mid}`,
                chargeGroup1: chargeGroup1 ? Math.round(chargeGroup1) : null,
                chargeGroup2: d.attrs[DOGMA.CHARGE_GROUP_2] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_2]) : null,
                chargeGroup3: d.attrs[DOGMA.CHARGE_GROUP_3] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_3]) : null,
                chargeGroup4: d.attrs[DOGMA.CHARGE_GROUP_4] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_4]) : null,
                chargeGroup5: d.attrs[DOGMA.CHARGE_GROUP_5] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_5]) : null,
                chargeGroup6: d.attrs[DOGMA.CHARGE_GROUP_6] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_6]) : null,
                chargeGroup7: d.attrs[DOGMA.CHARGE_GROUP_7] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_7]) : null,
                chargeGroup8: d.attrs[DOGMA.CHARGE_GROUP_8] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_8]) : null,
                chargeGroup9: d.attrs[DOGMA.CHARGE_GROUP_9] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_9]) : null,
                chargeGroup10: d.attrs[DOGMA.CHARGE_GROUP_10] ? Math.round(d.attrs[DOGMA.CHARGE_GROUP_10]) : null,
                chargeSize:
                  d.attrs[DOGMA.CHARGE_SIZE] != null && Number.isFinite(Number(d.attrs[DOGMA.CHARGE_SIZE]))
                    ? Math.round(Number(d.attrs[DOGMA.CHARGE_SIZE]))
                    : null,
                syncedAt: new Date(),
              },
            })
          }

          const s = getSyncChargesStatus()
          s.modules.synced++
          await write(s)

          await sleep(20)
        } catch {
          const s = getSyncChargesStatus()
          s.modules.errors++
          await write(s)
        }
      }
    }

    const final = getSyncChargesStatus()
    final.status = 'completed'
    final.completedAt = new Date().toISOString()
    await write(final)
    logger.info('SyncCharges', 'Sync charges job completed successfully')
  } catch (error) {
    const s = getSyncChargesStatus()
    s.status = 'failed'
    s.error = String(error)
    s.completedAt = new Date().toISOString()
    await write(s)
    logger.error('SyncCharges', 'Sync charges job failed', { error })
  }
}
