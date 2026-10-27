import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getSession()
    
    // Security check: Only administrators (master role)
    if (!session?.user?.id || session.user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = params

    const logs = await prisma.debugLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100 // Get latest 100 logs
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('[API/ADMIN/LOGS] Failed to fetch logs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
