import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { isPremium } from '@/lib/utils'
import { validateBody, withErrorHandling } from '@/lib/api-handler'
import { FitMutationSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  applyFitMutation,
  normalizeEditorModules,
  type FitMutationInput,
} from '@/lib/fits/fitting-validation-service'
import { logger } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  if (!isPremium(user.subscriptionEnd)) {
    throw new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Fit Management is a Premium feature.', 403)
  }

  const body = await validateBody(request, FitMutationSchema)
  const modules = normalizeEditorModules(body.modules as unknown[])

  const base: FitMutationInput = {
    action: body.action,
    shipTypeId: body.shipTypeId,
    modules,
    drones: body.drones ?? [],
    cargo: body.cargo ?? [],
    userId: user.id,
    characterId: body.characterId ?? undefined,
    skillProfile: body.skillProfile ?? undefined,
  }
  if (body.action === 'fitModule' || body.action === 'replaceModule') {
    base.slot = body.slot
    base.slotIndex = body.slotIndex
    base.module = body.module
  } else if (body.action === 'unfitModule') {
    base.slot = body.slot
    base.slotIndex = body.slotIndex
  } else if (body.action === 'setCharge') {
    base.slot = body.slot
    base.slotIndex = body.slotIndex
    base.charge = body.charge
  }

  const result = await applyFitMutation(base)

  if (!result.stats) {
    const status = result.errors.some((e) => e.includes('not found')) ? 404 : 422
    logger.info('Fitting', 'mutate rejected', {
      action: body.action,
      shipTypeId: body.shipTypeId,
      status,
      errors: result.errors,
    })
    return NextResponse.json(
      {
        success: false,
        errors: result.errors,
        slotErrors: result.slotErrors,
        modules: result.modules,
        drones: result.drones,
        cargo: result.cargo,
      },
      { status }
    )
  }

  if (!result.success) {
    logger.info('Fitting', 'mutate invalid fit state', {
      action: body.action,
      shipTypeId: body.shipTypeId,
      errors: result.errors,
    })
  }

  return NextResponse.json({
    success: result.success,
    modules: result.modules,
    drones: result.drones,
    cargo: result.cargo,
    stats: result.stats,
    errors: result.errors,
    slotErrors: result.slotErrors,
  })
})
