import { prisma } from '@/lib/prisma'
import { ACTIVITY_TYPES } from '@/lib/constants/activity-data'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AdminUpdateAccountSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/accounts - List all user accounts with extensive details
 */
export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (req: Request) => {
  const { searchParams } = new URL(req.url)
  const pageParam = parseInt(searchParams.get('page') || '1', 10)
  const limitParam = parseInt(searchParams.get('limit') || '50', 10)
  const page = Number.isFinite(pageParam) ? Math.max(1, pageParam) : 1
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 200)) : 50
  const skip = (page - 1) * limit
  const summaryOnly = searchParams.get('summary') === '1'
  const include = summaryOnly
    ? {
        characters: {
          select: {
            id: true,
            name: true,
            isMain: true,
          },
          orderBy: { isMain: 'desc' as const }
        },
        _count: {
          select: {
            characters: true,
            activities: true,
          }
        }
      }
    : {
        characters: {
          select: {
            id: true,
            name: true,
            isMain: true,
          },
          orderBy: { isMain: 'desc' as const }
        },
        payments: {
          take: 10,
          orderBy: { createdAt: 'desc' as const },
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            payerCharacterName: true,
            journalId: true
          }
        },
        medals: {
          include: {
            medal: {
              select: {
                name: true,
                icon: true,
                tier: true,
              }
            }
          },
          orderBy: { awardedAt: 'desc' as const },
          take: 20,
        },
        contacts: {
          where: { status: 'accepted' },
          include: {
            contact: {
              select: {
                id: true,
                name: true,
              }
            }
          },
          take: 10,
        },
        _count: {
          select: {
            characters: true,
            activities: true,
          }
        }
      }

  const search = searchParams.get('search') || ''
  const filter = searchParams.get('filter') || 'all'

  const where: any = {}
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { accountCode: { contains: search, mode: 'insensitive' } },
      { characters: { some: { name: { contains: search, mode: 'insensitive' } } } }
    ]
  }

  if (filter === 'blocked') {
    where.isBlocked = true
  } else if (filter === 'active') {
    where.isBlocked = false
    where.OR = [
      { subscriptionEnd: { gt: new Date() } },
      { subscriptionEnd: null }
    ]
  } else if (filter === 'expired') {
    where.isBlocked = false
    where.subscriptionEnd = { lt: new Date() }
  } else if (filter === 'tester') {
    where.isTester = true
  }

  const [accounts, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where })
  ])

  const formattedAccounts = accounts.map((account: any) => ({
    id: account.id,
    accountCode: account.accountCode,
    name: account.characters[0]?.name || null,
    role: account.role,
    isBlocked: account.isBlocked,
    isTester: account.isTester,
    createdAt: account.createdAt?.toISOString() || null,
    subscriptionEnd: account.subscriptionEnd?.toISOString() || null,
    lastLoginAt: account.lastLoginAt?.toISOString() || null,
    discordId: account.discordId,
    discordName: account.discordName,
    allowedActivities: account.allowedActivities,
    characters: account.characters,
    payments: summaryOnly ? undefined : account.payments,
    medals: summaryOnly ? undefined : account.medals.map((m: any) => ({
      id: m.id,
      medalId: m.medalId,
      name: m.medal.name,
      icon: m.medal.icon,
      tier: m.medal.tier,
      count: m.count,
      awardedAt: m.awardedAt.toISOString(),
    })),
    friends: summaryOnly ? undefined : account.contacts.map((c: any) => ({
      id: c.contactId,
      name: c.contact.name || 'Unknown',
      addedAt: c.createdAt.toISOString(),
    })),
    _count: account._count,
  }))
  
  return {
    accounts: formattedAccounts,
    total,
    pagination: {
      total,
      page,
      limit,
      hasMore: total > skip + accounts.length,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
    availableActivities: ACTIVITY_TYPES.map(a => a.id)
  }
}))

/**
 * PUT /api/admin/accounts - Update user account (activities, subscription)
 */
export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
  const body = await validateBody(request, AdminUpdateAccountSchema)
  const { userId, allowedActivities, subscriptionEnd } = body
  
  const updateData: any = {}
  if (allowedActivities) updateData.allowedActivities = allowedActivities
  if (subscriptionEnd) updateData.subscriptionEnd = new Date(subscriptionEnd)
  
  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      accountCode: true,
      allowedActivities: true,
      subscriptionEnd: true,
    }
  })
  
  return updated
}))

/**
 * DELETE /api/admin/accounts - Delete a user account (DANGER)
 */
export const DELETE = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Missing userId', 400)
  }
  
  await prisma.user.delete({
    where: { id: userId }
  })
  
  return { success: true }
}))