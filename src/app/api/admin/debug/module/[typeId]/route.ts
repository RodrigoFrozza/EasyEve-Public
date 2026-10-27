import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { typeId: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const typeId = parseInt(params.typeId)
    if (isNaN(typeId)) {
      return NextResponse.json({ error: 'Invalid TypeID' }, { status: 400 })
    }

    const moduleData = await prisma.moduleStats.findUnique({
      where: { typeId }
    })

    if (!moduleData) {
      return NextResponse.json({ error: 'Module not found in database' }, { status: 404 })
    }

    // Return the raw database state for validation
    return NextResponse.json({
      typeId: moduleData.typeId,
      name: moduleData.name,
      slotType: moduleData.slotType,
      chargeSize: moduleData.chargeSize,
      chargeGroups: [
        moduleData.chargeGroup1,
        moduleData.chargeGroup2,
        moduleData.chargeGroup3,
        moduleData.chargeGroup4,
        moduleData.chargeGroup5,
        moduleData.chargeGroup6,
        moduleData.chargeGroup7,
        moduleData.chargeGroup8,
        moduleData.chargeGroup9,
        moduleData.chargeGroup10,
      ].filter(Boolean),
      restrictions: moduleData.restrictions,
      effects: moduleData.effects,
      raw: moduleData
    })
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
