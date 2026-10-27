import { NextResponse } from 'next/server'
import { checkHealth } from '@/lib/health'

export const dynamic = 'force-dynamic'

/** GET /api/health — see checkHealth (src/lib/health.ts). Public on purpose. */
export async function GET() {
  const { status, body } = await checkHealth()
  return NextResponse.json(body, { status })
}
