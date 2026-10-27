export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { prisma } from '@/lib/prisma'
import { loadPiUserConfig } from '@/lib/pi/pi-config-store'
import { getRegionalMarketHistory } from '@/lib/pi/regional-market-history'
import { JITA_REGION_ID } from '@/lib/constants/market'

const MAX_TYPE_IDS = 50
const HISTORY_LOOKBACK_DAYS = 30

interface StructureHistoryPoint {
  date: string
  sellVolume: number
  buyVolume: number
  bestSell: number
  bestBuy: number
}

interface RegionHistoryPoint {
  date: string
  average: number
  volume: number
}

interface TypeHistoryEntry {
  source: 'structure' | 'region' | 'both' | 'none'
  structure?: { structureId: string; points: StructureHistoryPoint[] }
  region?: { regionId: number; points: RegionHistoryPoint[]; stale: boolean }
  note?: string
}

/**
 * Stock/volume history for the PI's critical inputs (shopping-list items),
 * so the player can judge how long a market can actually sustain their
 * purchase rate instead of reading a single instantaneous snapshot. Structure
 * series come from StationMarketSnapshot (only populated for the structure(s)
 * configured in PI settings, see snapshotMonitoredMarkets.ts); region series
 * come live (cached 12h) from ESI's public /markets/{region}/history/. The two
 * are never merged into one line — different scales, different meaning —
 * callers render them as separate series and let `source` say what's available.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  await assertPlatformModuleActive('pi')

  const { searchParams } = new URL(request.url)
  const typeIds = (searchParams.get('typeIds') ?? '')
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_TYPE_IDS)

  if (typeIds.length === 0) {
    return NextResponse.json({ history: {} })
  }

  const { preferences } = await loadPiUserConfig(user.id)
  const structureId = preferences.buyStructureId ?? preferences.buyStructureId2 ?? null
  const regionId = preferences.homeRegionId ?? JITA_REGION_ID

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_LOOKBACK_DAYS)
  cutoff.setUTCHours(0, 0, 0, 0)
  const cutoffMs = cutoff.getTime()

  const [structureRows, regionResults] = await Promise.all([
    structureId
      ? prisma.stationMarketSnapshot.findMany({
          where: { structureId, typeId: { in: typeIds }, day: { gte: cutoff } },
          orderBy: { day: 'asc' },
        })
      : Promise.resolve([]),
    Promise.all(typeIds.map((typeId) => getRegionalMarketHistory(regionId, typeId))),
  ])

  const structureByType = new Map<number, StructureHistoryPoint[]>()
  for (const row of structureRows) {
    const list = structureByType.get(row.typeId) ?? []
    list.push({
      date: row.day.toISOString().slice(0, 10),
      sellVolume: row.sellVolume,
      buyVolume: row.buyVolume,
      bestSell: row.bestSell,
      bestBuy: row.bestBuy,
    })
    structureByType.set(row.typeId, list)
  }

  const history: Record<number, TypeHistoryEntry> = {}
  typeIds.forEach((typeId, i) => {
    const structurePoints = structureByType.get(typeId)
    const regionResult = regionResults[i]
    const regionPoints = regionResult
      ? regionResult.points
          .filter((p) => new Date(p.date).getTime() >= cutoffMs)
          .map((p) => ({ date: p.date, average: p.average, volume: p.volume }))
      : undefined

    const hasStructure = !!structurePoints && structurePoints.length > 0
    const hasRegion = !!regionPoints && regionPoints.length > 0

    const entry: TypeHistoryEntry = {
      source: hasStructure && hasRegion ? 'both' : hasStructure ? 'structure' : hasRegion ? 'region' : 'none',
    }
    if (hasStructure) {
      entry.structure = { structureId: structureId as string, points: structurePoints as StructureHistoryPoint[] }
    }
    if (regionResult) {
      entry.region = { regionId, points: regionPoints ?? [], stale: regionResult.stale }
    }
    if (entry.source === 'none') {
      entry.note = structureId
        ? 'Sem histórico ainda para esta estrutura/região — o snapshot passa a acumular a partir de hoje.'
        : 'Nenhuma estrutura de compra configurada no PI, e sem histórico de região disponível — configure uma estrutura ou região em Configurações do PI.'
    }
    history[typeId] = entry
  })

  return NextResponse.json({ history })
})
