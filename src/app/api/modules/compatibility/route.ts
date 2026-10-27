import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import DogmaCalculator, { checkModuleCompatibility } from '@/lib/dogma-calculator'
import { inferRuleIdFromMessage } from '@/lib/fits/rule-rejection'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const shipTypeId = searchParams.get('shipTypeId')

    const shipTypeIdNum = shipTypeId ? parseInt(shipTypeId) : null

    if (!shipTypeIdNum || isNaN(shipTypeIdNum)) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'shipTypeId is required', 400)
    }

    // 1. Get Authoritative Ship Stats
    const ship = await DogmaCalculator.getShipStats(shipTypeIdNum)
    if (!ship) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Ship not found', 404)
    }

    // 2. Fetch all modules with their dogmaAttributes from the DB
    // We use getModuleStats in a loop but that's slow. 
    // Instead, we'll fetch all modules and use a simplified version of checkModuleCompatibility
    // or just use DogmaCalculator.getModuleStats which has a cache.
    
    const allModules = await prisma.moduleStats.findMany({
      where: { slotType: { not: null } },
      select: { typeId: true }
    })

    const compatibilityMap: Record<
      number,
      {
        isCompatible: boolean
        reason?: string
        ruleId?: string
        definitive: false
      }
    > = {}

    // We'll process them in chunks or just use the cache
    for (const modRef of allModules) {
      const modStats = await DogmaCalculator.getModuleStats(modRef.typeId)
      if (!modStats) continue

      // Mock FitStats for validation
      const mockStats: any = {
        validation: {
          canFit: true,
          errors: [],
          slotErrors: {}
        }
      }

      // Authoritative Check
      checkModuleCompatibility(modStats, ship, mockStats)

      compatibilityMap[modRef.typeId] = {
        isCompatible: mockStats.validation.canFit,
        reason: mockStats.validation.errors[0] || undefined,
        ruleId: mockStats.validation.errors[0]
          ? inferRuleIdFromMessage(mockStats.validation.errors[0])
          : undefined,
        definitive: false,
      }
    }

    return NextResponse.json({
      success: true,
      decisionMode: 'hint-only',
      note: 'This endpoint is a pre-check hint and does not run full slot/cap/cost validation.',
      compatibility: compatibilityMap,
      shipGroupId: ship.groupId
    })
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: error.statusCode }
      )
    }

    console.error('GET /api/modules/compatibility error:', error)
    return NextResponse.json(
      { 
        success: false, 
        code: ErrorCodes.API_SERVER_ERROR, 
        error: error instanceof Error ? error.message : 'Failed to fetch compatibility' 
      }, 
      { status: 500 }
    )
  }
}
