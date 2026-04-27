import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const CHARGE_GROUP_NAMES: Record<number, string> = {
  83: 'Projectile Ammo',
  85: 'Hybrid Charges',
  86: 'Frequency Crystals',
  87: 'Capacitor Booster',
  88: 'Defender Missiles',
  89: 'Torpedoes',
  90: 'Bombs',
  374: 'Advanced Beam Crystal',
  375: 'Advanced Pulse Crystal',
  372: 'Advanced Autocannon',
  373: 'Advanced Railgun',
  376: 'Advanced Artillery',
  377: 'Advanced Blaster',
  384: 'Light Missiles',
  385: 'Heavy Missiles',
  386: 'Cruise Missiles',
  387: 'Rockets',
  394: 'Auto-Targeting Light',
  395: 'Auto-Targeting Heavy',
  396: 'Auto-Targeting Cruise',
  476: 'XL Torpedoes',
  653: 'Advanced Light Missiles',
  654: 'Advanced Heavy Assault',
  655: 'Advanced Heavy Missiles',
  656: 'Advanced Cruise',
  657: 'Advanced Torpedoes',
  663: 'Mining Crystals',
  907: 'Tracking Scripts',
  908: 'Warp Disruption Scripts',
  909: 'Tracking Disruption Scripts',
  910: 'Sensor Booster Scripts',
  911: 'Sensor Damp Scripts',
  1400: 'Missile Guidance Scripts',
  1546: 'Structure Anti-Capital Missile',
  1547: 'Structure Anti-Subcapital Missile',
  1549: 'Structure ECM Scripts',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleTypeId = searchParams.get('moduleTypeId')

    if (!moduleTypeId) {
      return NextResponse.json({
        success: false,
        error: 'moduleTypeId is required',
      }, { status: 400 })
    }

    const typeId = parseInt(moduleTypeId)
    if (isNaN(typeId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid moduleTypeId',
      }, { status: 400 })
    }

    const moduleData = await prisma.moduleStats.findUnique({
      where: { typeId },
    })

    if (!moduleData) {
      return NextResponse.json({
        success: false,
        error: 'Module not found',
      }, { status: 404 })
    }

    if (!moduleData.chargeGroup1) {
      return NextResponse.json({
        success: false,
        error: 'Module does not use charges',
      }, { status: 400 })
    }

    const chargeGroups = [
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
    ].filter(Boolean) as number[]

    const charges = await prisma.chargeStats.findMany({
      where: {
        groupId: { in: chargeGroups },
        ...(moduleData.chargeSize ? { chargeSize: moduleData.chargeSize } : {}),
      },
      orderBy: [
        { groupId: 'asc' },
        { metaLevel: 'asc' },
        { name: 'asc' },
      ],
    })

    const groupedCharges: Record<string, typeof charges> = {}
    for (const charge of charges) {
      const groupName = CHARGE_GROUP_NAMES[charge.groupId || 0] || `Group ${charge.groupId}`
      if (!groupedCharges[groupName]) {
        groupedCharges[groupName] = []
      }
      groupedCharges[groupName].push(charge)
    }

    return NextResponse.json({
      success: true,
      moduleName: moduleData.name,
      chargeSize: moduleData.chargeSize,
      chargeGroups,
      groupedCharges,
      charges: charges.map(c => ({
        id: c.typeId,
        name: c.name,
        groupId: c.groupId,
        groupName: CHARGE_GROUP_NAMES[c.groupId || 0] || `Group ${c.groupId}`,
        chargeSize: c.chargeSize,
        damage: {
          em: c.emDamage,
          therm: c.thermDamage,
          kin: c.kinDamage,
          exp: c.expDamage,
        },
      })),
    })
  } catch (error) {
    console.error('[CHARGES-COMPATIBLE] Error:', error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}
