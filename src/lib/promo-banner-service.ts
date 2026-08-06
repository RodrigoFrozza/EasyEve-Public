import { prisma } from '@/lib/prisma'
import {
  PROMO_BANNER_PLACEMENTS,
  type PromoBannerPlacement,
  type PromoBannerViewModel,
  isUserEligibleForPromoBanner,
  toPromoBannerViewModel,
} from '@/lib/promo-banners'

export async function getEligiblePromoBannerViewsForUser(
  userId: string,
  placement: PromoBannerPlacement = PROMO_BANNER_PLACEMENTS.DASHBOARD_HOME
): Promise<PromoBannerViewModel[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      createdAt: true,
      subscriptionEnd: true,
    },
  })

  if (!user) return []

  const banners = await prisma.promoBanner.findMany({
    where: {
      placement,
      isActive: true,
    },
    include: {
      interactions: {
        where: { userId },
        include: {
          activationCode: true,
        },
        take: 1,
      },
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  })

  return banners
    .filter((banner) => isUserEligibleForPromoBanner(banner, user, banner.interactions[0]))
    .map(toPromoBannerViewModel)
}
