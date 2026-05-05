import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(withAuth(async (_request, user, context) => {
  const bannerId = context?.params?.id

  if (!bannerId || typeof bannerId !== 'string') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Promo banner id is required', 400)
  }

  const banner = await prisma.promoBanner.findUnique({
    where: { id: bannerId },
    select: {
      id: true,
      dismissible: true,
    },
  })

  if (!banner) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Promo banner not found', 404)
  }

  if (!banner.dismissible) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'This promo banner cannot be dismissed', 403)
  }

  await prisma.promoBannerInteraction.upsert({
    where: {
      bannerId_userId: {
        bannerId: banner.id,
        userId: user.id,
      },
    },
    update: {
      dismissedAt: new Date(),
    },
    create: {
      bannerId: banner.id,
      userId: user.id,
      dismissedAt: new Date(),
    },
  })

  return {
    success: true,
  }
}))
