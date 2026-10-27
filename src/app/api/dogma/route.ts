import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'
import { syncModuleStats } from '@/lib/sde/module-stats-esi-sync'
import { syncShipDogmaData } from '@/lib/sde/ship-dogma-sync'
import { logger } from '@/lib/server-logger'
import { esiClient } from '@/lib/esi-client'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')
  const typeId = searchParams.get('typeId')
  const sync = searchParams.get('sync') === 'true'
  
  if (sync) {
    const user = await getCurrentUser()
    if (!user || user.role !== 'master') {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'Admin access required for sync operations', 403)
    }
  }
  
  try {
    if (sync) {
      if (typeId) {
        const id = parseInt(typeId)
        try {
          let result = null
          let activeType = type

          // Auto-detect type if not provided
          if (!activeType) {
            try {
              const typeRes = await esiClient.get(`/universe/types/${id}/`)
              const typeData = typeRes.data
              const catId = typeData.category_id
              if (catId === 6) activeType = 'ships'
              else activeType = 'modules'
            } catch {
              // Ignore failure, activeType remains undefined
            }
          }

          if (activeType === 'ships') result = await syncShipStats(id)
          else if (activeType === 'modules') result = await syncModuleStats(id)
          
          if (!result) {
             return NextResponse.json({ 
               success: false, 
               message: `Sync returned no data for ${id}. Check server logs for [DogmaSync] errors.`,
               data: null 
             }, { status: 500 })
          }
          
          return NextResponse.json({ success: true, message: `Synced specific item ${id}`, data: result })
        } catch (syncError) {
          return NextResponse.json({ 
            success: false, 
            message: `Sync failed for ${id}`, 
            error: syncError instanceof Error ? syncError.message : 'Unknown error' 
          }, { status: 500 })
        }
      }

      if (type === 'ships' || type === 'all') {
        await syncShipStats()
      }
      if (type === 'modules' || type === 'all') {
        await syncModuleStats()
      }
      if (type === 'prices' || type === 'all') {
        await syncModulePrices()
      }
      return NextResponse.json({ success: true, message: 'Sync completed' })
    }
    
    if (typeId) {
      const id = parseInt(typeId)
      let activeType = type
      
      if (!activeType) {
        try {
          const typeRes = await esiClient.get(`/universe/types/${id}/`)
          const typeData = typeRes.data
          activeType = typeData.category_id === 6 ? 'ships' : 'modules'
        } catch {
          // Ignore failure
        }
      }

      if (activeType === 'ships') {
        const shipStats = await prisma.shipStats.findUnique({ where: { typeId: id } })
        return NextResponse.json(shipStats)
      }
      if (activeType === 'modules') {
        const moduleStats = await prisma.moduleStats.findUnique({ where: { typeId: id } })
        return NextResponse.json(moduleStats)
      }
    }
    
    return NextResponse.json({ 
      message: 'Use /api/dogma?sync=true&type=all to sync',
      shipsCount: await prisma.shipStats.count(),
      modulesCount: await prisma.moduleStats.count()
    })
  } catch (error) {
    logger.error('DogmaAPI', 'Unhandled API error', { error })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

/**
 * Ship hull sync: delegates to `syncShipDogmaData` (same pipeline as `POST /api/sde/ships/sync`).
 * Avoid duplicating dogma mapping here — see `docs/SDE_DOGMA_SYNC_ENTRYPOINTS.md`.
 */
async function syncShipStats(targetTypeId?: number) {
  if (targetTypeId) {
    logger.info('DogmaSync', `Syncing specific ship TypeID: ${targetTypeId}`, { typeId: targetTypeId })
    const syncResult = await syncShipDogmaData([targetTypeId], undefined, {
      requireCompleteScope: false,
    })
    const row = await prisma.shipStats.findUnique({ where: { typeId: targetTypeId } })
    if (!row) {
      if (syncResult.shipsProcessed === 0 && syncResult.errors.length === 0) {
        logger.warn('DogmaSync', `Type ${targetTypeId} not found in ESI or not a ship`, { typeId: targetTypeId })
        return null
      }
      throw new Error(`Ship sync failed for type ${targetTypeId}`)
    }
    return row
  }

  logger.info('DogmaSync', 'Starting bulk ship sync via syncShipDogmaData')
  const result = await syncShipDogmaData(undefined, (p) => {
    if (p.total > 0 && p.current % 50 === 0) {
      logger.debug('DogmaSync', `Ship sync progress: ${p.current}/${p.total} – ${p.ship}`)
    }
  })
  if (result.errors.length > 0) {
    logger.warn('DogmaSync', `Ship bulk finished with ${result.errors.length} error lines`)
  }
  return result
}

async function syncModulePrices() {
  logger.info('DogmaSync', 'Starting module prices sync from ESI')
  
  try {
    const res = await esiClient.get(`/markets/prices/`)
    const prices = res.data as Array<{ type_id: number; average_price?: number; adjusted_price?: number }>
    
    let updated = 0
    for (const price of prices) {
      const sellPrice = price.average_price || price.adjusted_price
      if (!sellPrice) continue
      
      try {
        await prisma.moduleStats.update({
          where: { typeId: price.type_id },
          data: { price: sellPrice }
        })
        updated++
      } catch {
        // Type not in moduleStats table
      }
    }
    
    logger.info('DogmaSync', `Module prices sync complete: ${updated} prices updated`)
  } catch (e: unknown) {
    logger.error('DogmaSync', 'Failed to sync module prices', { error: e })
  }
}