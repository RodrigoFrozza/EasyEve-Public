import { prisma } from '@/lib/prisma'
import { EASY_EVE_MEDALS } from '@/lib/constants/medals'
import { withAuth } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === '1'

    const medals = await prisma.easyEveMedal.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    })

    if (includeStats) {
      const [awardCounts, recipientCounts] = await Promise.all([
        prisma.medalAward.groupBy({
          by: ['medalId'],
          _count: { _all: true },
        }),
        prisma.medalAward.groupBy({
          by: ['medalId', 'userId'],
        }),
      ])

      const awardCountMap = new Map(awardCounts.map((entry) => [entry.medalId, entry._count._all]))
      const recipientCountMap = new Map<string, number>()
      for (const entry of recipientCounts) {
        recipientCountMap.set(entry.medalId, (recipientCountMap.get(entry.medalId) || 0) + 1)
      }

      return {
        medals: medals.map((medal) => ({
          ...medal,
          awardCount: awardCountMap.get(medal.id) || 0,
          uniqueRecipients: recipientCountMap.get(medal.id) || 0,
        })),
      }
    }

    return { medals }
}))

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
    const body = await request.json()
    const { action } = body

    if (action === 'seed') {
      const createdMedals = []

      for (const medal of EASY_EVE_MEDALS) {
        const existing = await prisma.easyEveMedal.findUnique({
          where: { id: medal.id },
        })

        if (!existing) {
          const created = await prisma.easyEveMedal.create({
            data: {
              id: medal.id,
              name: medal.name,
              description: medal.description,
              icon: medal.icon,
              criteria: JSON.stringify(medal.criteria),
              tier: medal.tier,
              type: medal.type,
              isActive: true,
            },
          })
          createdMedals.push(created)
        }
      }

      return {
        success: true,
        message: `Created ${createdMedals.length} medals`,
        medals: createdMedals,
      }
    }

    if (action === 'create') {
      const { name, description, icon, criteria, tier, type } = body

      const medal = await prisma.easyEveMedal.create({
        data: {
          name,
          description,
          icon,
          criteria: JSON.stringify(criteria),
          tier: tier || 'bronze',
          type: type || 'instant',
          isActive: true,
        },
      })

      return { success: true, medal }
    }

    if (action === 'toggle') {
      const { medalId, isActive } = body

      const medal = await prisma.easyEveMedal.update({
        where: { id: medalId },
        data: { isActive },
      })

      return { success: true, medal }
    }

    if (action === 'update') {
      const { medalId, ...data } = body

      const updateData: any = {}
      if (data.name) updateData.name = data.name
      if (data.description) updateData.description = data.description
      if (data.icon) updateData.icon = data.icon
      if (data.criteria) updateData.criteria = JSON.stringify(data.criteria)
      if (data.tier) updateData.tier = data.tier
      if (data.type) updateData.type = data.type

      const medal = await prisma.easyEveMedal.update({
        where: { id: medalId },
        data: updateData,
      })

      return { success: true, medal }
    }

    throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid action', 400)
}))

export const DELETE = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request: Request) => {
    const { searchParams } = new URL(request.url)
    const medalId = searchParams.get('id')

    if (!medalId) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Medal ID required', 400)
    }

    // Check if medal has any awards
    const awards = await prisma.medalAward.count({
      where: { medalId },
    })

    if (awards > 0) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Cannot delete medal with existing awards. Deactivate it instead.', 400)
    }

    await prisma.easyEveMedal.delete({
      where: { id: medalId },
    })

    return { success: true }
}))