import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        iskBalance: true,
        subscriptionEnd: true
      }
    })

    const lastSync = await prisma.sdeCache.findUnique({
      where: { key: 'last_wallet_sync' }
    })

    return NextResponse.json({
      iskBalance: userData?.iskBalance || 0,
      subscriptionEnd: userData?.subscriptionEnd,
      lastSync: (lastSync?.value as any)?.timestamp || null
    })
  } catch (error: any) {
    console.error('[ISK Balance] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}