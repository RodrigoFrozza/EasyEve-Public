export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'

/**
 * GET /api/account/data/export - Export user data as a JSON file
 */
export const GET = withErrorHandling(withAuth(async (request, user) => {
  // Fetch only necessary fields for activities to reduce memory
  const activities = await prisma.activity.findMany({
    where: { userId: user.id },
    select: {
      id: true, type: true, status: true, startTime: true, endTime: true,
      region: true, space: true, typeId: true, data: true,
      createdAt: true, updatedAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10000 // Limit to prevent OOM
  })

  // Fetch only necessary fields for fits
  const fits = await prisma.fit.findMany({
    where: { userId: user.id },
    select: {
      id: true, name: true, shipTypeId: true, modules: true,
      createdAt: true, updatedAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10000
  })

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
    },
    data: {
      activities,
      fits
    }
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=easyeve-data-${user.id}-${new Date().getTime()}.json`,
    },
  })
}))
