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
    const pageSize = 10

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const showFits = user.profile?.showFits ?? true
    if (!showFits) {
      return NextResponse.json({ error: 'Fits are hidden' }, { status: 403 })
    }

    const total = await prisma.fit.count({
      where: { 
        userId,
        visibility: 'PUBLIC',
      },
    })

    const fits = await prisma.fit.findMany({
      where: { 
        userId,
        visibility: 'PUBLIC',
      },
      select: {
        id: true,
        name: true,
        ship: true,
        shipTypeId: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return NextResponse.json({
      fits,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error: any) {
    console.error('[API/players/fits] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}