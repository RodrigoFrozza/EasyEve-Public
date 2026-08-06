import { prisma } from '@/lib/prisma'
import type { StationOrderAggregate } from '@/lib/industry/deficit-scan'

/**
 * Persist one row per type for a monitored private structure's order book, for
 * today (UTC). Why this exists: ESI has no public history endpoint for structure
 * markets (unlike NPC regions, which get /markets/{region_id}/history/) — the
 * deficit scanner already walks the full order book on every scan, so this is our
 * only chance to capture price/volume history for these markets. Snapshot
 * granularity is one row per structure+type+day (last write wins within a day),
 * feeding future liquidity ranking (e.g. "is this deficit persistent or a blip").
 *
 * Batches writes in chunks (a structure can list a few thousand types) so a single
 * transaction doesn't hold thousands of statements. Throws on failure — the
 * regra de ouro is no silent data loss; callers decide whether to swallow/log it
 * (the scanner fires this off best-effort and logs a warning on rejection).
 */
const CHUNK_SIZE = 100

export async function persistStationSnapshots(
  structureId: string,
  aggregates: Map<number, StationOrderAggregate>
): Promise<number> {
  if (aggregates.size === 0) return 0

  const day = new Date()
  day.setUTCHours(0, 0, 0, 0)

  const rows = [...aggregates.values()]
  let written = 0

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    await prisma.$transaction(
      chunk.map((agg) =>
        prisma.stationMarketSnapshot.upsert({
          where: {
            structureId_typeId_day: { structureId, typeId: agg.typeId, day },
          },
          create: {
            structureId,
            typeId: agg.typeId,
            day,
            sellVolume: agg.sellVolume,
            buyVolume: agg.buyVolume,
            bestSell: agg.bestSell,
            bestBuy: agg.bestBuy,
          },
          update: {
            sellVolume: agg.sellVolume,
            buyVolume: agg.buyVolume,
            bestSell: agg.bestSell,
            bestBuy: agg.bestBuy,
            capturedAt: new Date(),
          },
        })
      )
    )
    written += chunk.length
  }

  return written
}
