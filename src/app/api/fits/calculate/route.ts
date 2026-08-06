import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import {
  normalizeEditorModules,
  validateFittingState,
} from '@/lib/fits/fitting-validation-service'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { shipTypeId, modules, drones, cargo, characterId, skillProfile } = body

    if (!shipTypeId) {
      return NextResponse.json({ error: 'shipTypeId is required' }, { status: 400 })
    }

    const normalizedModules = normalizeEditorModules(modules || [])

    const result = await validateFittingState({
      shipTypeId,
      modules: normalizedModules,
      drones: drones || [],
      cargo: cargo || [],
      userId: user.id,
      characterId: characterId ?? undefined,
      skillProfile: skillProfile ?? undefined,
    })

    if (!result.stats) {
      const status = result.errors.some((e) => e.includes('not found')) ? 404 : 422
      return NextResponse.json(
        { errors: result.errors, slotErrors: result.slotErrors },
        { status }
      )
    }

    return NextResponse.json(result.stats)
  } catch (error) {
    console.error('Fit calculation error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
