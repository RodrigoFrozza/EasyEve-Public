import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCharacterInfo, getCorporationInfo, getAllianceInfo } from '@/lib/esi'
import { getSession } from '@/lib/session'
import { PlayerProfileClient } from './player-profile-client'
import { PrivateProfileClient } from './private-profile-client'
import { aggregateActivityData } from '@/lib/leaderboard'
import { FitParser } from '@/lib/fits/fit-parser'

interface PageProps {
  params: Promise<{ userId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      characters: { where: { isMain: true }, take: 1 },
      profile: true,
    },
  })

  if (!user) {
    return { title: 'Profile Not Found | EasyEve' }
  }

  const isPublic = user.profile?.isPublic ?? true
  if (!isPublic) {
    return { title: 'Private Profile | EasyEve' }
  }

  const mainChar = user.characters[0]
  return {
    title: `${mainChar?.name || 'Player'} | EasyEve Profile`,
    description: `View ${mainChar?.name || 'player'} profile on EasyEve`,
  }
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { userId } = await params
  const session = await getSession()
  const currentUserId = session?.user?.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      characters: true,
      profile: true,
    },
  })

  if (!user) {
    notFound()
  }

  const isProfilePublic = user.profile?.isPublic ?? true

  // Fetch character ESI info (corp/alliance) for main character
  const mainCharacterData = user.characters.find(c => c.isMain) || user.characters[0]
  let corporationInfo = null
  let allianceInfo = null
  
  if (mainCharacterData?.corporationId) {
    try {
      corporationInfo = await getCorporationInfo(mainCharacterData.corporationId)
      if (corporationInfo?.alliance_id) {
        try {
          allianceInfo = await getAllianceInfo(corporationInfo.alliance_id)
        } catch {}
      }
    } catch {}
  }

  if (!isProfilePublic) {
    return (
      <PrivateProfileClient
        userId={userId}
        mainCharacter={mainCharacterData ? {
          id: mainCharacterData.id,
          name: mainCharacterData.name,
          corporation: corporationInfo ? {
            name: corporationInfo.name,
            ticker: corporationInfo.ticker,
          } : null,
          alliance: allianceInfo ? {
            name: allianceInfo.name,
          } : null,
        } : null}
      />
    )
  }

  // AGGREGATE STATS (FEATS)
  const activities = await prisma.activity.findMany({
    where: { userId, isDeleted: false },
    select: { 
      type: true, 
      data: true, 
      startTime: true, 
      endTime: true,
      typeId: true,
      item: { select: { name: true } }
    }
  })

  const stats = {
    ratting: { 
      topShip: null as string | null
    },
    mining: { 
      volume: 0,
      topShip: null as string | null,
      topOre: null as string | null
    },
    industry: { 
      jobs: 0 
    },
    trading: { 
      profit: 0 
    },
    exploration: { 
      sites: 0 
    },
    totalTime: 0,
    activityCount: activities.length
  }

  const rattingShips: Record<string, number> = {}
  const miningShips: Record<string, number> = {}
  const oreCounts: Record<number, number> = {}

  for (const activity of activities) {
    const aggregated = aggregateActivityData(activity.data as any, activity.type.toUpperCase())
    const type = activity.type.toLowerCase()
    
    if (type === 'ratting') {
      if (activity.item?.name) {
        rattingShips[activity.item.name] = (rattingShips[activity.item.name] || 0) + 1
      }
    } else if (type === 'mining') {
      stats.mining.volume += aggregated.label1
      if (activity.item?.name) {
        miningShips[activity.item.name] = (miningShips[activity.item.name] || 0) + 1
      }

      const data = activity.data as any
      if (data?.oreMined) {
        for (const [id, count] of Object.entries(data.oreMined)) {
          const typeId = parseInt(id)
          if (!isNaN(typeId)) {
            oreCounts[typeId] = (oreCounts[typeId] || 0) + Number(count)
          }
        }
      }
    } else if (type === 'exploration') {
      stats.exploration.sites += aggregated.label1
    }

    if (activity.endTime && activity.startTime) {
      stats.totalTime += new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()
    }
  }

  // Calculate top ships
  stats.ratting.topShip = Object.entries(rattingShips).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  stats.mining.topShip = Object.entries(miningShips).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  // Calculate top ore
  const topOreEntry = Object.entries(oreCounts).sort((a, b) => b[1] - a[1])[0]
  if (topOreEntry) {
    const oreType = await prisma.eveType.findUnique({
      where: { id: parseInt(topOreEntry[0]) },
      select: { name: true }
    })
    stats.mining.topOre = oreType?.name || null
  }

  const totalReputation = await prisma.reputationHistory.aggregate({
    where: { userId },
    _sum: { amount: true },
  })

  const medals = await prisma.medalAward.findMany({
    where: { userId },
    include: { medal: true },
    orderBy: { awardedAt: 'desc' },
  })

  const friendCount = await prisma.userContact.count({
    where: { 
      userId,
      status: 'accepted',
    },
  })

  let contactStatus: 'none' | 'pending' | 'friends' = 'none'
  if (currentUserId && currentUserId !== userId) {
    const existingContact = await prisma.userContact.findFirst({
      where: {
        OR: [
          { userId: currentUserId, contactId: userId },
          { userId: userId, contactId: currentUserId },
        ],
      },
    })
    if (existingContact?.status === 'accepted') {
      contactStatus = 'friends'
    } else if (existingContact?.status === 'pending') {
      contactStatus = 'pending'
    }
  }

  const activeActivity = await prisma.activity.findFirst({
    where: { 
      userId,
      status: 'active',
    },
    orderBy: { startTime: 'desc' },
  })

  const publicFits = await prisma.fit.findMany({
    where: { 
      userId,
      visibility: 'PUBLIC',
    },
    take: 6,
    orderBy: { updatedAt: 'desc' }
  })

  const isOnline = !!(user.lastLoginAt && 
    new Date(user.lastLoginAt).getTime() > Date.now() - 30 * 60 * 1000)

  return (
    <PlayerProfileClient
      userId={userId}
      accountCode={user.accountCode}
      createdAt={user.createdAt}
      lastLoginAt={user.lastLoginAt}
      isOnline={isOnline}
      profile={{
        bio: user.profile?.bio || null,
        bannerUrl: user.profile?.bannerUrl || null,
        discordUrl: user.profile?.discordUrl || null,
        websiteUrl: user.profile?.websiteUrl || null,
        customThemeColor: user.profile?.customThemeColor || null,
      }}
      privacySettings={{
        showKills: user.profile?.showKills ?? true,
        showDeaths: user.profile?.showDeaths ?? true,
        showReputation: user.profile?.showReputation ?? true,
        showMedals: user.profile?.showMedals ?? true,
        showActivities: user.profile?.showActivities ?? true,
        showFits: user.profile?.showFits ?? true,
        showContacts: user.profile?.showContacts ?? true,
        showLocation: user.profile?.showLocation ?? false,
        showShip: user.profile?.showShip ?? false,
        showWallet: user.profile?.showWallet ?? false,
      }}
      mainCharacter={mainCharacterData ? {
        id: mainCharacterData.id,
        name: mainCharacterData.name,
        tags: mainCharacterData.tags,
        corporation: (corporationInfo && mainCharacterData.corporationId) ? {
          id: mainCharacterData.corporationId,
          name: corporationInfo.name,
          ticker: corporationInfo.ticker,
        } : null,
        alliance: (allianceInfo && corporationInfo?.alliance_id) ? {
          id: corporationInfo.alliance_id,
          name: allianceInfo.name,
        } : null,
      } : null}
      allCharacters={user.characters.map(c => ({
        id: c.id,
        name: c.name,
        isMain: c.isMain,
        tags: c.tags,
        corporation: null,
        alliance: null
      }))}
      charactersCount={user.characters.length}
      friendCount={friendCount}
      contactStatus={contactStatus}
      publicFits={publicFits.map(f => ({
        id: f.id,
        name: f.name,
        ship: f.ship,
        shipTypeId: f.shipTypeId,
        updatedAt: f.updatedAt,
        eft: FitParser.toEFT({
          ship: f.ship,
          shipId: f.shipTypeId || 0,
          name: f.name,
          modules: f.modules as any,
          drones: f.drones as any,
          cargo: f.cargo as any
        })
      }))}
      totalReputation={totalReputation._sum.amount || 0}
      activeActivity={activeActivity ? {
        type: activeActivity.type,
        startTime: activeActivity.startTime,
      } : null}
      medals={medals.map(m => ({
        id: m.medalId,
        name: m.medal.name,
        description: m.medal.description,
        icon: m.medal.icon,
        tier: m.medal.tier,
        count: m.count,
        awardedAt: m.awardedAt,
      }))}
      feats={{
        totalHours: Math.round(stats.totalTime / (1000 * 60 * 60)),
        activityCount: stats.activityCount,
        mining: stats.mining as any,
        industry: stats.industry as any,
        trading: stats.trading as any,
        exploration: stats.exploration as any
      }}
    />
  )
}