import { subDays, eachDayOfInterval } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { getActivityDurationMs } from '@/lib/activities/activity-duration'
import { splitDurationByValue } from '@/lib/analytics/loot-intel-shared'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { resolveSolarSystemNames } from '@/lib/mining-system-names'
import type { MiningActivityData, MiningLogEntry } from '@/types/domain'

export type MiningPersonalOverviewQuery = {
  userId: string
  days?: number
  characterId?: number
  space?: string
  category?: string
}

export type MiningOverviewBreakdownRow = {
  key: string
  label: string
  isk: number
  m3: number
  sessions: number
  durationMs?: number
}

export type MiningOverviewOreRow = {
  typeId: number
  name: string
  isk: number
  m3: number
  quantity: number
}

export type MiningOverviewTimelineRow = {
  date: string
  isk: number
  m3: number
  sessions: number
}

export type MiningOverviewSolarSystemRow = {
  solarSystemId: number
  name: string
  isk: number
  m3: number
  sessions: number
  durationMs?: number
}

export type MiningOverviewRegionRow = {
  regionId: number
  name: string
  isk: number
  m3: number
  sessions: number
  durationMs?: number
}

export type MiningOverviewConstellationRow = {
  constellationId: number
  name: string
  isk: number
  m3: number
  sessions: number
  durationMs?: number
}

export type MiningPersonalOverviewResponse = {
  meta: {
    generatedAt: string
    periodDays: number | null
    sessionCount: number
    totalIsk: number
    totalM3: number
    totalDurationMs: number
    avgIskPerHour: number | null
    avgM3PerHour: number | null
  }
  timeline: MiningOverviewTimelineRow[]
  byCharacter: MiningOverviewBreakdownRow[]
  bySpace: MiningOverviewBreakdownRow[]
  byCategory: MiningOverviewBreakdownRow[]
  byOre: MiningOverviewOreRow[]
  bySolarSystem: MiningOverviewSolarSystemRow[]
  byRegion: MiningOverviewRegionRow[]
  byConstellation: MiningOverviewConstellationRow[]
}

