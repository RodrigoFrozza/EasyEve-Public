import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function calculateNextRun(interval: string | null | undefined, cron: string | null | undefined): Date {
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

// PATCH /api/admin/scripts/schedules/[id] - Update a schedule
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await req.json()
    const { interval, cron, params: scriptParams, dryRun, enabled, active, name } = body

    const isActive = active !== undefined ? active : (enabled ?? undefined)
    
    // Normalize interval: convert empty string to undefined
    const normalizedInterval = interval === '' || interval === null ? undefined : interval
    const normalizedCron = cron === '' || cron === null ? undefined : cron
    
    const updateData: Record<string, unknown> = {
      interval: normalizedInterval,
      cron: normalizedCron,
      params: scriptParams ? scriptParams : undefined,
      dryRun,
    }
    
    if (isActive !== undefined) {
      updateData.active = isActive
    }
    
    if (name !== undefined) {
      updateData.name = name
    }
    
    // Recalculate nextRunAt when interval or cron changes
    if (normalizedInterval !== undefined || normalizedCron !== undefined) {
      updateData.nextRunAt = calculateNextRun(normalizedInterval, normalizedCron)
    }

    const schedule = await prisma.scriptSchedule.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(schedule)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

// DELETE /api/admin/scripts/schedules/[id] - Delete a schedule
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    await prisma.scriptSchedule.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
