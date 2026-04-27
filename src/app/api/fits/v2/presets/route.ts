import { NextResponse } from 'next/server'
import { fittingServicePresets } from '@/lib/fits-v2/fitting-service-v2'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(fittingServicePresets())
}
