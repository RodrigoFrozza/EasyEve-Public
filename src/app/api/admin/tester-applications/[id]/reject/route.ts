import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { RejectTesterApplicationSchema } from '@/lib/schemas'
import { getTesterCooldownUntil } from '@/lib/tester-program'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, admin) => {
  const pathname = new URL(request.url).pathname
  const applicationId = pathname.split('/').slice(-2, -1)[0]
  const body = await validateBody(request, RejectTesterApplicationSchema)

  const application = await prisma.testerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true },
  })

  if (!application) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Tester application not found.', 404)
  }

  if (application.status !== 'pending') {
    throw new AppError(ErrorCodes.API_CONFLICT, 'Only pending applications can be rejected.', 409)
  }

  const reviewedAt = new Date()
  const updated = await prisma.testerApplication.update({
    where: { id: applicationId },
    data: {
      status: 'rejected',
      reviewNotes: body.reviewNotes,
      reviewedAt,
      reviewedById: admin.id,
      cooldownUntil: getTesterCooldownUntil(reviewedAt),
    },
  })

  await prisma.notification.create({
    data: {
      userId: updated.userId,
      type: 'system',
      title: 'Tester application rejected',
      content: body.reviewNotes,
      link: '/dashboard',
    },
  })

  await prisma.securityEvent.create({
    data: {
      event: 'TESTER_APPLICATION_REJECTED',
      userId: admin.id,
      path: '/api/admin/tester-applications/[id]/reject',
      details: {
        applicationId,
        targetUserId: updated.userId,
        cooldownUntil: updated.cooldownUntil?.toISOString() ?? null,
      },
    },
  })

  return { application: updated }
}))
