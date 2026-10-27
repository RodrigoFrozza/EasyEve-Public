import { NextResponse } from 'next/server'
import { processScheduledScripts } from '@/lib/scripts/scheduler'
import { cronSecretMatches } from '@/lib/admin-cron-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/scripts/scheduler/trigger
// This route should be called by a CRON job (e.g., Vercel Cron, GitHub Actions)
export async function GET(req: Request) {
  try {
    // Security check: Verify a secret token to prevent unauthorized triggers.
    // Prefer `Authorization: Bearer <CRON_SECRET>` over the legacy `?token=` query
    // string, which leaks the secret into access/proxy logs.
    if (!cronSecretMatches(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await processScheduledScripts('external')
    
    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results
    })
  } catch (error) {
    console.error('Scheduler trigger failed:', error)
    return NextResponse.json({ error: 'Scheduler internal error' }, { status: 500 })
  }
}
