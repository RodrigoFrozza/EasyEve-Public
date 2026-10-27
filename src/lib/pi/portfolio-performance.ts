import { isPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { withCache } from '@/lib/cache'
import { PI_COLONIES_CACHE_PREFIX } from '@/lib/pi/cache-keys'
import { fetchAndAnalyzePiColonies } from '@/lib/pi/isk-per-hour'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const PI_PERFORMANCE_ACTIVITY = 'pi' as const

const SNAPSHOT_RETENTION_DAYS = 30
const PI_FETCH_CACHE_TTL = 10 * 60 * 1000

export interface PiDailySnapshot {
  currentNetIskPerHour: number
  colonyCount: number
  recordedAt: string
}

export type PiDailySnapshotMap = Record<string, PiDailySnapshot>

function utcDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function pruneSnapshots(map: PiDailySnapshotMap): PiDailySnapshotMap {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SNAPSHOT_RETENTION_DAYS)
  const cutoffKey = utcDateKey(cutoff)
  const next: PiDailySnapshotMap = {}
  for (const [date, snapshot] of Object.entries(map)) {
    if (date >= cutoffKey) next[date] = snapshot
  }
  return next
}

function parseSnapshotMap(value: unknown): PiDailySnapshotMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const map: PiDailySnapshotMap = {}
  for (const [date, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const row = raw as Record<string, unknown>
    const currentNetIskPerHour = Number(row.currentNetIskPerHour)
    const colonyCount = Number(row.colonyCount)
    const recordedAt = typeof row.recordedAt === 'string' ? row.recordedAt : ''
    if (!Number.isFinite(currentNetIskPerHour)) continue
    map[date] = {
      currentNetIskPerHour,
      colonyCount: Number.isFinite(colonyCount) ? colonyCount : 0,
      recordedAt,
    }
  }
  return map
}

/** Estimated daily profit from current (real) production rate — may be negative. */
export function piDailyProfitFromRate(currentNetIskPerHour: number): number {
  return currentNetIskPerHour * 24
}

export async function loadPiDailySnapshots(userId: string): Promise<PiDailySnapshotMap> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { piDailySnapshots: true },
  })
  return parseSnapshotMap(profile?.piDailySnapshots)
}

export async function recordPiDailySnapshot(
  userId: string,
  currentNetIskPerHour: number,
  colonyCount: number,
  at: Date = new Date()
): Promise<void> {
  const dateKey = utcDateKey(at)
  const existing = await loadPiDailySnapshots(userId)
  const next = pruneSnapshots({
    ...existing,
    [dateKey]: {
      currentNetIskPerHour,
      colonyCount,
      recordedAt: at.toISOString(),
    },
  })

  const jsonSnapshots = next as unknown as Prisma.InputJsonValue

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      piDailySnapshots: jsonSnapshots,
    },
    update: {
      piDailySnapshots: jsonSnapshots,
    },
  })
}

export interface PiLivePortfolio {
  currentNetIskPerHour: number
  colonyCount: number
  /** True when some character/planet failed to fetch from ESI this run — totals are incomplete. */
  hasPartialFailure: boolean
}

export async function fetchPiLivePortfolio(
  userId: string,
  characters: Array<{ id: number; name: string; accessToken?: string | null }>
): Promise<PiLivePortfolio | null> {
  if (!(await isPlatformModuleActive('pi'))) return null
  if (characters.length === 0) return null

  const cacheKey = `${PI_COLONIES_CACHE_PREFIX}:${userId}:performance`

  try {
    const data = await withCache(
      cacheKey,
      () =>
        fetchAndAnalyzePiColonies({
          userId,
          characters: characters.map((c) => ({
            id: c.id,
            name: c.name,
            accessToken: c.accessToken,
          })),
        }),
      PI_FETCH_CACHE_TTL
    )

    const hasPartialFailure = data.charactersFailed.length > 0 || data.planetsFailed.length > 0

    if (data.colonies.length === 0 && data.totals.currentNetIskPerHour === 0) {
      return { currentNetIskPerHour: 0, colonyCount: 0, hasPartialFailure }
    }

    return {
      currentNetIskPerHour: data.totals.currentNetIskPerHour,
      colonyCount: data.totals.colonyCount,
      hasPartialFailure,
    }
  } catch {
    return null
  }
}

export interface PiDailyPerformanceRow {
  date: string
  value: number
  sessions: number
  durationMinutes: number
  currentNetIskPerHour: number
}

export function buildPiDailyPerformance(
  dateRange: string[],
  snapshots: PiDailySnapshotMap,
  liveToday?: PiLivePortfolio | null
): PiDailyPerformanceRow[] {
  const todayKey = utcDateKey(new Date())
  // Carry the last known snapshot forward across gaps (dateRange is oldest-first).
  let lastKnown: { currentNetIskPerHour: number; colonyCount: number } | null = null

  return dateRange.map((date) => {
    const live = date === todayKey ? liveToday : undefined
    let snapshot = live
      ? {
          currentNetIskPerHour: live.currentNetIskPerHour,
          colonyCount: live.colonyCount,
          recordedAt: new Date().toISOString(),
        }
      : snapshots[date]

    // A day the user simply didn't open the app has no snapshot. PI production is
    // continuous, so treat a gap as "same as last known" instead of 0 — a 0 would
    // read as the colonies collapsing and fire a false downward-trend alert.
    if (!snapshot && lastKnown) {
      snapshot = { ...lastKnown, recordedAt: '' }
    }
    if (snapshot) {
      lastKnown = {
        currentNetIskPerHour: snapshot.currentNetIskPerHour,
        colonyCount: snapshot.colonyCount,
      }
    }

    const currentNetIskPerHour = snapshot?.currentNetIskPerHour ?? 0
    const colonyCount = snapshot?.colonyCount ?? 0

    return {
      date,
      value: piDailyProfitFromRate(currentNetIskPerHour),
      sessions: colonyCount > 0 ? 1 : 0,
      durationMinutes: colonyCount > 0 ? 24 * 60 : 0,
      currentNetIskPerHour,
    }
  })
}
