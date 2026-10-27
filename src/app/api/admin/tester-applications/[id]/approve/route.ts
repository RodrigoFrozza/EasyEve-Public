import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { ApproveTesterApplicationSchema } from '@/lib/schemas'
import { FULL_ACTIVITY_ACCESS } from '@/lib/tester-program'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, admin) => {
  const pathname = new URL(request.url).pathname
  const applicationId = pathname.split('/').slice(-2, -1)[0]
  const body = await validateBody(request, ApproveTesterApplicationSchema)

  const application = await prisma.testerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true },
  })

  if (!application) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Tester application not found.', 404)
  }

  if (application.status !== 'pending') {
    throw new AppError(ErrorCodes.API_CONFLICT, 'Only pending applications can be approved.', 409)
  }

  const reviewedAt = new Date()
  const [updatedApplication] = await prisma.$transaction([
    prisma.testerApplication.update({
      where: { id: applicationId },
      data: {
        status: 'approved',
        reviewedAt,
        reviewedById: admin.id,
        reviewNotes: body.reviewNotes,
        cooldownUntil: null,
      },
    }),
    prisma.user.update({
      where: { id: application.userId },
      data: {
        isTester: true,
        testerApprovedAt: reviewedAt,
        testerApprovedById: admin.id,
        testerRevokedAt: null,
        testerRevokedById: null,
        allowedActivities: FULL_ACTIVITY_ACCESS,
      },
    }),
  ])

  await prisma.notification.create({
    data: {
      userId: application.userId,
      type: 'system',
      title: 'Tester application approved',
      content: 'Your tester application was approved. You now have full EasyEve access until manual revocation.',
      link: '/dashboard',
    },
  })

  await prisma.securityEvent.create({
    data: {
      event: 'TESTER_APPLICATION_APPROVED',
      userId: admin.id,
      path: '/api/admin/tester-applications/[id]/approve',
      details: {
        applicationId,
        targetUserId: application.userId,
      },
    },
  })

  return { application: updatedApplication }
}))
