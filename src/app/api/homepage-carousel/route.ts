import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => {
  const items = await prisma.homepageCarousel.findMany({
    where: { active: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return { items }
})