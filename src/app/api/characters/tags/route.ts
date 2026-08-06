import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()

  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const rows = await prisma.character.findMany({
    where: { userId: user.id },
    select: { tags: true },
  })

  const counts: Record<string, number> = {}
  for (const row of rows) {
    for (const tag of row.tags) {
      counts[tag] = (counts[tag] ?? 0) + 1
    }
  }

  const tags = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  return Response.json({ tags })
})
