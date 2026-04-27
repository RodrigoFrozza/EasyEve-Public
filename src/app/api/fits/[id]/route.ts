import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { isPremium } from '@/lib/utils'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { CreateFittingSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  const { id } = await params
  
  // Find fit without user restriction first to check visibility
  const fit = await prisma.fit.findUnique({
    where: { id }
  })
  
  if (!fit) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Fit not found', 404)
  }

  // Access Control: Public fits are open to everyone. Protected fits need owner.
  if (fit.visibility !== 'PUBLIC') {
    if (!user || (fit.userId !== user.id)) {
      throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized or Private Fit', 401)
    }

    if (!isPremium(user.subscriptionEnd)) {
      throw new AppError(ErrorCodes.API_FORBIDDEN, 'Fit Management is a Premium feature.', 403)
    }
  }
  
  return fit
})

export const PUT = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  if (!isPremium(user.subscriptionEnd)) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Fit Management is a Premium feature.', 403)
  }
  
  const { id } = await params
  const body = await validateBody(request, CreateFittingSchema.partial())
  
  const existing = await prisma.fit.findFirst({
    where: { id, userId: user.id }
  })
  
  if (!existing) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Fit not found or you do not have permission.', 404)
  }
  
  const fit = await prisma.fit.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      description: body.description ?? undefined,
      ship: body.ship ?? undefined,
      shipTypeId: body.shipTypeId ?? undefined,
      modules: body.modules ?? undefined,
      drones: body.drones ?? undefined,
      cargo: body.cargo ?? undefined,
      tags: body.tags ?? undefined,
      visibility: body.visibility ?? undefined,
      esiData: body.esiData ?? undefined,
    }
  })
  
  return fit
})

export const DELETE = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  
  const { id } = await params
  
  const existing = await prisma.fit.findFirst({
    where: { id, userId: user.id }
  })
  
  if (!existing) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Fit not found', 404)
  }
  
  await prisma.fit.delete({
    where: { id }
  })
  
  return { success: true }
})
