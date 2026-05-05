import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { getResolvedFeatureFlags } from '@/lib/feature-flags'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async () => {
    return await getResolvedFeatureFlags()
  })
)

export const PATCH = withErrorHandling(
  withAuth({ requiredRole: 'master' }, async (request: Request, user) => {
    try {
      const body = await request.json() as { name: string; isEnabled: boolean }
      const { name, isEnabled } = body
      
      if (!name || typeof isEnabled !== 'boolean') {
        return Response.json({ error: 'Invalid request: name and isEnabled required' }, { status: 400 })
      }
      if (!(name in DEFAULT_FEATURE_FLAGS)) {
        return Response.json({ error: `Unknown flag: ${name}` }, { status: 400 })
      }
      
      const previous = await prisma.featureFlag.findUnique({
        where: { name },
      })
      const flag = await prisma.featureFlag.upsert({
        where: { name },
        update: { isEnabled },
        create: { name, isEnabled },
      })
      await prisma.securityEvent.create({
        data: {
          event: 'ADMIN_FEATURE_FLAG_UPDATED',
          userId: user.id,
          path: '/api/admin/feature-flags',
          details: {
            name,
            previousValue: previous?.isEnabled ?? null,
            newValue: isEnabled,
          },
        },
      })
      
      logger.info('Admin:FeatureFlags', `Updated flag ${name} to ${isEnabled}`)
      
      return { success: true, flag }
    } catch (error) {
      logger.error('Admin:FeatureFlags', 'Failed to update feature flag', error)
      return Response.json({ error: 'Failed to update flag' }, { status: 500 })
    }
  })
)