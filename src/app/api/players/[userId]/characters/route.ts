import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCorporationInfo, getAllianceInfo } from '@/lib/esi'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!(user.profile?.isPublic ?? true)) {
      return NextResponse.json({ error: 'Profile is private' }, { status: 403 })
    }

    const characters = await prisma.character.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        isMain: true,
        corporationId: true,
        totalSp: true,
        walletBalance: true,
        location: true,
        ship: true,
        tags: true,
        createdAt: true,
      },
      orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
    })

    const uniqueCorpIds = [
      ...new Set(
        characters
          .map((c) => c.corporationId)
          .filter((id): id is number => typeof id === 'number' && id > 0)
      ),
    ]

    const corpById = new Map<
      number,
      { name: string; ticker?: string; alliance_id?: number }
    >()

    await Promise.all(
      uniqueCorpIds.map(async (corpId) => {
        try {
          const corpInfo = await getCorporationInfo(corpId)
          corpById.set(corpId, corpInfo)
        } catch {
          corpById.set(corpId, { name: `Corp ${corpId}` })
        }
      })
    )

    const uniqueAllianceIds = [
      ...new Set(
        [...corpById.values()]
          .map((c) => c.alliance_id)
          .filter((id): id is number => typeof id === 'number' && id > 0)
      ),
    ]

    const allianceById = new Map<number, { name: string; ticker?: string }>()

    await Promise.all(
      uniqueAllianceIds.map(async (allianceId) => {
        try {
          const alliInfo = await getAllianceInfo(allianceId)
          allianceById.set(allianceId, alliInfo)
        } catch {
          allianceById.set(allianceId, { name: `Alliance ${allianceId}` })
        }
      })
    )

    const charactersWithCorp = characters.map((char) => {
      let corporation = null
      let alliance = null

      if (char.corporationId) {
        const corpInfo = corpById.get(char.corporationId)
        if (corpInfo) {
          corporation = {
            id: char.corporationId,
            name: corpInfo.name,
            ticker: corpInfo.ticker,
          }
          const allianceId = corpInfo.alliance_id
          if (allianceId) {
            const alliInfo = allianceById.get(allianceId)
            if (alliInfo) {
              alliance = {
                id: allianceId,
                name: alliInfo.name,
              }
            }
          }
        }
      }

      return {
        ...char,
        corporation,
        alliance,
      }
    })

    return NextResponse.json({
      characters: charactersWithCorp,
      total: characters.length,
    })
  } catch (error: unknown) {
    console.error('[API/players/characters] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
