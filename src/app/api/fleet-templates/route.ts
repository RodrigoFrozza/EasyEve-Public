export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { isPremium } from '@/lib/utils'
import { logger } from '@/lib/server-logger'
import { z } from 'zod'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  activityType: z.string().min(1, 'Activity type is required'),
  participants: z.array(z.object({
    characterId: z.number()
  })).min(1, 'At least one participant is required')
})

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  activityType: z.string().min(1, 'Activity type is required').optional(),
  participants: z.array(z.object({
    characterId: z.number()
  })).min(1, 'At least one participant is required').optional()
})

export async function GET() {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const templates = await prisma.fleetTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(templates)
}

export async function POST(request: Request) {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hasPremium = isPremium(session.user.subscriptionEnd)
  if (!hasPremium) {
    return NextResponse.json(
      { error: 'Fleet Templates is a Premium feature' },
      { status: 403 }
    )
  }

  const existingCount = await prisma.fleetTemplate.count({
    where: { userId: session.user.id }
  })

  if (existingCount >= 10) {
    return NextResponse.json(
      { error: 'Maximum of 10 templates allowed' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const parsed = createTemplateSchema.parse(body)

    const existingWithName = await prisma.fleetTemplate.findFirst({
      where: { userId: session.user.id, name: parsed.name }
    })

    if (existingWithName) {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 400 }
      )
    }

    const template = await prisma.fleetTemplate.create({
      data: {
        userId: session.user.id,
        name: parsed.name,
        activityType: parsed.activityType,
        participants: parsed.participants
      }
    })

    logger.info('FLEET_TEMPLATE', `User ${session.user.id} created template "${parsed.name}"`)

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      )
    }
    
    logger.error('FLEET_TEMPLATE', 'Failed to create template', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}