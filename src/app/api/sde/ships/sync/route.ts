import { NextResponse } from 'next/server'
import { syncShipDogmaData, SyncResult } from '@/lib/sde/ship-dogma-sync'
import { getCurrentUser } from '@/lib/api-helpers'
import { logger } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'master') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const shipTypeIds: number[] = body.shipTypeIds || []
    const maxShips =
      typeof body.maxShips === 'number' && Number.isFinite(body.maxShips) && body.maxShips > 0
        ? Math.floor(body.maxShips)
        : undefined
    const requireCompleteScope =
      typeof body.requireCompleteScope === 'boolean' ? body.requireCompleteScope : undefined

    logger.info('ShipSync', 'Starting ship dogma sync', { 
      userId: user.id,
      shipCount: shipTypeIds.length,
      maxShips,
      requireCompleteScope
    })

    const result = await syncShipDogmaData(
      shipTypeIds.length > 0 ? shipTypeIds : undefined,
      (progress) => {
        logger.debug('ShipSync', `Progress: ${progress.current}/${progress.total} - ${progress.ship}`)
      },
      {
        ...(maxShips ? { maxShips } : {}),
        ...(requireCompleteScope !== undefined ? { requireCompleteScope } : {})
      }
    )

    logger.info('ShipSync', 'Ship dogma sync completed', { result })

    return NextResponse.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced ${result.shipsProcessed} ships with ${result.attributesProcessed} attributes`
        : 'Sync completed with errors',
      data: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('ShipSync', 'Critical sync error', { error, userId: (await getCurrentUser())?.id })
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Ship Dogma Sync API',
    description: 'POST to sync ship dogma attributes from ESI',
    usage: {
      method: 'POST',
      body: {
        shipTypeIds: '[optional] Array of type IDs to sync, or omit/empty to sync every published ship (SDE category 6)',
        maxShips: '[optional] When syncing all ships, process at most this many rows (staging / partial runs)',
        requireCompleteScope:
          '[optional] When true, skip rows missing required mapped fields (default: true for bulk all, false for explicit shipTypeIds)'
      },
      response: {
        success: 'boolean',
        shipsProcessed: 'number',
        attributesProcessed: 'number',
        errors: 'string[]',
        lastSync: 'ISO date string',
        candidateHulls:
          'bulk only: EveType rows selected (published + ship category) before ESI; 0 means run npm run import:sde',
        contractVersion: 'number'
      }
    },
    examples: [
      {
        description: 'Sync all ships',
        curl: 'curl -X POST https://api.easyeve.cloud/api/sde/ships/sync'
      },
      {
        description: 'Sync specific ships',
        curl: 'curl -X POST https://api.easyeve.cloud/api/sde/ships/sync -H "Content-Type: application/json" -d \'{"shipTypeIds": [24688, 587, 22460]}\''
      }
    ]
  })
}
