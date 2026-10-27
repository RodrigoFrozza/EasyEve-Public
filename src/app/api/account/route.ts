import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { generateAccountCode } from '@/lib/account-code'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accountCode: true }
  })
  
  return NextResponse.json({ accountCode: userData?.accountCode })
})

export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  
  const newCode = generateAccountCode()
  
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { accountCode: newCode }
  })
  
  return NextResponse.json({ accountCode: updated.accountCode })
})