type ActivityRow = {
  id: string
  characterId: number | null
  space: string | null
  startTime: Date
  endTime: Date | null
  status: string
  isPaused: boolean
  pausedAt: Date | null
  accumulatedPausedTime: number
  updatedAt: Date
  participants: unknown
  data: unknown
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function activityMatchesCharacter(
  activity: ActivityRow,
  characterId: number
): boolean {
  if (activity.characterId === characterId) return true
  const participants = activity.participants as Array<{ characterId?: number }> | null
  if (!Array.isArray(participants)) return false
  return participants.some((p) => p.characterId === characterId)
}

function getMiningData(activity: ActivityRow): MiningActivityData {
  return (activity.data ?? {}) as MiningActivityData
}

function getActivityM3(data: MiningActivityData): number {
  return toNumber(data.totalQuantity)
}

function getLogs(data: MiningActivityData): MiningLogEntry[] {
  return Array.isArray(data.logs) ? data.logs : []
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getScopedActivityMetrics(
  activity: ActivityRow,
  data: MiningActivityData,
  characterId?: number
): { isk: number; m3: number } {
  if (!characterId) {
    const metrics = getActivityFinancialMetrics({ type: 'mining', data })
    return { isk: metrics.miningValue, m3: getActivityM3(data) }
  }

  const participantBreakdown = data.participantBreakdown
  if (participantBreakdown && typeof participantBreakdown === 'object') {
    const entry = Object.values(participantBreakdown).find(
      (row) => toNumber(row.characterId) === characterId
    )
    if (entry) {
      return {
        isk: toNumber(entry.estimatedValue),
        m3: toNumber(entry.volumeValue ?? entry.quantity),
      }
    }
  }

  const charLogs = getLogs(data).filter(
    (log) => toNumber(log.characterId ?? log.charId) === characterId
  )
  if (charLogs.length > 0) {
    return {
      isk: charLogs.reduce((sum, log) => sum + toNumber(log.estimatedValue ?? log.value), 0),
      m3: charLogs.reduce((sum, log) => sum + toNumber(log.volumeValue ?? log.m3), 0),
    }
  }

  if (activity.characterId === characterId) {
    const metrics = getActivityFinancialMetrics({ type: 'mining', data })
    return { isk: metrics.miningValue, m3: getActivityM3(data) }
  }

  return { isk: 0, m3: 0 }
}

function logsForCharacter(data: MiningActivityData, characterId?: number): MiningLogEntry[] {
  const logs = getLogs(data)
  if (!characterId) return logs
  return logs.filter((log) => toNumber(log.characterId ?? log.charId) === characterId)
}

export async function queryMiningPersonalOverview(
  query: MiningPersonalOverviewQuery
): Promise<MiningPersonalOverviewResponse> {
  const { userId, days, characterId, space, category } = query

  const where: {
    userId: string
    type: string
    isDeleted: boolean
    startTime?: { gte: Date }
    space?: string
  } = {
    userId,
    type: 'mining',
    isDeleted: false,
  }

  if (days && days > 0) {
    where.startTime = { gte: subDays(new Date(), days) }
  }

  if (space) {
    where.space = space
  }

  const activities = await prisma.activity.findMany({
    where,
    select: {
      id: true,
      characterId: true,
      space: true,
      startTime: true,
      endTime: true,
      status: true,
      isPaused: true,
      pausedAt: true,
      accumulatedPausedTime: true,
      updatedAt: true,
      participants: true,
      data: true,
    },
    orderBy: { startTime: 'desc' },
  })

  let filtered = activities as ActivityRow[]

  if (characterId) {
    filtered = filtered.filter((a) => activityMatchesCharacter(a, characterId))
  }

  if (category) {
    filtered = filtered.filter((a) => {
      const data = getMiningData(a)
      const mt = data.miningType || 'Ore'
      return mt.toLowerCase() === category.toLowerCase()
    })
  }

  let totalIsk = 0
  let totalM3 = 0
  let totalDurationMs = 0
  let completedDurationMs = 0

  const timelineMap = new Map<string, MiningOverviewTimelineRow>()
  const characterMap = new Map<number, MiningOverviewBreakdownRow>()
  const spaceMap = new Map<string, MiningOverviewBreakdownRow>()
  const categoryMap = new Map<string, MiningOverviewBreakdownRow>()
  const oreMap = new Map<number, MiningOverviewOreRow>()
  const systemAgg = new Map<
    number,
    { isk: number; m3: number; sessionIds: Set<string>; name?: string; durationMs: number }
  >()
  const regionAgg = new Map<
    number,
    { isk: number; m3: number; sessionIds: Set<string>; name?: string; durationMs: number }
  >()
  const constellationAgg = new Map<
    number,
    { isk: number; m3: number; sessionIds: Set<string>; name?: string; durationMs: number }
  >()

  for (const activity of filtered) {
    const data = getMiningData(activity)
    const { isk, m3 } = getScopedActivityMetrics(activity, data, characterId)
    const durationMs = getActivityDurationMs({
      startTime: activity.startTime,
      endTime: activity.endTime,
      status: activity.status,
      updatedAt: activity.updatedAt,
      accumulatedPausedTime: activity.accumulatedPausedTime,
      isPaused: activity.isPaused,
      pausedAt: activity.pausedAt,
    })
    const miningCategory = data.miningType || 'Ore'
    const activitySpace = activity.space || 'Unknown'

    totalIsk += isk
    totalM3 += m3
    totalDurationMs += durationMs
    if (activity.status === 'completed') {
      completedDurationMs += durationMs
    }

    const dk = dayKey(activity.startTime)
    const timelineRow = timelineMap.get(dk) ?? {
      date: dk,
      isk: 0,
      m3: 0,
      sessions: 0,
    }
    timelineRow.isk += isk
    timelineRow.m3 += m3
    timelineRow.sessions += 1
    timelineMap.set(dk, timelineRow)

    const spaceRow = spaceMap.get(activitySpace) ?? {
      key: activitySpace,
      label: activitySpace,
      isk: 0,
      m3: 0,
      sessions: 0,
      durationMs: 0,
    }
    spaceRow.isk += isk
    spaceRow.m3 += m3
    spaceRow.sessions += 1
    spaceRow.durationMs = (spaceRow.durationMs ?? 0) + durationMs
    spaceMap.set(activitySpace, spaceRow)

    const catRow = categoryMap.get(miningCategory) ?? {
      key: miningCategory,
      label: miningCategory,
      isk: 0,
      m3: 0,
      sessions: 0,
      durationMs: 0,
    }
    catRow.isk += isk
    catRow.m3 += m3
    catRow.sessions += 1
    catRow.durationMs = (catRow.durationMs ?? 0) + durationMs
    categoryMap.set(miningCategory, catRow)

    const participantBreakdown = data.participantBreakdown
    if (participantBreakdown && typeof participantBreakdown === 'object') {
      for (const entry of Object.values(participantBreakdown)) {
        const charId = toNumber(entry.characterId)
        if (!charId) continue
        if (characterId && charId !== characterId) continue
        const charRow = characterMap.get(charId) ?? {
          key: String(charId),
          label: entry.characterName || `Character ${charId}`,
          isk: 0,
          m3: 0,
          sessions: 0,
          durationMs: 0,
        }
        charRow.isk += toNumber(entry.estimatedValue)
        charRow.m3 += toNumber(entry.volumeValue ?? entry.quantity)
        charRow.sessions += 1
        charRow.durationMs = (charRow.durationMs ?? 0) + durationMs
        characterMap.set(charId, charRow)
      }
    } else if (activity.characterId && (!characterId || activity.characterId === characterId)) {
      const charId = activity.characterId
      const participants = activity.participants as Array<{
        characterId?: number
        characterName?: string
      }> | null
      const name =
        participants?.find((p) => p.characterId === charId)?.characterName ||
        `Character ${charId}`
      const charRow = characterMap.get(charId) ?? {
        key: String(charId),
        label: name,
        isk: 0,
        m3: 0,
        sessions: 0,
        durationMs: 0,
      }
      charRow.isk += isk
      charRow.m3 += m3
      charRow.sessions += 1
      charRow.durationMs = (charRow.durationMs ?? 0) + durationMs
      characterMap.set(charId, charRow)
    }

    const regionBreakdownData = characterId
      ? undefined
      : (data.regionBreakdown as
      | Record<
          string,
          { regionId?: number; regionName?: string; isk?: number; m3?: number }
        >
      | undefined)
    if (regionBreakdownData && typeof regionBreakdownData === 'object') {
      const regionEntries = Object.values(regionBreakdownData).filter(
        (entry) => toNumber(entry.regionId) > 0
      )
      const regionDurationSplit = splitDurationByValue(
        durationMs,
        regionEntries.map((entry) => ({
          key: toNumber(entry.regionId),
          value: toNumber(entry.isk),
        }))
      )
      for (const entry of regionEntries) {
        const regionId = toNumber(entry.regionId)
        const regAgg = regionAgg.get(regionId) ?? {
          isk: 0,
          m3: 0,
          sessionIds: new Set<string>(),
          name: entry.regionName,
          durationMs: 0,
        }
        regAgg.isk += toNumber(entry.isk)
        regAgg.m3 += toNumber(entry.m3)
        regAgg.sessionIds.add(activity.id)
        regAgg.durationMs += regionDurationSplit.get(regionId) ?? 0
        if (entry.regionName) regAgg.name = entry.regionName
        regionAgg.set(regionId, regAgg)
      }
    }

    const systemBreakdownData = characterId
      ? undefined
      : (data.systemBreakdown as
      | Record<
          string,
          {
            solarSystemId?: number
            name?: string
            regionId?: number
            regionName?: string
            isk?: number
            m3?: number
          }
        >
      | undefined)
    if (systemBreakdownData && typeof systemBreakdownData === 'object') {
      const systemEntries = Object.values(systemBreakdownData).filter(
        (entry) => toNumber(entry.solarSystemId) > 0
      )
      const systemDurationSplit = splitDurationByValue(
        durationMs,
        systemEntries.map((entry) => ({
          key: toNumber(entry.solarSystemId),
          value: toNumber(entry.isk),
        }))
      )
      for (const entry of systemEntries) {
        const sysId = toNumber(entry.solarSystemId)
        if (!sysId) continue
        const sysAgg = systemAgg.get(sysId) ?? {
          isk: 0,
          m3: 0,
          sessionIds: new Set<string>(),
          name: entry.name,
          durationMs: 0,
        }
        sysAgg.isk += toNumber(entry.isk)
        sysAgg.m3 += toNumber(entry.m3)
        sysAgg.sessionIds.add(activity.id)
        sysAgg.durationMs += systemDurationSplit.get(sysId) ?? 0
        if (entry.name) sysAgg.name = entry.name
        systemAgg.set(sysId, sysAgg)
      }
    }

    if (!characterId) {
      const constellationBuckets = new Map<
        number,
        { isk: number; m3: number; name?: string }
      >()

      for (const log of logsForCharacter(data, characterId)) {
        const logIsk = toNumber(log.estimatedValue ?? log.value)
        const logM3 = toNumber(log.volumeValue ?? log.m3)
        const constellationId = log.constellationId
        if (!constellationId || constellationId <= 0) continue

        const bucket = constellationBuckets.get(constellationId) ?? {
          isk: 0,
          m3: 0,
          name: log.constellationName,
        }
        bucket.isk += logIsk
        bucket.m3 += logM3
        if (log.constellationName) bucket.name = log.constellationName
        constellationBuckets.set(constellationId, bucket)
      }

      if (constellationBuckets.size > 0) {
        const constellationDurationSplit = splitDurationByValue(
          durationMs,
          [...constellationBuckets.entries()].map(([constellationId, bucket]) => ({
            key: constellationId,
            value: bucket.isk,
          }))
        )
        for (const [constellationId, bucket] of constellationBuckets) {
          const conAgg = constellationAgg.get(constellationId) ?? {
            isk: 0,
            m3: 0,
            sessionIds: new Set<string>(),
            name: bucket.name,
            durationMs: 0,
          }
          conAgg.isk += bucket.isk
          conAgg.m3 += bucket.m3
          conAgg.sessionIds.add(activity.id)
          conAgg.durationMs += constellationDurationSplit.get(constellationId) ?? 0
          if (bucket.name) conAgg.name = bucket.name
          constellationAgg.set(constellationId, conAgg)
        }
      }
    }

    const oreBreakdown = characterId ? undefined : data.oreBreakdown
    if (oreBreakdown && typeof oreBreakdown === 'object') {
      for (const [typeIdStr, entry] of Object.entries(oreBreakdown)) {
        const typeId = Number(typeIdStr)
        if (!Number.isFinite(typeId)) continue
        const oreRow = oreMap.get(typeId) ?? {
          typeId,
          name: entry.name || `Type ${typeId}`,
          isk: 0,
          m3: 0,
          quantity: 0,
        }
        oreRow.isk += toNumber(entry.estimatedValue)
        oreRow.m3 += toNumber(entry.volumeValue)
        oreRow.quantity += toNumber(entry.quantity)
        if (entry.name) oreRow.name = entry.name
        oreMap.set(typeId, oreRow)
      }
    } else {
      for (const log of logsForCharacter(data, characterId)) {
        const typeId = log.typeId
        if (!typeId) continue
        const oreRow = oreMap.get(typeId) ?? {
          typeId,
          name: log.oreName || `Type ${typeId}`,
          isk: 0,
          m3: 0,
          quantity: 0,
        }
        oreRow.isk += toNumber(log.estimatedValue ?? log.value)
        oreRow.m3 += toNumber(log.volumeValue ?? log.m3)
        oreRow.quantity += toNumber(log.quantity)
        if (log.oreName) oreRow.name = log.oreName
        oreMap.set(typeId, oreRow)
      }
    }

    if (!systemBreakdownData || !regionBreakdownData) {
      const systemBuckets = new Map<
        number,
        { isk: number; m3: number; name?: string }
      >()
      const regionBuckets = new Map<
        number,
        { isk: number; m3: number; name?: string }
      >()

      for (const log of logsForCharacter(data, characterId)) {
        const logIsk = toNumber(log.estimatedValue ?? log.value)
        const logM3 = toNumber(log.volumeValue ?? log.m3)

        if (!systemBreakdownData) {
          const sysId = log.solarSystemId
          if (sysId && sysId > 0) {
            const bucket = systemBuckets.get(sysId) ?? {
              isk: 0,
              m3: 0,
              name: undefined as string | undefined,
            }
            bucket.isk += logIsk
            bucket.m3 += logM3
            systemBuckets.set(sysId, bucket)
          }
        }

        if (!regionBreakdownData) {
          const regionId = log.regionId
          if (regionId && regionId > 0) {
            const bucket = regionBuckets.get(regionId) ?? {
              isk: 0,
              m3: 0,
              name: log.regionName,
            }
            bucket.isk += logIsk
            bucket.m3 += logM3
            if (log.regionName) bucket.name = log.regionName
            regionBuckets.set(regionId, bucket)
          }
        }
      }

      if (!systemBreakdownData && systemBuckets.size > 0) {
        const systemDurationSplit = splitDurationByValue(
          durationMs,
          [...systemBuckets.entries()].map(([sysId, bucket]) => ({
            key: sysId,
            value: bucket.isk,
          }))
        )
        for (const [sysId, bucket] of systemBuckets) {
          const sysAgg = systemAgg.get(sysId) ?? {
            isk: 0,
            m3: 0,
            sessionIds: new Set<string>(),
            name: bucket.name,
            durationMs: 0,
          }
          sysAgg.isk += bucket.isk
          sysAgg.m3 += bucket.m3
          sysAgg.sessionIds.add(activity.id)
          sysAgg.durationMs += systemDurationSplit.get(sysId) ?? 0
          systemAgg.set(sysId, sysAgg)
        }
      }

      if (!regionBreakdownData && regionBuckets.size > 0) {
        const regionDurationSplit = splitDurationByValue(
          durationMs,
          [...regionBuckets.entries()].map(([regionId, bucket]) => ({
            key: regionId,
            value: bucket.isk,
          }))
        )
        for (const [regionId, bucket] of regionBuckets) {
          const regAgg = regionAgg.get(regionId) ?? {
            isk: 0,
            m3: 0,
            sessionIds: new Set<string>(),
            name: bucket.name,
            durationMs: 0,
          }
          regAgg.isk += bucket.isk
          regAgg.m3 += bucket.m3
          regAgg.sessionIds.add(activity.id)
          regAgg.durationMs += regionDurationSplit.get(regionId) ?? 0
          if (bucket.name) regAgg.name = bucket.name
          regionAgg.set(regionId, regAgg)
        }
      }
    }
  }

  const unresolvedSystemIds = [...systemAgg.entries()]
    .filter(([, agg]) => !agg.name)
    .map(([id]) => id)
  if (unresolvedSystemIds.length > 0) {
    const systemNames = await resolveSolarSystemNames(unresolvedSystemIds)
    for (const [sysId, agg] of systemAgg) {
      if (!agg.name && systemNames[sysId]) {
        agg.name = systemNames[sysId]
      }
    }
  }

  const completedHours = completedDurationMs / 3_600_000
  const avgIskPerHour = completedHours > 0 ? totalIsk / completedHours : null
  const avgM3PerHour = completedHours > 0 ? totalM3 / completedHours : null

  const bySolarSystem: MiningOverviewSolarSystemRow[] = [...systemAgg.entries()]
    .map(([solarSystemId, agg]) => ({
      solarSystemId,
      name: agg.name ?? `System ${solarSystemId}`,
      isk: agg.isk,
      m3: agg.m3,
      sessions: agg.sessionIds.size,
      durationMs: agg.durationMs,
    }))
    .sort((a, b) => b.isk - a.isk)

  const byRegion: MiningOverviewRegionRow[] = [...regionAgg.entries()]
    .map(([regionId, agg]) => ({
      regionId,
      name: agg.name ?? `Region ${regionId}`,
      isk: agg.isk,
      m3: agg.m3,
      sessions: agg.sessionIds.size,
      durationMs: agg.durationMs,
    }))
    .sort((a, b) => b.isk - a.isk)

  const byConstellation: MiningOverviewConstellationRow[] = [
    ...constellationAgg.entries(),
  ]
    .map(([constellationId, agg]) => ({
      constellationId,
      name: agg.name ?? `Constellation ${constellationId}`,
      isk: agg.isk,
      m3: agg.m3,
      sessions: agg.sessionIds.size,
      durationMs: agg.durationMs,
    }))
    .sort((a, b) => b.isk - a.isk)

  const sortByIsk = <T extends { isk: number }>(rows: T[]): T[] =>
    [...rows].sort((a, b) => b.isk - a.isk)

  const timelineSorted = [...timelineMap.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  let timeline = timelineSorted
  if (timelineSorted.length >= 2) {
    const start = new Date(timelineSorted[0].date)
    const end = new Date(timelineSorted[timelineSorted.length - 1].date)
    const daysInRange = eachDayOfInterval({ start, end })
    timeline = daysInRange.map((day) => {
      const dk = dayKey(day)
      return (
        timelineMap.get(dk) ?? {
          date: dk,
          isk: 0,
          m3: 0,
          sessions: 0,
        }
      )
    })
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      periodDays: days ?? null,
      sessionCount: filtered.length,
      totalIsk,
      totalM3,
      totalDurationMs,
      avgIskPerHour,
      avgM3PerHour,
    },
    timeline,
    byCharacter: sortByIsk(
      characterId
        ? [...characterMap.values()].filter((row) => row.key === String(characterId))
        : [...characterMap.values()]
    ),
    bySpace: sortByIsk([...spaceMap.values()]),
    byCategory: sortByIsk([...categoryMap.values()]),
    byOre: sortByIsk([...oreMap.values()]),
    bySolarSystem,
    byRegion,
    byConstellation,
  }
}
