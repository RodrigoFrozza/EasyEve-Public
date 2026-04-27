import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const showMedals = user.profile?.showMedals ?? true
    if (!showMedals) {
      return NextResponse.json({ error: 'Medals are hidden' }, { status: 403 })
    }

    const medals = await prisma.medalAward.findMany({
      where: { userId },
      include: { medal: true },
      orderBy: { awardedAt: 'desc' },
    })

    const groupedMedals = medals.reduce((acc, award) => {
      const key = award.medalId
      if (!acc[key]) {
        acc[key] = {
          id: award.medalId,
          name: award.medal.name,
          description: award.medal.description,
          icon: award.medal.icon,
          tier: award.medal.tier,
          type: award.medal.type,
          count: 0,
          lastAwardedAt: null,
        }
      }
      acc[key].count += award.count
      if (!acc[key].lastAwardedAt || new Date(award.awardedAt) > new Date(acc[key].lastAwardedAt)) {
        acc[key].lastAwardedAt = award.awardedAt.toISOString()
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      medals: Object.values(groupedMedals),
      total: Object.keys(groupedMedals).length,
    })
  } catch (error: any) {
    console.error('[API/players/medals] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}