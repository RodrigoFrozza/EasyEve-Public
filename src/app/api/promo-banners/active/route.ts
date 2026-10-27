import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { getEligiblePromoBannerViewsForUser } from '@/lib/promo-banner-service'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(withAuth(async (_request, user) => {
  const banners = await getEligiblePromoBannerViewsForUser(user.id)

  return {
    items: banners,
  }
}))
