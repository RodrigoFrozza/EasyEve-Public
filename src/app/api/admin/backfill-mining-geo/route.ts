import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { logger } from '@/lib/server-logger'
import { enrichMiningLogsWithGeo } from '@/lib/activities/mining-geo-enrichment'
import { requireMasterOrCronToken } from '@/lib/admin-cron-auth'

export const POST = withErrorHandling(async (request: Request) => {
    await requireMasterOrCronToken(request)
    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get('dryRun') !== 'false'
    const limitRaw = Number.parseInt(searchParams.get('limit') || '200', 10)
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200

    const activities = await prisma.activity.findMany({
      where: { type: 'mining', isDeleted: false },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    })

    let processed = 0
    let updated = 0
    let skipped = 0
    const details: Array<{ id: string; space?: string | null; derivedSpace?: string | null }> =
      []

    for (const activity of activities) {
      const data = (activity.data as Record<string, unknown>) || {}
      const logs = (data.logs as Array<Record<string, unknown>>) || []
      if (logs.length === 0) {
        skipped++
        continue
      }

      processed++
      const geo = await enrichMiningLogsWithGeo(logs)

      const nextData = {
        ...data,
        logs: geo.logs,
        systemBreakdown: geo.systemBreakdown,
        regionBreakdown: geo.regionBreakdown,
        dominantSystemId: geo.dominantSystemId,
        dominantRegionId: geo.dominantRegionId,
        geoBackfilledAt: new Date().toISOString(),
      }

      const shouldSetSpace =
        geo.derivedSpace &&
        (!activity.space || activity.space === 'Unknown' || activity.space.trim() === '')

      details.push({
        id: activity.id,
        space: activity.space,
        derivedSpace: shouldSetSpace ? geo.derivedSpace : null,
      })

      if (!dryRun) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            data: nextData,
            ...(shouldSetSpace ? { space: geo.derivedSpace } : {}),
          },
        })
        updated++
      }
    }

    logger.info('ADMIN', 'Mining geo backfill complete', {
      dryRun,
      processed,
      updated,
      skipped,
    })

    return NextResponse.json({
      success: true,
      dryRun,
      processed,
      updated: dryRun ? 0 : updated,
      skipped,
      details: details.slice(0, 50),
    })
})
