import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/ships/:typeId/stats
 * Retorna stats completos de uma ship
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const { typeId } = await params
    const shipId = parseInt(typeId)
    
    if (!shipId || isNaN(shipId)) {
      return NextResponse.json({ error: 'Invalid typeId' }, { status: 400 })
    }
    
    // Try to get from database first
    const shipStats = await prisma.shipStats.findUnique({
      where: { typeId: shipId }
    })
    
    if (shipStats) {
      return NextResponse.json(shipStats)
    }
    
    // Fallback: try to get from EveType and calculate
    const eveType = await prisma.eveType.findUnique({
      where: { id: shipId },
      include: { group: true }
    })
    
    if (!eveType) {
      return NextResponse.json({ error: 'Ship not found' }, { status: 404 })
    }
    
    // Return basic info with defaults
    return NextResponse.json({
      typeId: shipId,
      name: eveType.name,
      highSlots: 5,
      medSlots: 5,
      lowSlots: 5,
      rigSlots: 3,
      cpu: 400,
      powerGrid: 400,
      capacitor: 300,
      shieldCapacity: 1000,
      armorHP: 2000,
      hullHP: 1000,
      maxVelocity: 150,
      agility: 3,
      warpSpeed: 3,
      droneBay: 50,
      cargo: 300
    })
    
  } catch (error) {
    console.error('GET /api/ships/:id/stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch ship stats' }, { status: 500 })
  }
}