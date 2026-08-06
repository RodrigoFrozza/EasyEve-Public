import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const applications = await prisma.testerApplication.findMany({
    where: status ? { status } : undefined,
    include: {
      user: {
        select: {
          id: true,
          accountCode: true,
          name: true,
          isTester: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          accountCode: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return { applications }
}))
