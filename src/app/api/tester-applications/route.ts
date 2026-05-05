import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { CreateTesterApplicationSchema } from '@/lib/schemas'
import { TESTER_PROGRAM_RULES } from '@/lib/tester-program'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(withAuth(async (request, user) => {
  const body = await validateBody(request, CreateTesterApplicationSchema)

  const acceptedRuleSet = new Set(body.acceptedRules)
  const allRulesAccepted = TESTER_PROGRAM_RULES.every((_, index) => acceptedRuleSet.has(index))
  if (!allRulesAccepted) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'You must accept all tester program rules.', 400)
  }

  const [latestApplication, pendingApplication] = await Promise.all([
    prisma.testerApplication.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.testerApplication.findFirst({
      where: { userId: user.id, status: 'pending' },
    }),
  ])

  if (pendingApplication) {
    throw new AppError(ErrorCodes.API_CONFLICT, 'You already have a pending tester application.', 409)
  }

  const now = new Date()
  if (latestApplication?.cooldownUntil && latestApplication.cooldownUntil > now) {
    throw new AppError(
      ErrorCodes.API_FORBIDDEN,
      `You are in cooldown until ${latestApplication.cooldownUntil.toISOString()}.`,
      403
    )
  }

  const application = await prisma.testerApplication.create({
    data: {
      userId: user.id,
      description: body.description,
      rulesAcceptedAt: now,
      status: 'pending',
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  })

  const masterUsers = await prisma.user.findMany({
    where: { role: 'master' },
    select: { id: true },
  })

  if (masterUsers.length > 0) {
    await prisma.notification.createMany({
      data: masterUsers.map((master) => ({
        userId: master.id,
        type: 'system',
        title: 'New tester application',
        content: `A new tester application was submitted by ${user.accountCode || user.id}.`,
        link: '/dashboard/admin',
      })),
    })
  }

  await prisma.securityEvent.create({
    data: {
      event: 'TESTER_APPLICATION_SUBMITTED',
      userId: user.id,
      path: '/api/tester-applications',
      details: { applicationId: application.id },
    },
  })

  return {
    application,
    rules: TESTER_PROGRAM_RULES,
  }
}))
