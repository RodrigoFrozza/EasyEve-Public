import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

const PULALEEROY_CORP_ID = 98651213
const LIFETIME_DATE = new Date('2099-12-31T23:59:59Z')

/**
 * GET /api/admin/subscription - List all users with active subscriptions
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  const users = await prisma.user.findMany({
    where: {
      subscriptionEnd: { gt: new Date() }
    },
    select: {
      id: true,
      name: true,
      accountCode: true,
      subscriptionEnd: true,
      characters: {
        select: {
          id: true,
          name: true,
          corporationId: true
        }
      }
    },
    orderBy: { subscriptionEnd: 'desc' }
  })

  return users.map(user => ({
    id: user.id,
    name: user.name,
    accountCode: user.accountCode,
    subscriptionEnd: user.subscriptionEnd,
    hasPremium: user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date(),
    isPulaLeeroy: user.characters.some(c => c.corporationId === PULALEEROY_CORP_ID)
  }))
}))

/**
 * POST /api/admin/subscription - Grant or update user subscription
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
  const body = await request.json()
  const { userId, type } = body

  if (!userId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'User ID is required', 400)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      characters: {
        select: {
          id: true,
          name: true,
          corporationId: true
        }
      }
    }
  })

  if (!user) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'User not found', 404)
  }

  const isPulaLeeroyMember = user.characters.some(c => c.corporationId === PULALEEROY_CORP_ID)

  let newEnd: Date
  let codeType: string

  if (type === 'LIFETIME') {
    newEnd = LIFETIME_DATE
    codeType = 'LIFETIME'
  } else if (type === 'DAYS_30') {
    newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    codeType = 'DAYS_30'
  } else if (type === 'PL8R') {
    if (!isPulaLeeroyMember) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, 'User is not a member of PulaLeeroy', 400)
    }
    newEnd = LIFETIME_DATE
    codeType = 'PL8R'
  } else {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Invalid subscription type', 400)
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionEnd: newEnd,
      allowedActivities: ['ratting', 'mining', 'abyssal', 'exploration', 'escalations', 'crab', 'pvp']
    }
  })

  return {
    success: true,
    userId: user.id,
    userName: user.name,
    subscriptionEnd: newEnd,
    type: codeType,
    isPulaLeeroy: isPulaLeeroyMember
  }
}))