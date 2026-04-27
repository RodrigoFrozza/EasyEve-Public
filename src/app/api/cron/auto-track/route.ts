export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runAutoActivityDetection } from '@/lib/activities/auto-activity-detection'
import { logger } from '@/lib/server-logger'

export async function POST(request: Request) {
  const component = 'Cron:AutoTrack'

  try {
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!cronSecret || !expectedSecret) {
      logger.warn(component, 'Missing CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (cronSecret !== expectedSecret) {
      logger.warn(component, 'Invalid CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info(component, 'Starting auto-activity detection...')

    const result = await runAutoActivityDetection()

    const now = new Date().toISOString()

    await prisma.sdeCache.upsert({
      where: { key: 'last_auto_track' },
      update: { value: { timestamp: now, ...result } },
      create: { key: 'last_auto_track', value: { timestamp: now, ...result } }
    })

    logger.info(component, `Auto-track complete: ${result.started} started, ${result.ended} ended`)

    return NextResponse.json({
      success: true,
      ...result,
      lastSync: now
    })

  } catch (error) {
    logger.error(component, 'Unexpected error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  const component = 'Cron:AutoTrack'

  try {
    const lastSync = await prisma.sdeCache.findUnique({
      where: { key: 'last_auto_track' }
    })

    const syncData = lastSync?.value as { timestamp?: string; processed?: number; started?: number; ended?: number } | null

    return NextResponse.json({
      lastSync: syncData?.timestamp || null,
      processed: syncData?.processed || 0,
      started: syncData?.started || 0,
      ended: syncData?.ended || 0
    })

  } catch (error) {
    logger.error(component, 'Error fetching sync status', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}