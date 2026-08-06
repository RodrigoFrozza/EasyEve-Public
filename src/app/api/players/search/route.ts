import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCorporationInfo } from '@/lib/esi'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    if (query.length < 2) {
      return NextResponse.json({ users: [] })
    }

    const users = await prisma.user.findMany({
      where: {
        characters: {
          some: {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        isTester: true,
        lastLoginAt: true,
        characters: {
          where: { isMain: true },
          take: 1,
        },
        profile: true,
      },
      take: 10,
    })

    const usersWithCorp = await Promise.all(
      users.map(async (user) => {
        const mainChar = user.characters[0]
        let corporation = null

        if (mainChar?.corporationId) {
          try {
            const corpInfo = await getCorporationInfo(mainChar.corporationId)
            corporation = corpInfo.name
          } catch {}
        }

        const isOnline = user.lastLoginAt && 
          new Date(user.lastLoginAt).getTime() > Date.now() - 30 * 60 * 1000

        const isPublic = user.profile?.isPublic ?? true

        return {
          id: user.id,
          name: user.name,
          mainCharacterId: mainChar?.id || 0,
          mainCharacterName: mainChar?.name || 'Unknown',
          corporation,
          isOnline,
          isPublic,
          isTester: user.isTester,
        }
      })
    )

    return NextResponse.json({ users: usersWithCorp })
  } catch (error: any) {
    console.error('[API/players/search] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}