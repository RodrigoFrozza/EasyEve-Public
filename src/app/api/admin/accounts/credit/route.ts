import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  ACTIVATION_CODE_TYPES,
  generateActivationCode,
  resolveSubscriptionEndFromCodeType,
} from '@/lib/activation-codes'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/accounts/credit
 * Generates and automatically applies a premium code to a user account.
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request, adminUser) => {
  const body = await request.json()
  const { userId, days, type } = body

  if (!userId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'User ID is required', 400)
  }

  // Validate User exists
  const targetUser = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!targetUser) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'User not found', 404)
  }

  // Map the input to a code type
  // If type is PL8R, duration is LIFETIME
  // Otherwise, we'll use a virtual type for calculation or just use the days
  let codeType = type
  if (type === 'PL8R') {
    codeType = ACTIVATION_CODE_TYPES.PL8R
  } else if (days) {
    codeType = `DAYS_${days}`
  }

  // Verify code type is valid for duration resolution
  if (![
    ACTIVATION_CODE_TYPES.DAYS_7,
    ACTIVATION_CODE_TYPES.DAYS_15,
    ACTIVATION_CODE_TYPES.DAYS_30,
    ACTIVATION_CODE_TYPES.DAYS_60,
    ACTIVATION_CODE_TYPES.DAYS_90,
    ACTIVATION_CODE_TYPES.LIFETIME,
    ACTIVATION_CODE_TYPES.PL8R,
  ].includes(codeType)) {
    // Fallback or default if not exactly matched
    if (days) {
       codeType = `DAYS_${days}`
    } else {
       throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid duration or type', 400)
    }
  }

  const newSubscriptionEnd = resolveSubscriptionEndFromCodeType(
    codeType,
    targetUser.subscriptionEnd
  )

  const generatedCode = generateActivationCode()

  // Execute in transaction
  const [createdCode, updatedUser] = await prisma.$transaction([
    // 1. Create the code
    prisma.activationCode.create({
      data: {
        code: generatedCode,
        type: type, // Store the user-selected type (PL8R, Premium, Promo_code)
        createdById: adminUser.id,
        isUsed: true,
        usedAt: new Date(),
        usedById: targetUser.id,
      }
    }),
    // 2. Update the user
    prisma.user.update({
      where: { id: targetUser.id },
      data: {
        subscriptionEnd: newSubscriptionEnd
      }
    })
  ])

  return {
    success: true,
    code: generatedCode,
    subscriptionEnd: updatedUser.subscriptionEnd,
  }
}))
