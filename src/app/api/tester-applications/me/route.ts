import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { TESTER_PROGRAM_RULES } from '@/lib/tester-program'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(withAuth(async (_request, user) => {
  const application = await prisma.testerApplication.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      description: true,
      reviewNotes: true,
      reviewedAt: true,
      cooldownUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return {
    isTester: user.isTester,
    application,
    rules: TESTER_PROGRAM_RULES,
  }
}))
