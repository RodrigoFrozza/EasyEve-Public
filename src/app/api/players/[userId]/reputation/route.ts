import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = 20

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const showReputation = user.profile?.showReputation ?? true
    if (!showReputation) {
      return NextResponse.json({ error: 'Reputation is hidden' }, { status: 403 })
    }

    const totalReputation = await prisma.reputationHistory.aggregate({
      where: { userId },
      _sum: { amount: true },
    })

    const total = await prisma.reputationHistory.count({
      where: { userId },
    })

    const history = await prisma.reputationHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json({
      totalReputation: totalReputation._sum.amount || 0,
      history,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error: any) {
    console.error('[API/players/reputation] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}