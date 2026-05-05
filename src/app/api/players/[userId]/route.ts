import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCharacterInfo, getCorporationInfo, getAllianceInfo } from '@/lib/esi'
import { getSession } from '@/lib/session'

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
        characters: {
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
          },
        },
        profile: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const profile = user.profile
    const isProfilePublic = profile?.isPublic ?? true
    if (!isProfilePublic) {
      return NextResponse.json({ error: 'Profile is private' }, { status: 403 })
    }

    // Privacy flags
    const showLocation = profile?.showLocation ?? true
    const showShip = profile?.showShip ?? true
    const showWallet = profile?.showWallet ?? true
    const showActivities = profile?.showActivities ?? true
    const showReputation = profile?.showReputation ?? true
    const showMedals = profile?.showMedals ?? true

    const mainCharacter = user.characters.find(c => c.isMain) || user.characters[0]
    
    let corporationInfo = null
    let allianceInfo = null
    
    if (mainCharacter?.corporationId) {
      try {
        corporationInfo = await getCorporationInfo(mainCharacter.corporationId)
        if (corporationInfo?.alliance_id) {
          try {
            allianceInfo = await getAllianceInfo(corporationInfo.alliance_id)
          } catch (e) {
            console.warn('[API/players] Failed to fetch alliance info:', e)
          }
        }
      } catch (e) {
        console.warn('[API/players] Failed to fetch corp info:', e)
      }
    }

    // Combine multiple queries in parallel for performance
    const [totalReputation, totalActivityHours, completedActivitiesCount, medals, friendCount, activeActivity] = await Promise.all([
      prisma.reputationHistory.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.activity.aggregate({
        where: { 
          userId,
          status: 'completed',
        },
        _sum: { 
          accumulatedPausedTime: true,
        },
      }),
      prisma.activity.count({
        where: { 
          userId,
          status: 'completed',
        },
      }),
      prisma.medalAward.findMany({
        where: { userId },
        include: { medal: true },
        orderBy: { awardedAt: 'desc' },
      }),
      prisma.userContact.count({
        where: { 
          userId,
          status: 'accepted',
        },
      }),
      prisma.activity.findFirst({
        where: { 
          userId,
          status: 'active',
        },
        orderBy: { startTime: 'desc' },
      }),
    ])

    const isOnline = user.lastLoginAt && 
      new Date(user.lastLoginAt).getTime() > Date.now() - 30 * 60 * 1000

    return NextResponse.json({
      id: user.id,
      accountCode: user.accountCode,
      createdAt: user.createdAt,
      lastLoginAt: showActivities ? user.lastLoginAt : null,
      isOnline: showActivities ? isOnline : false,
      mainCharacter: mainCharacter ? {
        id: mainCharacter.id,
        name: mainCharacter.name,
        totalSp: mainCharacter.totalSp,
        walletBalance: showWallet ? mainCharacter.walletBalance : null,
        location: showLocation ? mainCharacter.location : null,
        ship: showShip ? mainCharacter.ship : null,
        tags: mainCharacter.tags,
        corporation: corporationInfo ? {
          id: mainCharacter.corporationId,
          name: corporationInfo.name,
          ticker: corporationInfo.ticker,
        } : null,
        alliance: allianceInfo ? {
          id: corporationInfo?.alliance_id,
          name: allianceInfo.name,
        } : null,
      } : null,
      charactersCount: user.characters.length,
      friendCount,
      totalReputation: showReputation ? (totalReputation._sum.amount || 0) : null,
      totalActivityHours: showActivities ? Math.round((totalActivityHours._sum.accumulatedPausedTime || 0) / 3600000) : null,
      completedActivitiesCount: showActivities ? completedActivitiesCount : null,
      activeActivity: showActivities && activeActivity ? {
        type: activeActivity.type,
        startTime: activeActivity.startTime,
      } : null,
      medals: showMedals ? medals.map(m => ({
        id: m.medalId,
        name: m.medal.name,
        description: m.medal.description,
        icon: m.medal.icon,
        tier: m.medal.tier,
        count: m.count,
        awardedAt: m.awardedAt,
      })) : [],
      profileVisibility: user.profile || {
        isPublic: true,
        showKills: true,
        showDeaths: true,
        showReputation: true,
        showMedals: true,
        showActivities: true,
        showFits: true,
        showContacts: true,
      },
    })
  } catch (error: any) {
    console.error('[API/players] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}