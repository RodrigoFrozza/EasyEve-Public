import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'

export const dynamic = 'force-dynamic'

async function getAttributes(req: Request) {
  const { searchParams } = new URL(req.url)
  const shipTypeId = searchParams.get('shipTypeId')
  const moduleTypeId = searchParams.get('moduleTypeId')
  const attributeId = searchParams.get('attributeId')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')

  if (shipTypeId) {
    const where: any = { shipTypeId: parseInt(shipTypeId) }
    if (attributeId) where.attributeId = parseInt(attributeId)
    
    const attrs = await prisma.shipDogmaAttribute.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { attributeId: 'asc' }
    })
    return { data: attrs }
  }

  if (moduleTypeId) {
    const where: any = { moduleTypeId: parseInt(moduleTypeId) }
    if (attributeId) where.attributeId = parseInt(attributeId)

    const attrs = await prisma.moduleDogmaAttribute.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { attributeId: 'asc' }
    })
    return { data: attrs }
  }

  // If no specific target, return a error or a list of unique attribute definitions we know
  // But since we don't have a definitions table, we'll return an error or require a target
  return { 
    error: 'Missing shipTypeId or moduleTypeId parameter',
    message: 'To list attributes, you must specify a target ship or module type ID.'
  }
}

export const GET = withErrorHandling(withExternalAuth(getAttributes))
