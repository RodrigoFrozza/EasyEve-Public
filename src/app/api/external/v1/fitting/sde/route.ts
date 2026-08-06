import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withExternalAuth } from '@/lib/external-auth'

export const dynamic = 'force-dynamic'

async function getSdeData(req: Request) {
  const { searchParams } = new URL(req.url)
  const resource = searchParams.get('resource') // 'types' | 'groups' | 'categories'
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
  const offset = parseInt(searchParams.get('offset') || '0')
  const id = searchParams.get('id')

  if (!resource) {
    return {
      error: 'Missing resource parameter',
      availableResources: ['types', 'groups', 'categories']
    }
  }

  let data = []
  let total = 0

  switch (resource) {
    case 'types':
      const typeWhere = id ? { id: parseInt(id) } : {}
      data = await prisma.eveType.findMany({ 
        where: typeWhere,
        take: limit, 
        skip: offset,
        orderBy: { name: 'asc' }
      })
      total = await prisma.eveType.count({ where: typeWhere })
      break
    case 'groups':
      const groupWhere = id ? { id: parseInt(id) } : {}
      data = await prisma.eveGroup.findMany({ 
        where: groupWhere,
        take: limit, 
        skip: offset,
        orderBy: { name: 'asc' }
      })
      total = await prisma.eveGroup.count({ where: groupWhere })
      break
    case 'categories':
      const catWhere = id ? { id: parseInt(id) } : {}
      data = await prisma.eveCategory.findMany({ 
        where: catWhere,
        take: limit, 
        skip: offset,
        orderBy: { name: 'asc' }
      })
      total = await prisma.eveCategory.count({ where: catWhere })
      break
    default:
      return { error: 'Invalid resource. Use types, groups or categories.' }
  }

  return {
    data,
    pagination: {
      total,
      limit,
      offset
    }
  }
}

export const GET = withErrorHandling(withExternalAuth(getSdeData))
