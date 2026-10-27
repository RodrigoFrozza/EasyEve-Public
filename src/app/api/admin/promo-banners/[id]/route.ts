import { prisma } from '@/lib/prisma'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  buildPromoBannerWriteData,
  promoBannerInputSchema,
} from '@/lib/promo-banners'

export const dynamic = 'force-dynamic'

export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, _user, context) => {
  const bannerId = context?.params?.id

  if (!bannerId || typeof bannerId !== 'string') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Promo banner id is required', 400)
  }

  const input = await validateBody(request, promoBannerInputSchema)
  const data = buildPromoBannerWriteData(input)

  const updatedBanner = await prisma.promoBanner.update({
    where: { id: bannerId },
    data,
  })

  return updatedBanner
}))

export const DELETE = withErrorHandling(withAuth({ requiredRole: 'master' }, async (_request, _user, context) => {
  const bannerId = context?.params?.id

  if (!bannerId || typeof bannerId !== 'string') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Promo banner id is required', 400)
  }

  const existingBanner = await prisma.promoBanner.findUnique({
    where: { id: bannerId },
    select: { id: true },
  })

  if (!existingBanner) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Promo banner not found', 404)
  }

  await prisma.promoBanner.delete({
    where: { id: bannerId },
  })

  return {
    success: true,
  }
}))
