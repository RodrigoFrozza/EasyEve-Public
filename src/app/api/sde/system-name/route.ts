import { NextResponse } from 'next/server'
import { getSolarSystemName } from '@/lib/sde'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('systemId')

    if (!systemId) {
      return NextResponse.json({ error: 'systemId required' }, { status: 400 })
    }

    const name = await getSolarSystemName(parseInt(systemId, 10))
    return NextResponse.json({ name })
  } catch (error) {
    console.error('Error getting system name:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
