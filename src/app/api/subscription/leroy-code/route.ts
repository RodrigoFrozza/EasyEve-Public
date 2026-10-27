import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { ACTIVATION_CODE_TYPES, generatePrefixedActivationCode } from '@/lib/activation-codes'

export const dynamic = 'force-dynamic'

const PULALEEROY_CORP_ID = 98651213

function generateUniqueCode(): string {
  return generatePrefixedActivationCode('PL8R')
}

export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  // Check if user has any character from PulaLeeroy corporation
  const userCharacters = await prisma.character.findMany({
    where: { userId: user.id }
  })

  const isPulaLeeroyMember = userCharacters.some(char => char.corporationId === PULALEEROY_CORP_ID)

  if (!isPulaLeeroyMember) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Code exclusively for PulaLeeroy members', 403)
  }

  // A PL8R code is a lifetime-premium grant — cap it at one per member ever (used or
  // not), otherwise a single member could keep minting fresh codes indefinitely and
  // hand them out to non-members (each redeemable per the activate-route ownership
  // check, but still an unbounded number of free lifetime grants without this cap).
  const existingCode = await prisma.activationCode.findFirst({
    where: {
      code: { startsWith: 'PL8R-' },
      usedById: user.id,
    }
  })

  if (existingCode) {
    if (!existingCode.isUsed) {
      return {
        code: existingCode.code
      }
    }
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'You have already redeemed your PulaLeeroy lifetime code', 400)
  }

  // Generate new unique code
  let newCode: string
  let attempts = 0
  const maxAttempts = 10

  do {
    newCode = generateUniqueCode()
    const existing = await prisma.activationCode.findUnique({
      where: { code: newCode }
    })
    if (!existing) break
    attempts++
  } while (attempts < maxAttempts)

  // Create the code in database
  const createdCode = await prisma.activationCode.create({
    data: {
      code: newCode,
      type: ACTIVATION_CODE_TYPES.PL8R,
      usedById: user.id
    }
  })

  return {
    code: createdCode.code
  }
})
