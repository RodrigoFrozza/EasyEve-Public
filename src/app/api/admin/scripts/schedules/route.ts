import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { SCRIPT_REGISTRY } from '@/lib/scripts/registry'

function calculateNextRun(interval: string | null, cron: string | null | undefined): Date {
  const now = new Date()
  
  if (!interval || interval === 'null') {
    interval = 'daily'
  }
  
  if (interval === '15m' || interval === 'every15m') {
    return new Date(now.getTime() + 15 * 60 * 1000)
  }
  
  if (interval === 'hourly') {
    return new Date(now.getTime() + 60 * 60 * 1000)
  }
  
  if (interval === 'daily') {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000)
  }
  
  if (interval === 'weekly') {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  
  if (interval === 'monthly') {
    const next = new Date(now)
    next.setMonth(next.getMonth() + 1)
    return next
  }
  
  return new Date(now.getTime() + 24 * 60 * 60 * 1000)
}

// GET /api/admin/scripts/schedules - List all schedules
export async function GET() {
  try {
    const schedules = await prisma.scriptSchedule.findMany({
      orderBy: { nextRunAt: 'asc' }
    })
    return NextResponse.json(schedules)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

// POST /api/admin/scripts/schedules - Create a new schedule
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { scriptId, interval, cron, params, dryRun, enabled, active, name } = body

    if (!scriptId || !SCRIPT_REGISTRY[scriptId as keyof typeof SCRIPT_REGISTRY]) {
      return NextResponse.json({ error: 'Invalid scriptId' }, { status: 400 })
    }

    const isActive = active !== undefined ? active : (enabled ?? true)
    const nextRunAt = calculateNextRun(interval, cron)

    const schedule = await prisma.scriptSchedule.create({
      data: {
        scriptId,
        name: name || scriptId,
        interval: interval || 'daily',
        cron: cron || undefined,
        params: params ? params : undefined,
        dryRun: dryRun ?? false,
        active: isActive,
        nextRunAt,
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Failed to create schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
