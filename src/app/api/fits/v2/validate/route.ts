import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { normalizeFitsV2RequestBody } from '@/lib/fits-v2/state-normalizer-v2'
import { fittingServiceValidate } from '@/lib/fits-v2/fitting-service-v2'
import { extractRuleRejections } from '@/lib/fits/rule-rejection'
import { logger } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      {
        success: false,
        code: FitsV2Codes.UNAUTHORIZED,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Unauthorized'],
        slotErrors: {},
      },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      {
        success: false,
        code: FitsV2Codes.INVALID_BODY,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Invalid JSON body'],
        slotErrors: {},
      },
      { status: 400 }
    )
  }

  const normalized = normalizeFitsV2RequestBody(body)
  if (!normalized) {
    return NextResponse.json(
      {
        success: false,
        code: FitsV2Codes.INVALID_BODY,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['shipTypeId is required and must be a positive number'],
        slotErrors: {},
      },
      { status: 400 }
    )
  }

  const envelope = await fittingServiceValidate({
    shipTypeId: normalized.shipTypeId,
    modules: normalized.modules,
    drones: normalized.drones,
    cargo: normalized.cargo,
    userId: user.id,
    characterId: normalized.characterId,
    skillProfile: normalized.skillProfile,
  })
  const ruleRejections = extractRuleRejections(envelope.errors, envelope.slotErrors)

  if (!envelope.stats) {
    const status = envelope.errors.some((e) => e.includes('not found') || e.includes('Ship hull')) ? 404 : 422
    logger.info('Fitting', 'v2 validate rejected', {
      shipTypeId: normalized.shipTypeId,
      status,
      errors: envelope.errors,
      ruleRejections,
    })
    return NextResponse.json(envelope, { status })
  }

  if (!envelope.success) {
    logger.info('Fitting', 'v2 validate invalid fit state', {
      shipTypeId: normalized.shipTypeId,
      errors: envelope.errors,
      ruleRejections,
    })
  }

  return NextResponse.json(envelope)
}
