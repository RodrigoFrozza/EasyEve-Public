import { NextResponse } from 'next/server'
import { processScheduledScripts } from '@/lib/scripts/scheduler'

// GET /api/admin/scripts/scheduler/trigger
// This route should be called by a CRON job (e.g., Vercel Cron, GitHub Actions)
export async function GET(req: Request) {
  try {
    // Security check: Verify a secret token to prevent unauthorized triggers
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    
    if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await processScheduledScripts()
    
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
