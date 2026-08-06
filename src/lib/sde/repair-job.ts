import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'
import path from 'path'
import os from 'os'

const STATUS_FILE = path.join(os.tmpdir(), 'repair-status.json')
const DOGMA = { HI: 14, MED: 13, LOW: 12, RIG: 1137, CPU: 48, POWER: 11 }

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export interface RepairStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  jobId: string
  startedAt: string | null
  completedAt: string | null
  dryRun: boolean
  total: number
  checked: number
  corrupted: number
  fixed: number
  errors: number
  changes: { typeId: number; name: string; old: string; new: string }[]
  error?: string
}

export function getRepairStatus(): RepairStatus {
  try {
    if (existsSync(STATUS_FILE)) {
      const data = readFileSync(STATUS_FILE, 'utf-8')
      return JSON.parse(data) as RepairStatus
    }
  } catch {
    /* ignore */
  }
  return {
    status: 'idle',
    jobId: '',
    startedAt: null,
    completedAt: null,
    dryRun: true,
    total: 0,
    checked: 0,
    corrupted: 0,
    fixed: 0,
    errors: 0,
    changes: [],
  }
}

function setStatus(status: RepairStatus) {
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2))
}

export function clearRepairStatusFile(): void {
  if (existsSync(STATUS_FILE)) {
    unlinkSync(STATUS_FILE)
  }
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
    logger.debug('RepairJob', `Failed to get type info for ${typeId}`, { error })
    return null
  }
}

export async function runRepairJob(
  dryRun: boolean,
  options?: { presetJobId?: string }
): Promise<void> {
  const current = getRepairStatus()
  if (current.status === 'running') return

  const jobId = options?.presetJobId ?? Date.now().toString(36)
  const startTime = new Date().toISOString()

  setStatus({
    status: 'running',
    jobId,
    startedAt: startTime,
    completedAt: null,
    dryRun,
    total: 0,
    checked: 0,
    corrupted: 0,
    fixed: 0,
    errors: 0,
    changes: [],
  })

  try {
    const ships = await prisma.shipStats.findMany({
      select: { typeId: true, name: true, highSlots: true, medSlots: true, lowSlots: true, rigSlots: true },
    })

    const s = getRepairStatus()
    s.total = ships.length
    setStatus(s)

    for (const ship of ships) {
      if (getRepairStatus().status !== 'running') break

      try {
        const d = await getTypeInfo(ship.typeId)
        if (!d) {
          const st = getRepairStatus()
          st.errors++
          st.checked++
          setStatus(st)
          continue
        }

        const correctSlots = {
          high: Math.round(d.attrs[DOGMA.HI] || 0),
          med: Math.round(d.attrs[DOGMA.MED] || 0),
          low: Math.round(d.attrs[DOGMA.LOW] || 0),
          rig: Math.round(d.attrs[DOGMA.RIG] || 0),
        }

        const isCorrupted =
          ship.highSlots !== correctSlots.high ||
          ship.medSlots !== correctSlots.med ||
          ship.lowSlots !== correctSlots.low ||
          ship.rigSlots !== correctSlots.rig

        const st = getRepairStatus()

        if (isCorrupted) {
          st.corrupted++
          st.changes.push({
            typeId: ship.typeId,
            name: ship.name,
            old: `${ship.highSlots}/${ship.medSlots}/${ship.lowSlots}/${ship.rigSlots}`,
            new: `${correctSlots.high}/${correctSlots.med}/${correctSlots.low}/${correctSlots.rig}`,
          })

          if (!dryRun) {
            await prisma.shipStats.update({
              where: { typeId: ship.typeId },
              data: {
                highSlots: correctSlots.high,
                medSlots: correctSlots.med,
                lowSlots: correctSlots.low,
                rigSlots: correctSlots.rig,
                cpu: Math.round(d.attrs[DOGMA.CPU] || 0),
                powerGrid: Math.round(d.attrs[DOGMA.POWER] || 0),
              },
            })
            st.fixed++
          }
        }

        st.checked++
        setStatus(st)
        await sleep(30)
      } catch (err) {
        logger.error('RepairJob', `Error repairing ship ${ship.typeId}`, err)
        const st = getRepairStatus()
        st.errors++
        st.checked++
        setStatus(st)
      }
    }

    const final = getRepairStatus()
    final.status = 'completed'
    final.completedAt = new Date().toISOString()
    setStatus(final)
    logger.info('RepairJob', 'Repair job completed successfully')
  } catch (error) {
    const s = getRepairStatus()
    s.status = 'failed'
    s.error = String(error)
    s.completedAt = new Date().toISOString()
    setStatus(s)
    logger.error('RepairJob', 'Repair job failed', error)
  }
}
