import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { getSession } from '@/lib/session'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}
import { getCorporationInfo, getAllianceInfo } from '@/lib/esi'
import { getTranslations } from '@/i18n/server'
import { DashboardNews } from '@/components/dashboard/DashboardNews'
import { DashboardGrid } from '@/components/dashboard/DashboardGrid'
import { LeaderboardSideContent } from '@/components/dashboard/LeaderboardSideContent'
import { ActivityPanel } from '@/components/dashboard/ActivityPanel'
import { UserOverview } from '@/components/dashboard/UserOverview'
import { PromoBannerSpotlight } from '@/components/dashboard/PromoBannerSpotlight'
import { PerformanceSection } from '@/components/dashboard/PerformanceSection'
import { ActivityTourAutoRedirect } from '@/components/dashboard/ActivityTourAutoRedirect'
import { LeaderboardEntry } from '@/lib/stores/leaderboard-store'
import { getLeaderboardData, getUserRank } from '@/lib/leaderboard'


import { getEligiblePromoBannerViewsForUser } from '@/lib/promo-banner-service'
import { startOfWeek } from 'date-fns'


export default async function DashboardPage() {
  const { t } = await getTranslations()
  const session = await getSession()
  
  if (!session?.user?.id) {
    return null
  }

  const promoBanners = await getEligiblePromoBannerViewsForUser(session.user.id)

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      characters: {
        orderBy: { isMain: 'desc' }
      },
      medals: {
        include: {
          medal: true
        },
        orderBy: { awardedAt: 'desc' },
        take: 10
      },
      contacts: {
        where: { status: 'accepted' },
        take: 10
      }
    }
  })

  const now = new Date()

  const totalReputation = await prisma.reputationHistory.aggregate({
    where: { userId: session.user.id },
    _sum: { amount: true },
  })

  const weekStart = startOfWeek(now, { weekStartsOn: 1 })

  const activeActivity = await prisma.activity.findFirst({
    where: { 
      userId: session.user.id,
      status: 'active'
    },
    orderBy: { startTime: 'desc' }
  })

  const mainCharacter = user?.characters?.find(c => c.isMain) || user?.characters?.[0]
  let corporationInfo = null
  let allianceInfo = null
  
  if (mainCharacter?.corporationId) {
    try {
      corporationInfo = await getCorporationInfo(mainCharacter.corporationId)
      if (corporationInfo?.alliance_id) {
        try {
          allianceInfo = await getAllianceInfo(corporationInfo.alliance_id)
        } catch {}
      }
    } catch {}
  }


  let rattingDaily: LeaderboardEntry[] = []
  let rattingWeekly: LeaderboardEntry[] = []
  let rattingMonthly: LeaderboardEntry[] = []
  let rattingAllTime: LeaderboardEntry[] = []

  let miningDaily: LeaderboardEntry[] = []
  let miningWeekly: LeaderboardEntry[] = []
  let miningMonthly: LeaderboardEntry[] = []
  let miningAllTime: LeaderboardEntry[] = []

  let explorationDaily: LeaderboardEntry[] = []
  let explorationWeekly: LeaderboardEntry[] = []
  let explorationMonthly: LeaderboardEntry[] = []
  let explorationAllTime: LeaderboardEntry[] = []


  let userRankRatting = 0
  let userRankMining = 0
  let userRankExploration = 0

  try {
    const [
      rd, rw, rm, ra, md, mw, mm, ma, ed, ew, em, ea,
      urR, urM, urE,
    ] = await Promise.all([
      getLeaderboardData('daily', 'ratting'),
      getLeaderboardData('weekly', 'ratting'),
      getLeaderboardData('monthly', 'ratting'),
      getLeaderboardData('alltime', 'ratting'),
      getLeaderboardData('daily', 'mining'),
      getLeaderboardData('weekly', 'mining'),
      getLeaderboardData('monthly', 'mining'),
      getLeaderboardData('alltime', 'mining'),
      getLeaderboardData('daily', 'exploration'),
      getLeaderboardData('weekly', 'exploration'),
      getLeaderboardData('monthly', 'exploration'),
      getLeaderboardData('alltime', 'exploration'),
      getUserRank(session.user.id, 'daily', 'ratting'),
      getUserRank(session.user.id, 'daily', 'mining'),
      getUserRank(session.user.id, 'daily', 'exploration'),
    ])
    rattingDaily = rd
    rattingWeekly = rw
    rattingMonthly = rm
    rattingAllTime = ra
    miningDaily = md
    miningWeekly = mw
    miningMonthly = mm
    miningAllTime = ma
    explorationDaily = ed
    explorationWeekly = ew
    explorationMonthly = em
    explorationAllTime = ea
    userRankRatting = urR
    userRankMining = urM
    userRankExploration = urE
  } catch (error) {
    console.error('Failed to fetch leaderboard data:', error)
  }

  const characters: Array<{ id: number; name: string; isMain: boolean; totalSp: number; walletBalance: number; location: string | null; ship: string | null }> = user?.characters || []
  
  const userActivities = await prisma.activity.findMany({
    where: {
      userId: session.user.id,
      startTime: { gte: weekStart },
    },
    orderBy: { startTime: 'desc' },
    take: 10,
  })

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto w-full">
      <ActivityTourAutoRedirect userId={session.user.id} characterCount={characters.length} />
      <PromoBannerSpotlight initialBanners={promoBanners} />

      <DashboardGrid
        sidebar={
          <LeaderboardSideContent 
            rattingData={{
              daily: rattingDaily,
              weekly: rattingWeekly,
              monthly: rattingMonthly,
              alltime: rattingAllTime
            }}
            miningData={{
              daily: miningDaily,
              weekly: miningWeekly,
              monthly: miningMonthly,
              alltime: miningAllTime
            }}
            explorationData={{
              daily: explorationDaily,
              weekly: explorationWeekly,
              monthly: explorationMonthly,
              alltime: explorationAllTime
            }}
            currentUserId={session?.user?.id}
            userRank={{
              ratting: userRankRatting,
              mining: userRankMining,
              exploration: userRankExploration
            }}
          />
        }
      >
        <UserOverview
          userId={session.user.id}
          mainCharacter={mainCharacter ? {
            id: mainCharacter.id,
            name: mainCharacter.name,
            corporation: corporationInfo ? {
              name: corporationInfo.name,
              ticker: corporationInfo.ticker,
            } : null,
            alliance: allianceInfo ? {
              name: allianceInfo.name,
            } : null,
          } : null}
          characters={characters.map(c => ({
            id: c.id,
            name: c.name,
            isMain: c.isMain,
          }))}
          totalReputation={totalReputation._sum.amount || 0}
          medals={(user?.medals || []).map(m => ({
            id: m.medalId,
            name: m.medal.name,
            icon: m.medal.icon,
            tier: m.medal.tier,
            count: m.count,
          }))}
          activeActivity={activeActivity ? {
            type: activeActivity.type,
            startTime: activeActivity.startTime,
          } : null}
        />
        <DashboardNews />
        <ActivityPanel activities={userActivities.map(a => ({
          id: a.id,
          type: a.type,
          status: a.status,
          startTime: a.startTime,
          endTime: a.endTime,
          region: a.region,
          space: a.space,
          isPaused: a.isPaused,
          typeId: a.typeId,
          data: a.data as Record<string, unknown>
        }))} />
      </DashboardGrid>
    </div>
  )
}

