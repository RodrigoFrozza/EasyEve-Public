import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

export const DEFAULT_FEATURE_FLAGS: Record<string, boolean> = {
  autoLootTracking: true,
  miningLaunchV2: false,
  abyssalSyncV2: false,
  rattingValidationStrict: true,
  explorationQualityGuards: true,
}

type FeatureFlagRow = {
  name: string
  isEnabled: boolean
}

export async function getResolvedFeatureFlags() {
  try {
    const flags = (await prisma.featureFlag.findMany()) as FeatureFlagRow[]
    const result: Record<string, boolean> = {}

    for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
      const flag = flags.find((item) => item.name === key)
      result[key] = flag ? flag.isEnabled : DEFAULT_FEATURE_FLAGS[key]
    }

    return result
  } catch (error) {
    logger.error('FeatureFlags', 'Failed to resolve feature flags', error)
    return { ...DEFAULT_FEATURE_FLAGS }
  }
}
