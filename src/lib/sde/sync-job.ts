import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import path from 'path'
import os from 'os'
import { syncShipDogmaData } from './ship-dogma-sync'
import { syncModuleStats } from './module-stats-esi-sync'

const STATUS_FILE = path.join(os.tmpdir(), 'sync-status.json')

export interface SyncStatus {
  status: 'idle' | 'running' | 'completed' | 'failed'
  jobId: string
  startedAt: string | null
  completedAt: string | null
  target: 'all' | 'ships' | 'modules'
  ships: { total: number; synced: number; errors: number }
  modules: { total: number; synced: number; errors: number }
  error?: string
}

export function getSyncStatus(): SyncStatus {
  try {
    if (existsSync(STATUS_FILE)) {
      const data = readFileSync(STATUS_FILE, 'utf-8')
      return JSON.parse(data) as SyncStatus
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
    ships: { total: 0, synced: 0, errors: 0 },
    modules: { total: 0, synced: 0, errors: 0 },
  }
}

function setStatus(status: SyncStatus) {
  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2))
}

export function clearSyncStatusFile(): void {
  if (existsSync(STATUS_FILE)) {
    unlinkSync(STATUS_FILE)
  }
}

export async function runSyncJob(
  target: 'all' | 'ships' | 'modules',
  options?: { presetJobId?: string }
): Promise<void> {
  const current = getSyncStatus()
  if (current.status === 'running') {
    return
  }

  const jobId = options?.presetJobId ?? Date.now().toString(36)
  const startTime = new Date().toISOString()

  setStatus({
    status: 'running',
    jobId,
    startedAt: startTime,
    completedAt: null,
    target,
    ships: { total: 0, synced: 0, errors: 0 },
    modules: { total: 0, synced: 0, errors: 0 },
  })

  try {
    if (target === 'all' || target === 'ships') {
      logger.info('SyncJob', 'Starting ship dogma sync...')
      // syncShipDogmaData currently doesn't have a progress callback that matches our status
      // but we call it and update status after.
      // Future improvement: Add callback to syncShipDogmaData
      await syncShipDogmaData()
      
      const s = getSyncStatus()
      const shipCount = await prisma.shipStats.count()
      s.ships.synced = shipCount
      s.ships.total = shipCount
      setStatus(s)
    }

    if (target === 'all' || target === 'modules') {
      logger.info('SyncJob', 'Starting module stats sync...')
      await syncModuleStats()
      
      const s = getSyncStatus()
      const moduleCount = await prisma.moduleStats.count()
      s.modules.synced = moduleCount
      s.modules.total = moduleCount
      setStatus(s)
    }

    const final = getSyncStatus()
    final.status = 'completed'
    final.completedAt = new Date().toISOString()
    setStatus(final)
    logger.info('SyncJob', 'Sync completed successfully', { jobId })
  } catch (error) {
    const s = getSyncStatus()
    s.status = 'failed'
    s.error = String(error)
    s.completedAt = new Date().toISOString()
    setStatus(s)
    logger.error('SyncJob', 'Sync failed', error, { jobId })
  }
}
