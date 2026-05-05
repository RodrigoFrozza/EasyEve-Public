import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { hasPremiumAccess } from '@/lib/utils'
import { FitParser } from '@/lib/fits/fit-parser'
import { FitResolver } from '@/lib/fits/fit-resolver'
import { validateFittingState } from '@/lib/fits/fitting-validation-service'
import type { Module } from '@/types/fit'

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    if (!hasPremiumAccess({ subscriptionEnd: user.subscriptionEnd, isTester: user.isTester })) {
      return new NextResponse('Premium required', { status: 403 })
    }

    const { eft } = await req.json()
    if (!eft) {
      return new NextResponse('Missing EFT string', { status: 400 })
    }

    const parsed = FitParser.parse(eft)[0] // Take first fit if multiple
    if (!parsed) {
      return new NextResponse('Invalid EFT format', { status: 400 })
    }

    const resolved = await FitResolver.resolve(parsed)

    const shipId = resolved.shipId
    if (!shipId) {
      return NextResponse.json({ error: 'Resolved fit missing ship id' }, { status: 422 })
    }

    const validation = await validateFittingState({
      shipTypeId: shipId,
      modules: (resolved.modules || []) as Module[],
      drones: resolved.drones || [],
      cargo: resolved.cargo || [],
      userId: user.id,
    })

    if (!validation.stats || !validation.success) {
      return NextResponse.json(
        {
          error: 'Imported fit failed authoritative validation',
          errors: validation.errors,
          slotErrors: validation.slotErrors,
          ...resolved,
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      ...resolved,
      esiData: validation.stats,
    })
  } catch (error: any) {
    console.error('[FITS_RESOLVE]', error)
    return new NextResponse(error.message || 'Internal Error', { status: 500 })
  }
}
