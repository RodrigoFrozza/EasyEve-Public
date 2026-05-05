import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyJWT } from '@/lib/auth-jwt'
import { isTokenExpired } from '@/lib/token-manager'

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value

  if (!sessionToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyJWT(sessionToken)
  if (!payload || !payload.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin (Master)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true }
  })

  if (user?.role !== 'master') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Find the character connected via the Holding app
    const holdingChar = await prisma.character.findFirst({
      where: { esiApp: 'holding' },
      select: {
        id: true,
        name: true,
        tokenExpiresAt: true,
        lastFetchedAt: true,
      }
    })

    if (!holdingChar) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      characterName: holdingChar.name,
      characterId: holdingChar.id,
      isExpired: isTokenExpired(holdingChar.tokenExpiresAt),
      tokenExpiresAt: holdingChar.tokenExpiresAt,
    })
  } catch (error) {
    console.error('[Holding Status API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
