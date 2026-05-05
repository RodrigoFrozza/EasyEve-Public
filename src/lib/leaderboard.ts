import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/cache'
import { startOfDay, startOfWeek, startOfMonth } from 'date-fns'

export interface LeaderboardItem {
  userId: string
  total: number
  label1: number
  label2: number
  characterName: string
  characterId: number
}

interface LeaderboardQueryResult {
  userId: string
  total: number | string
  label1: number | string
  label2: number | string
  characterName: string | null
  characterId: number | null
}

interface RankQueryResult {
  rank: number | string
}

type ActivityData = {
  automatedBounties?: number
  automatedEss?: number
  additionalBounties?: number
  estimatedLootValue?: number
  estimatedSalvageValue?: number
  miningValue?: number
  totalEstimatedValue?: number
  totalQuantity?: number
  totalLootValue?: number
  systemsVisited?: number
  [key: string]: unknown
}

const LEADERBOARD_CACHE_TTL = 60 * 1000
const DEFAULT_LIMIT = 10

async function getStartDateForPeriod(
  period: 'daily' | 'weekly' | 'monthly' | 'alltime',
  baseDate: Date
): Promise<Date> {
  if (period === 'alltime') {
    const earliestActivity = await prisma.activity.findFirst({
      orderBy: { startTime: 'asc' },
      select: { startTime: true }
    })
    return earliestActivity?.startTime || new Date('2024-01-01')
  }
  if (period === 'daily') return startOfDay(baseDate)
  if (period === 'weekly') return startOfWeek(baseDate, { weekStartsOn: 1 })
  return startOfMonth(baseDate)
}

export function aggregateActivityData(
  data: ActivityData | null,
  type: string
): { label1: number; label2: number; total: number } {
  const result = { label1: 0, label2: 0, total: 0 }

  if (!data) return result

  if (type === 'RATTING') {
    const bounty = Number(data.automatedBounties || 0)
    const ess = Number(data.automatedEss || 0)
    const additional = Number(data.additionalBounties || 0)
    const loot = Number(data.estimatedLootValue || 0)
    const salvage = Number(data.estimatedSalvageValue || 0)
    result.label1 = bounty
    result.label2 = ess
    result.total = bounty + ess + additional + loot + salvage
  } else if (type === 'MINING') {
    const value = Number(data.miningValue || data.totalEstimatedValue || 0)
    const quantity = Number(data.totalQuantity || 0)
    result.label1 = quantity
    result.total = value
  } else if (type === 'EXPLORATION') {
    const value = Number(data.totalLootValue || data.totalEstimatedValue || 0)
    const sites = Number(data.systemsVisited || 0)
    result.label1 = sites
    result.total = value
  }

  return result
}

