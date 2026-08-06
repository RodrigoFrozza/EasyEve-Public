import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { ACTIVATION_CODE_TYPES, generateActivationCode } from '@/lib/activation-codes'
import { isUserEligibleForPromoBanner } from '@/lib/promo-banners'

export const dynamic = 'force-dynamic'

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateActivationCode()
    const existingCode = await prisma.activationCode.findUnique({
      where: { code },
      select: { id: true },
    })

    if (!existingCode) return code
  }

  throw new AppError(ErrorCodes.API_SERVER_ERROR, 'Failed to generate a unique activation code', 500)
}

export const POST = withErrorHandling(withAuth(async (_request, user, context) => {
  const bannerId = context?.params?.id

  if (!bannerId || typeof bannerId !== 'string') {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Promo banner id is required', 400)
  }

  const banner = await prisma.promoBanner.findUnique({
    where: { id: bannerId },
    include: {
      interactions: {
        where: { userId: user.id },
        include: {
          activationCode: true,
        },
        take: 1,
      },
    },
  })

  if (!banner) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Promo banner not found', 404)
  }

  const interaction = banner.interactions[0]

  if (!isUserEligibleForPromoBanner(banner, user, interaction)) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'This promo banner is not available for your account', 403)
  }

  const existingCode = interaction?.activationCode

  if (existingCode && !existingCode.isUsed) {
    return {
      success: true,
      code: existingCode.code,
      alreadyGenerated: true,
      redeemPath: `/dashboard/subscription?promoCode=${encodeURIComponent(existingCode.code)}`,
      bannerId: banner.id,
    }
  }

  const code = await generateUniqueCode()
  const claimedAt = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const createdCode = await tx.activationCode.create({
      data: {
        code,
        type: ACTIVATION_CODE_TYPES.DAYS_7,
        createdBy: `Promo banner: ${banner.title}`,
      },
    })

    const createdInteraction = await tx.promoBannerInteraction.upsert({
      where: {
        bannerId_userId: {
          bannerId: banner.id,
          userId: user.id,
        },
      },
      update: {
        activationCodeId: createdCode.id,
        claimedAt,
        dismissedAt: null,
      },
      create: {
        bannerId: banner.id,
        userId: user.id,
        activationCodeId: createdCode.id,
        claimedAt,
      },
    })

    return {
      code: createdCode.code,
      interactionId: createdInteraction.id,
    }
  })

  return {
    success: true,
    code: result.code,
    alreadyGenerated: false,
    redeemPath: `/dashboard/subscription?promoCode=${encodeURIComponent(result.code)}`,
    bannerId: banner.id,
  }
}))
