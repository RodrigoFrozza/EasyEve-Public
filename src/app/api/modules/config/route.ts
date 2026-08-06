import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyJWT } from '@/lib/auth-jwt'
import {
  ensurePlatformModuleRows,
  buildOrderedModulePublicConfig,
} from '@/lib/admin/platform-modules-registry'

export const dynamic = 'force-dynamic'

/**
 * GET /api/modules/config
 * Public (authenticated) endpoint to get system module availability statuses.
 */
export async function GET(request: Request) {
  try {
    // Optional: add minimal auth check
    const cookieHeader = request.headers.get('cookie')
    const sessionToken = cookieHeader?.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1]

    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyJWT(sessionToken)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await ensurePlatformModuleRows(prisma)

    const rows = await prisma.modulePrice.findMany({
      select: {
        module: true,
        isActive: true,
      },
    })

    return NextResponse.json(buildOrderedModulePublicConfig(rows))
  } catch (error) {
    console.error('[Module Config API] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
