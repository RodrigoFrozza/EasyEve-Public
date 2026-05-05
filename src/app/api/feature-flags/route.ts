import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { getResolvedFeatureFlags } from '@/lib/feature-flags'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(
  withAuth(async () => {
    return await getResolvedFeatureFlags()
  })
)
