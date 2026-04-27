import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { isPremium } from '@/lib/utils'
import { validateBody, withErrorHandling } from '@/lib/api-handler'
import { FitMutationSchema } from '@/lib/schemas'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { normalizeEditorModules, type FitMutationInput } from '@/lib/fits/fitting-validation-service'
import { fittingServiceMutate } from '@/lib/fits-v2/fitting-service-v2'
import { extractRuleRejections } from '@/lib/fits/rule-rejection'
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

  const envelope = await fittingServiceMutate(base)
  const ruleRejections = extractRuleRejections(envelope.errors, envelope.slotErrors)

  if (!envelope.stats) {
    const status = envelope.errors.some((e) => e.includes('not found')) ? 404 : 422
    logger.info('Fitting', 'v2 mutate rejected', {
      action: body.action,
      shipTypeId: body.shipTypeId,
      status,
      errors: envelope.errors,
      ruleRejections,
    })
    return NextResponse.json(envelope, { status })
  }

  if (!envelope.success) {
    logger.info('Fitting', 'v2 mutate invalid fit state', {
      action: body.action,
      shipTypeId: body.shipTypeId,
      errors: envelope.errors,
      ruleRejections,
    })
  }

  return NextResponse.json(envelope)
})