export async function getLeaderboardData(
  period: 'daily' | 'weekly' | 'monthly' | 'alltime',
  type: 'ratting' | 'mining' | 'exploration',
  options: { limit?: number; includeCache?: boolean } = {}
): Promise<LeaderboardItem[]> {
  const { limit = DEFAULT_LIMIT, includeCache = true } = options
  const normalizedType = type.toUpperCase()
  const startDate = await getStartDateForPeriod(period, new Date())
  const cacheKey = `leaderboard:${normalizedType}:${period}:${limit}`

  const fetchData = async (): Promise<LeaderboardItem[]> => {
    let aggregationSql: Promise<LeaderboardQueryResult[]>

    // Construct SQL based on activity type to perform aggregation on DB side
    if (normalizedType === 'RATTING') {
      aggregationSql = prisma.$queryRaw<Array<{
        userId: string
        total: string
        label1: string
        label2: string
        characterName: string | null
        characterId: number | null
      }>>`
        SELECT 
          a."userId",
          SUM(
            COALESCE((a.data->>'automatedBounties')::numeric, 0) + 
            COALESCE((a.data->>'automatedEss')::numeric, 0) + 
            COALESCE((a.data->>'additionalBounties')::numeric, 0) + 
            COALESCE((a.data->>'estimatedLootValue')::numeric, 0) + 
            COALESCE((a.data->>'estimatedSalvageValue')::numeric, 0)
          ) as total,
          SUM(COALESCE((a.data->>'automatedBounties')::numeric, 0)) as label1,
          SUM(COALESCE((a.data->>'automatedEss')::numeric, 0)) as label2,
          c."name" as "characterName",
          c."id" as "characterId"
        FROM "Activity" a
        JOIN "User" u ON a."userId" = u.id
        LEFT JOIN "Character" c ON c."userId" = a."userId" AND c."isMain" = true
        WHERE a.type ILIKE ${normalizedType}
          AND a."startTime" >= ${startDate}
          AND a."isDeleted" = false
          AND u."subscriptionEnd" >= NOW()
        GROUP BY a."userId", c."name", c."id"
        ORDER BY total DESC
        LIMIT ${limit * 2}
      `
    } else if (normalizedType === 'MINING') {
      aggregationSql = prisma.$queryRaw<Array<{
        userId: string
        total: string
        label1: string
        label2: string
        characterName: string | null
        characterId: number | null
      }>>`
        SELECT 
          a."userId",
          SUM(COALESCE((a.data->>'miningValue')::numeric, (a.data->>'totalEstimatedValue')::numeric, 0)) as total,
          SUM(COALESCE((a.data->>'totalQuantity')::numeric, 0)) as label1,
          0 as label2,
          c."name" as "characterName",
          c."id" as "characterId"
        FROM "Activity" a
        JOIN "User" u ON a."userId" = u.id
        LEFT JOIN "Character" c ON c."userId" = a."userId" AND c."isMain" = true
        WHERE a.type ILIKE ${normalizedType}
          AND a."startTime" >= ${startDate}
          AND a."isDeleted" = false
          AND u."subscriptionEnd" >= NOW()
        GROUP BY a."userId", c."name", c."id"
        ORDER BY total DESC
        LIMIT ${limit * 2}
      `
    } else if (normalizedType === 'EXPLORATION') {
      aggregationSql = prisma.$queryRaw<Array<{
        userId: string
        total: string
        label1: string
        label2: string
        characterName: string | null
        characterId: number | null
      }>>`
        SELECT 
          a."userId",
          SUM(COALESCE((a.data->>'totalLootValue')::numeric, (a.data->>'totalEstimatedValue')::numeric, 0)) as total,
          SUM(COALESCE((a.data->>'systemsVisited')::numeric, 0)) as label1,
          0 as label2,
          c."name" as "characterName",
          c."id" as "characterId"
        FROM "Activity" a
        JOIN "User" u ON a."userId" = u.id
        LEFT JOIN "Character" c ON c."userId" = a."userId" AND c."isMain" = true
        WHERE a.type ILIKE ${normalizedType}
          AND a."startTime" >= ${startDate}
          AND a."isDeleted" = false
          AND u."subscriptionEnd" >= NOW()
        GROUP BY a."userId", c."name", c."id"
        ORDER BY total DESC
        LIMIT ${limit * 2}
      `
    } else {
      return []
    }

    const aggregatedResults = await aggregationSql
    
    if (aggregatedResults.length === 0) return []

    return aggregatedResults
      .map(r => ({
        userId: r.userId,
        total: Number(r.total),
        label1: Number(r.label1),
        label2: Number(r.label2),
        characterName: r.characterName || 'Unknown Capsuleer',
        characterId: r.characterId || 0
      }))
      .filter(item => item.characterId !== 0) // Only show users with main characters
      .slice(0, limit)
  }

  if (includeCache) {
    return withCache(cacheKey, fetchData, LEADERBOARD_CACHE_TTL)
  }

  return fetchData()
}

