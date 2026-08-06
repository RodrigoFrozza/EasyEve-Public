import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'

const ReportSchema = z.object({
  reason: z.string().min(1).max(1000),
})

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    const body = await request.json()
    const { reason } = ReportSchema.parse(body)

    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const report = await prisma.notification.create({
      data: {
        userId: process.env.MASTER_USER_ID || 'admin',
        type: 'system',
        title: `Report against ${targetUser.name || userId}`,
        content: reason,
        link: `/admin/accounts?filter=${userId}`,
      },
    })

    return NextResponse.json({ success: true, reportId: report.id })
  } catch (error: any) {
    console.error('[API/players/report] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}