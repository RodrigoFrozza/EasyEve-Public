import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { normalizeFitsV2RequestBody } from '@/lib/fits-v2/state-normalizer-v2'
import { fittingServiceRecommend } from '@/lib/fits-v2/fitting-service-v2'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, code: FitsV2Codes.UNAUTHORIZED, error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, code: FitsV2Codes.INVALID_BODY, error: 'Invalid JSON body' }, { status: 400 })
  }

  const normalized = normalizeFitsV2RequestBody(body)
  if (!normalized) {
    return NextResponse.json({ success: false, code: FitsV2Codes.INVALID_BODY, error: 'shipTypeId is required and must be a positive number' }, { status: 400 })
  }

  const result = await fittingServiceRecommend({
    shipTypeId: normalized.shipTypeId,
    modules: normalized.modules,
    drones: normalized.drones,
    cargo: normalized.cargo,
    userId: user.id,
  })
  return NextResponse.json(result)
}
