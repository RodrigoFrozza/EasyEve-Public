export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { isPremium } from '@/lib/utils'
import { logger } from '@/lib/server-logger'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  activityType: z.string().min(1, 'Activity type is required').optional(),
  participants: z.array(z.object({
    characterId: z.number()
  })).min(1, 'At least one participant is required').optional()
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const templateId = params.id

  const existingTemplate = await prisma.fleetTemplate.findFirst({
    where: { id: templateId, userId: session.user.id }
  })

  if (!existingTemplate) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    )
  }

  try {
    const body = await request.json()
    const parsed = updateTemplateSchema.parse(body)

    if (parsed.name && parsed.name !== existingTemplate.name) {
      const existingWithName = await prisma.fleetTemplate.findFirst({
        where: { userId: session.user.id, name: parsed.name, id: { not: templateId } }
      })

      if (existingWithName) {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 400 }
        )
      }
    }

    const template = await prisma.fleetTemplate.update({
      where: { id: templateId },
      data: {
        ...(parsed.name && { name: parsed.name }),
        ...(parsed.activityType && { activityType: parsed.activityType }),
        ...(parsed.participants && { participants: parsed.participants })
      }
    })

    logger.info('FLEET_TEMPLATE', `User ${session.user.id} updated template "${template.name}"`)

    return NextResponse.json(template)
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      )
    }
    
    logger.error('FLEET_TEMPLATE', 'Failed to update template', error)
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const templateId = params.id

  const existingTemplate = await prisma.fleetTemplate.findFirst({
    where: { id: templateId, userId: session.user.id }
  })

  if (!existingTemplate) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    )
  }

  await prisma.fleetTemplate.delete({
    where: { id: templateId }
  })

  logger.info('FLEET_TEMPLATE', `User ${session.user.id} deleted template "${existingTemplate.name}"`)

  return NextResponse.json({ success: true })
}