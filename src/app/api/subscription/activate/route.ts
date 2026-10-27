import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  ACTIVATION_CODE_TYPES,
  resolveSubscriptionEndFromCodeType,
} from '@/lib/activation-codes'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PULALEEROY_CORP_ID = 98651213

const activateSchema = z.object({
  code: z.string().min(1, 'Code is required')
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { code } = await validateBody(request, activateSchema)

  const activationCode = await prisma.activationCode.findUnique({
    where: { code: code.toUpperCase() },
  })

  if (!activationCode) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Invalid or non-existent code', 404)
  }

  if (activationCode.isUsed) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'This code has already been used', 400)
  }

  // Check if user has any character from PulaLeeroy corporation
  const userCharacters = await prisma.character.findMany({
    where: { userId: user.id }
  })

  const isPulaLeeroyMember = userCharacters.some(char => char.corporationId === PULALEEROY_CORP_ID)

  // Handle PL8R special codes (PulaLeeroy lifetime codes)
  if (activationCode.type === ACTIVATION_CODE_TYPES.PL8R) {
    // PL8R codes are minted for a specific PulaLeeroy member (usedById is set at
    // generation time, before redemption) and must not be transferable to anyone
    // else, nor redeemable by someone who has since left the corporation.
    if (activationCode.usedById && activationCode.usedById !== user.id) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'This code was issued to a different account', 403)
    }
    if (!isPulaLeeroyMember) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'Code exclusively for PulaLeeroy members', 403)
    }

    const newEnd = new Date('2099-12-31T23:59:59Z')

    await redeemActivationCode(activationCode.id, user.id, () => ({ subscriptionEnd: newEnd }))

    return {
      success: true,
      subscriptionEnd: newEnd,
      type: ACTIVATION_CODE_TYPES.LIFETIME,
      isPulaLeeroy: isPulaLeeroyMember
    }
  }

  const redeemed = await redeemActivationCode(activationCode.id, user.id, (freshUser) => ({
    subscriptionEnd: resolveSubscriptionEndFromCodeType(
      activationCode.type,
      freshUser.subscriptionEnd ? new Date(freshUser.subscriptionEnd) : null
    ),
  }))

  return {
    success: true,
    subscriptionEnd: redeemed.subscriptionEnd,
    type: activationCode.type,
    isPulaLeeroy: isPulaLeeroyMember
  }
})

/**
 * Redeems an activation code atomically: the `isUsed: false` guard on the update
 * prevents two concurrent requests from both redeeming the same code (TOCTOU — the
 * earlier code only checked `isUsed` on read, not on write), and re-reading the user's
 * subscriptionEnd inside the transaction (rather than using the value read before this
 * call) prevents two codes redeemed at nearly the same time from both computing the
 * new end from the same stale base and one silently overwriting the other's days.
 */
async function redeemActivationCode(
  codeId: string,
  userId: string,
  computeUpdate: (freshUser: { subscriptionEnd: Date | null }) => { subscriptionEnd: Date }
): Promise<{ subscriptionEnd: Date }> {
  return prisma.$transaction(async (tx) => {
    const freshUser = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionEnd: true },
    })

    const update = computeUpdate(freshUser)

    const result = await tx.activationCode.updateMany({
      where: { id: codeId, isUsed: false },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedById: userId,
      },
    })

    if (result.count === 0) {
      throw new AppError(ErrorCodes.VALIDATION_FAILED, 'This code has already been used', 400)
    }

    await tx.user.update({
      where: { id: userId },
      data: { subscriptionEnd: update.subscriptionEnd },
    })

    return update
  })
}
