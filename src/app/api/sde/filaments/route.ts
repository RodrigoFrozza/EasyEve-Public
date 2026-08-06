import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getFilamentTypes, getTierLabel } from '@/lib/sde/filaments'

export async function GET() {
  try {
    const filaments = await getFilamentTypes()
    
    const formatted = filaments.map(f => ({
      id: f.id,
      name: f.name,
      tier: f.tier,
      tierLabel: getTierLabel(f.tier),
      weather: f.weather,
      effect: f.effect,
      displayName: `${getTierLabel(f.tier)} ${f.effect.charAt(0).toUpperCase() + f.effect.slice(1)}`,
    }))
    
    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Failed to fetch filament types:', error)
    return NextResponse.json({ error: 'Failed to fetch filament types' }, { status: 500 })
  }
}
