import { MINING_ORE_GROUP_IDS } from '@/lib/constants/mining'

/**
 * When SDE row is missing or suspicious, fetch type details from ESI and upsert EveType.
 * Known asteroid ore groups (18, 19, 20) with volume 1 are treated as trusted local rows.
 */
export function shouldRefetchMiningTypeFromEsi(
  meta: { name?: string; volume: number; groupId: number } | undefined
): boolean {
  if (!meta || !meta.name || meta.volume === 0) return true
  const groupId = meta.groupId
  const isKnownAsteroidOreGroup =
    typeof groupId === 'number' && (MINING_ORE_GROUP_IDS as readonly number[]).includes(groupId)
  if (meta.volume === 1 && !isKnownAsteroidOreGroup) return true
  return false
}
