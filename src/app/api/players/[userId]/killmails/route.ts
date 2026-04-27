import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCharacterKillmails, getKillmailDetail } from '@/lib/esi/player'
import { getSession } from '@/lib/session'

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
      include: { 
        profile: true,
        characters: {
          select: { id: true }
        }
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const showKills = user.profile?.showKills ?? true
    const showDeaths = user.profile?.showDeaths ?? true
    if (!showKills && !showDeaths) {
      return NextResponse.json({ error: 'Killmails are hidden' }, { status: 403 })
    }

    const mainCharacter = await prisma.character.findFirst({
      where: { userId, isMain: true },
    })

    if (!mainCharacter) {
      return NextResponse.json({ killmails: [], total: 0, page, pageSize })
    }

    const accessToken = mainCharacter.accessToken
    if (!accessToken) {
      return NextResponse.json({ killmails: [], total: 0, page, pageSize })
    }

    const allKillmails = await getCharacterKillmails(mainCharacter.id, accessToken, 100)
    
    const userCharacterIds = user.characters.map((c: any) => c.id)
    
    const enrichedKillmails = await Promise.all(
      allKillmails.map(async (km) => {
        const detail = await getKillmailDetail(km.killmail_id, km.killmail_hash)
        if (!detail) return null

        const victimId = detail.victim?.character_id
        const isVictim = victimId && userCharacterIds.includes(victimId)
        
        const isAttacker = detail.attackers.some(
          (a) => a.character_id && userCharacterIds.includes(a.character_id)
        )

        if (!showKills && isAttacker) return null
        if (!showDeaths && isVictim) return null

        return {
          id: km.killmail_id,
          hash: km.killmail_hash,
          date: km.date,
          isKill: isAttacker && !isVictim,
          isDeath: isVictim,
          solarSystemId: detail.solar_system_id,
          victim: detail.victim ? {
            characterId: detail.victim.character_id,
            corporationId: detail.victim.corporation_id,
            allianceId: detail.victim.alliance_id,
            shipTypeId: detail.victim.ship_type_id,
          } : null,
          attackers: detail.attackers.map(a => ({
            characterId: a.character_id,
            corporationId: a.corporation_id,
            allianceId: a.alliance_id,
            shipTypeId: a.ship_type_id,
            weaponTypeId: a.weapon_type_id,
            finalBlow: a.final_blow,
            damageDone: a.damage_done,
          })),
          totalValue: detail.total_value,
        }
      })
    )

    const filteredKillmails = enrichedKillmails.filter(Boolean)
    const total = filteredKillmails.length
    const start = (page - 1) * pageSize
    const paginated = filteredKillmails.slice(start, start + pageSize)

    return NextResponse.json({
      killmails: paginated,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error: any) {
    console.error('[API/players/killmails] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}