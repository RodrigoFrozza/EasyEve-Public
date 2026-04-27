import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    const medals = await prisma.medalAward.findMany({
      where: { userId },
      include: { medal: true },
      orderBy: { awardedAt: 'desc' },
    })

    const availableMedals = await prisma.easyEveMedal.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    })

    const userMedalIds = new Set(medals.map(m => m.medalId))
    const unearnedMedals = availableMedals.filter(m => !userMedalIds.has(m.id))

    return NextResponse.json({
      awardedMedals: medals,
      availableMedals: unearnedMedals,
    })
  } catch (error: any) {
    console.error('[API/admin/medals/user] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const { medalId, period } = body

    const medal = await prisma.easyEveMedal.findUnique({
      where: { id: medalId },
    })

    if (!medal) {
      return NextResponse.json({ error: 'Medal not found' }, { status: 404 })
    }

    const existingAward = await prisma.medalAward.findFirst({
      where: {
        medalId,
        userId,
        period: period || null,
      },
    })

    if (existingAward) {
      if (medal.type !== 'instant') {
        await prisma.medalAward.update({
          where: { id: existingAward.id },
          data: { count: { increment: 1 } },
        })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Medal count increased',
        award: existingAward,
      })
    }

    const award = await prisma.medalAward.create({
      data: {
        medalId,
        userId,
        period: period || null,
        count: 1,
      },
    })

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'medal',
          title: 'New Medal Earned!',
          content: `You earned the ${medal.name} medal!`,
          link: `/players/${userId}`,
        },
      })
    }

    return NextResponse.json({ success: true, award })
  } catch (error: any) {
    console.error('[API/admin/medals/user] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (session?.user?.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const awardId = searchParams.get('awardId')

    if (!awardId) {
      return NextResponse.json({ error: 'awardId required' }, { status: 400 })
    }

    await prisma.medalAward.delete({
      where: { id: awardId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/admin/medals/user] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}