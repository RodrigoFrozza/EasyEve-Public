import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { normalizeFitsV2RequestBody } from '@/lib/fits-v2/state-normalizer-v2'
import { fittingServiceCompare } from '@/lib/fits-v2/fitting-service-v2'

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

  const leftRaw = body.left && typeof body.left === 'object' ? (body.left as Record<string, unknown>) : null
  const rightRaw = body.right && typeof body.right === 'object' ? (body.right as Record<string, unknown>) : null
  if (!leftRaw || !rightRaw) {
    return NextResponse.json({ success: false, code: FitsV2Codes.INVALID_BODY, error: 'left and right fit payloads are required' }, { status: 400 })
  }

  const left = normalizeFitsV2RequestBody(leftRaw)
  const right = normalizeFitsV2RequestBody(rightRaw)
  if (!left || !right) {
    return NextResponse.json({ success: false, code: FitsV2Codes.INVALID_BODY, error: 'Both left and right shipTypeId values must be valid' }, { status: 400 })
  }

  const result = await fittingServiceCompare({
    left: { shipTypeId: left.shipTypeId, modules: left.modules, drones: left.drones, cargo: left.cargo },
    right: { shipTypeId: right.shipTypeId, modules: right.modules, drones: right.drones, cargo: right.cargo },
    userId: user.id,
  })

  return NextResponse.json(result)
}
