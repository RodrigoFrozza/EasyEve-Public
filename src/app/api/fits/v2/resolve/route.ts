import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { hasPremiumAccess } from '@/lib/utils'
import { FitsV2Codes } from '@/lib/fits-v2/errors-v2'
import { fittingServiceResolveEft } from '@/lib/fits-v2/fitting-service-v2'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
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

  if (!hasPremiumAccess({ subscriptionEnd: user.subscriptionEnd, isTester: user.isTester })) {
    return NextResponse.json(
      {
        success: false,
        code: FitsV2Codes.PREMIUM_REQUIRED,
        state: { shipTypeId: 0, modules: [], drones: [], cargo: [] },
        stats: null,
        errors: ['Fit Management is a Premium feature.'],
        slotErrors: {},
      },
      { status: 403 }
    )
  }

  let eft: string
  try {
    const json = (await req.json()) as { eft?: string }
    eft = typeof json.eft === 'string' ? json.eft : ''
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

  const outcome = await fittingServiceResolveEft({ eft, userId: user.id })
  return NextResponse.json(outcome.response, { status: outcome.ok ? 200 : outcome.httpStatus })
}
