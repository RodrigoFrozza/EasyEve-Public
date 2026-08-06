import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { batch, url: commonUrl, userAgent: commonUserAgent } = body

    // Support both single logs and batches
    const logs = batch ? batch : [body]
    
    // Filter out everything that is not an error
    const errorsOnly = logs.filter((log: any) => log.level === 'error')

    if (errorsOnly.length === 0) {
      return NextResponse.json({ success: true, message: 'Filtered by policy' })
    }

    // Prepare data for Prisma
    const logEntries = errorsOnly.map((log: any) => ({
      userId: session.user.id,
      characterId: log.characterId || session.user.characterId,
      level: log.level,
      message: log.message,
      stack: log.stack,
      url: log.url || commonUrl,
      userAgent: log.userAgent || commonUserAgent,
      context: log.context || {}
    }))

    // Save logs in bulk
    await prisma.debugLog.createMany({
      data: logEntries
    })

    // Restriction: 7-day retention (cleanup)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    // Cleanup old logs
    await prisma.debugLog.deleteMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo
        }
      }
    })

    return NextResponse.json({ success: true, count: logEntries.length })
  } catch (error) {
    console.error('[API/LOGS] Failed to save logs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
