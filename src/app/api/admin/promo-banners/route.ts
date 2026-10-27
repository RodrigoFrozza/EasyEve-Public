import { prisma } from '@/lib/prisma'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import {
  buildPromoBannerWriteData,
  promoBannerInputSchema,
} from '@/lib/promo-banners'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  const banners = await prisma.promoBanner.findMany({
    include: {
      interactions: {
        select: {
          claimedAt: true,
          dismissedAt: true,
          activationCode: {
            select: {
              isUsed: true,
            },
          },
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return {
    items: banners.map((banner) => {
      const claimCount = banner.interactions.filter((interaction) => interaction.claimedAt).length
      const dismissCount = banner.interactions.filter((interaction) => interaction.dismissedAt).length
      const redeemedCount = banner.interactions.filter(
        (interaction) => interaction.activationCode?.isUsed
      ).length

      return {
        ...banner,
        stats: {
          claimCount,
          dismissCount,
          redeemedCount,
        },
      }
    }),
  }
}))

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, user) => {
  const input = await validateBody(request, promoBannerInputSchema)
  const data = buildPromoBannerWriteData(input)

  const createdBanner = await prisma.promoBanner.create({
    data: {
      ...data,
      createdBy: user.accountCode || user.id,
    },
  })

  return createdBanner
}))
