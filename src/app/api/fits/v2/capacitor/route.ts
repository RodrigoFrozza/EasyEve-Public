import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { normalizeFitsV2RequestBody } from '@/lib/fits-v2/state-normalizer-v2'
import { fittingServiceCapacitor } from '@/lib/fits-v2/fitting-service-v2'

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
        capacitorSim: null,
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
        capacitorSim: null,
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
        capacitorSim: null,
      },
      { status: 400 }
    )
  }

  const envelope = await fittingServiceCapacitor({
    shipTypeId: normalized.shipTypeId,
    modules: normalized.modules,
    drones: normalized.drones,
    cargo: normalized.cargo,
    userId: user.id,
    characterId: normalized.characterId,
    skillProfile: normalized.skillProfile,
  })

  if (!envelope.stats) {
    const status = envelope.errors.some((e) => e.includes('not found') || e.includes('Ship hull')) ? 404 : 422
    return NextResponse.json(envelope, { status })
  }

  return NextResponse.json(envelope)
}
