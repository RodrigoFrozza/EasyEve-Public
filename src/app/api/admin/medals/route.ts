import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { EASY_EVE_MEDALS } from '@/lib/constants/medals'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const medals = await prisma.easyEveMedal.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ medals })
  } catch (error: any) {
    console.error('[API/admin/medals] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'seed') {
      const createdMedals = []

      for (const medal of EASY_EVE_MEDALS) {
        const existing = await prisma.easyEveMedal.findUnique({
          where: { id: medal.id },
        })

        if (!existing) {
          const created = await prisma.easyEveMedal.create({
            data: {
              id: medal.id,
              name: medal.name,
              description: medal.description,
              icon: medal.icon,
              criteria: JSON.stringify(medal.criteria),
              tier: medal.tier,
              type: medal.type,
              isActive: true,
            },
          })
          createdMedals.push(created)
        }
      }

      return NextResponse.json({
        success: true,
        message: `Created ${createdMedals.length} medals`,
        medals: createdMedals,
      })
    }

    if (action === 'create') {
      const { name, description, icon, criteria, tier, type } = body

      const medal = await prisma.easyEveMedal.create({
        data: {
          name,
          description,
          icon,
          criteria: JSON.stringify(criteria),
          tier: tier || 'bronze',
          type: type || 'instant',
          isActive: true,
        },
      })

      return NextResponse.json({ success: true, medal })
    }

    if (action === 'toggle') {
      const { medalId, isActive } = body

      const medal = await prisma.easyEveMedal.update({
        where: { id: medalId },
        data: { isActive },
      })

      return NextResponse.json({ success: true, medal })
    }

    if (action === 'update') {
      const { medalId, ...data } = body

      const updateData: any = {}
      if (data.name) updateData.name = data.name
      if (data.description) updateData.description = data.description
      if (data.icon) updateData.icon = data.icon
      if (data.criteria) updateData.criteria = JSON.stringify(data.criteria)
      if (data.tier) updateData.tier = data.tier
      if (data.type) updateData.type = data.type

      const medal = await prisma.easyEveMedal.update({
        where: { id: medalId },
        data: updateData,
      })

      return NextResponse.json({ success: true, medal })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[API/admin/medals] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const medalId = searchParams.get('id')

    if (!medalId) {
      return NextResponse.json({ error: 'Medal ID required' }, { status: 400 })
    }

    // Check if medal has any awards
    const awards = await prisma.medalAward.count({
      where: { medalId },
    })

    if (awards > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete medal with existing awards. Deactivate it instead.' }, { status: 400 })
    }

    await prisma.easyEveMedal.delete({
      where: { id: medalId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/admin/medals] Delete Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}