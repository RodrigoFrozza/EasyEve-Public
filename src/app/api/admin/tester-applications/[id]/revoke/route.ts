import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, admin) => {
  const pathname = new URL(request.url).pathname
  const applicationId = pathname.split('/').slice(-2, -1)[0]

  const application = await prisma.testerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true },
  })

  if (!application) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Tester application not found.', 404)
  }

  const revokedAt = new Date()
  await prisma.user.update({
    where: { id: application.userId },
    data: {
      isTester: false,
      testerRevokedAt: revokedAt,
      testerRevokedById: admin.id,
      allowedActivities: ['ratting'],
    },
  })

  await prisma.notification.create({
    data: {
      userId: application.userId,
      type: 'system',
      title: 'Tester access revoked',
      content: 'Your tester status was revoked and your account is now on free access.',
      link: '/dashboard/subscription',
    },
  })

  await prisma.securityEvent.create({
    data: {
      event: 'TESTER_ACCESS_REVOKED',
      userId: admin.id,
      path: '/api/admin/tester-applications/[id]/revoke',
      details: {
        applicationId,
        targetUserId: application.userId,
      },
    },
  })

  return { success: true }
}))
