import { NextResponse } from 'next/server'
import { withErrorHandling } from '@/lib/api-handler'
import { getLeaderboardData } from '@/lib/leaderboard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const leaderboardParamsSchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly', 'alltime']).default('daily'),
  type: z.enum(['ratting', 'mining', 'exploration']).default('ratting')
})

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const periodParam = searchParams.get('period') || 'daily'
  const typeParam = searchParams.get('type') || 'ratting'

  const parsed = leaderboardParamsSchema.safeParse({ period: periodParam, type: typeParam })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { period, type } = parsed.data
  const result = await getLeaderboardData(period, type, { limit: 10, includeCache: true })

  return NextResponse.json(result)
})
