import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { hasPremiumAccess } from '@/lib/utils'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { CreateFittingSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  // Check module availability
  const fitsModule = await prisma.modulePrice.findUnique({
    where: { module: 'fits' }
  })
  
  if (fitsModule && !fitsModule.isActive) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Fit Management is currently disabled by administrators.', 403)
  }

  // Allow viewing the list even if not premium; the restriction can be on creation/expanded editing.
  // But keeping the current app logic for now:
  if (!hasPremiumAccess({ subscriptionEnd: user.subscriptionEnd, isTester: user.isTester })) {
    return NextResponse.json([])
  }
  
  const fits = await prisma.fit.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' }
  })
  
  return NextResponse.json(fits || [])
})

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  // Check module availability
  const fitsModule = await prisma.modulePrice.findUnique({
    where: { module: 'fits' }
  })
  
  if (fitsModule && !fitsModule.isActive) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Fit Management is currently disabled by administrators.', 403)
  }

  if (!hasPremiumAccess({ subscriptionEnd: user.subscriptionEnd, isTester: user.isTester })) {
    throw new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Fit Management is a Premium feature.', 403)
  }
  
  const body = await validateBody(request, CreateFittingSchema)
  
  const fit = await prisma.fit.create({
    data: {
      name: body.name,
      description: body.description,
      ship: body.ship,
      shipTypeId: body.shipTypeId ?? undefined,
      modules: body.modules || [],
      drones: body.drones || [],
      cargo: body.cargo || [],
      tags: body.tags || [],
      visibility: body.visibility || 'PROTECTED',
      esiData: body.esiData || null,
      userId: user.id
    }
  })
  
  return NextResponse.json(fit)
})