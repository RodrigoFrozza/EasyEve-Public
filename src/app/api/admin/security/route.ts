import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    
    // Security check: only Master role can access security logs
    if (!session || session.user.role !== 'master') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    const events = await prisma.securityEvent.findMany({
      take: limit,
      skip: skip,
      orderBy: {
        createdAt: 'desc'
      }
    })

    const total = await prisma.securityEvent.count()

    return NextResponse.json({
      events,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Admin Security API GET] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-security-key')
    const secretKey = process.env.INTERNAL_SECURITY_KEY
    
    // Auth check: only internal system or Master can log events
    // In search of balance between security and functionality, 
    // we allow POST if the secret key matches or if user is Master
    let isAuthorized = false
    
    if (secretKey && authHeader === secretKey) {
      isAuthorized = true
    } else {
      const session = await getSession()
      if (session?.user.role === 'master') {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { event, ipAddress, userAgent, path, userId, details } = await request.json()

    const newEvent = await prisma.securityEvent.create({
      data: {
        event,
        ipAddress,
        userAgent,
        path,
        userId,
        details: details || {}
      }
    })

    return NextResponse.json(newEvent)
  } catch (error) {
    console.error('[Admin Security API POST] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