export async function getUserRank(
  userId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'alltime',
  type: 'ratting' | 'mining' | 'exploration'
): Promise<number> {
  const cacheKey = `leaderboard:user-rank:${period}:${type}:${userId}`

  return withCache(
    cacheKey,
    async () => {
      // Reuse the same aggregation logic but for all users to find rank
      // We could also just fetch the full leaderboard if it's small, but SQL is safer
      const startDate = await getStartDateForPeriod(period, new Date())
      const normalizedType = type.toUpperCase()

      let rankSql: Promise<RankQueryResult[]>
      if (normalizedType === 'RATTING') {
        rankSql = prisma.$queryRaw`
          WITH RankedUsers AS (
            SELECT 
              a."userId",
              SUM(
                COALESCE((a.data->>'automatedBounties')::numeric, 0) + 
                COALESCE((a.data->>'automatedEss')::numeric, 0) + 
                COALESCE((a.data->>'additionalBounties')::numeric, 0) + 
                COALESCE((a.data->>'estimatedLootValue')::numeric, 0) + 
                COALESCE((a.data->>'estimatedSalvageValue')::numeric, 0)
              ) as total
            FROM "Activity" a
            JOIN "User" u ON a."userId" = u.id
            WHERE a.type ILIKE ${normalizedType}
              AND a."startTime" >= ${startDate}
              AND a."isDeleted" = false
              AND u."subscriptionEnd" >= NOW()
            GROUP BY a."userId"
          )
          SELECT rank FROM (
            SELECT "userId", RANK() OVER (ORDER BY total DESC) as rank
            FROM RankedUsers
          ) r WHERE "userId" = ${userId}
        `
      } else if (normalizedType === 'MINING') {
        rankSql = prisma.$queryRaw`
          WITH RankedUsers AS (
            SELECT 
              a."userId",
              SUM(COALESCE((a.data->>'miningValue')::numeric, (a.data->>'totalEstimatedValue')::numeric, 0)) as total
            FROM "Activity" a
            JOIN "User" u ON a."userId" = u.id
            WHERE a.type ILIKE ${normalizedType}
              AND a."startTime" >= ${startDate}
              AND a."isDeleted" = false
              AND u."subscriptionEnd" >= NOW()
            GROUP BY a."userId"
          )
          SELECT rank FROM (
            SELECT "userId", RANK() OVER (ORDER BY total DESC) as rank
            FROM RankedUsers
          ) r WHERE "userId" = ${userId}
        `
      } else if (normalizedType === 'EXPLORATION') {
        rankSql = prisma.$queryRaw`
          WITH RankedUsers AS (
            SELECT 
              a."userId",
              SUM(COALESCE((a.data->>'totalLootValue')::numeric, (a.data->>'totalEstimatedValue')::numeric, 0)) as total
            FROM "Activity" a
            JOIN "User" u ON a."userId" = u.id
            WHERE a.type ILIKE ${normalizedType}
              AND a."startTime" >= ${startDate}
              AND a."isDeleted" = false
              AND u."subscriptionEnd" >= NOW()
            GROUP BY a."userId"
          )
          SELECT rank FROM (
            SELECT "userId", RANK() OVER (ORDER BY total DESC) as rank
            FROM RankedUsers
          ) r WHERE "userId" = ${userId}
        `
      } else {
        return 0
      }

      const result = await rankSql
      return result.length > 0 ? Number(result[0].rank) : 0
    },
    LEADERBOARD_CACHE_TTL
  )
}

export async function warmupLeaderboardCache(): Promise<void> {
  const periods: Array<'daily' | 'weekly' | 'monthly' | 'alltime'> = ['daily', 'weekly', 'monthly', 'alltime']
  const types: Array<'ratting' | 'mining' | 'exploration'> = ['ratting', 'mining', 'exploration']

  await Promise.all(
    periods.flatMap(period =>
      types.map(type => getLeaderboardData(period, type, { includeCache: true }))
    )
  )
}