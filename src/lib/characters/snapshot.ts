import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { getValidAccessToken } from '@/lib/token-manager'
import { getCharacterSkills, getCharacterAttributes, getCharacterImplants } from '@/lib/esi'
import { parseScopesFromJwt } from '@/lib/utils'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import type { CharacterSnapshot } from '@prisma/client'

const SKILLS_SCOPE = 'esi-skills.read_skills.v1'
const SKILLQUEUE_SCOPE = 'esi-skills.read_skillqueue.v1'
const IMPLANTS_SCOPE = 'esi-clones.read_implants.v1'

interface CharacterForSnapshot {
  id: number
  name?: string
}

export interface WriteCharacterSnapshotResult {
  snapshot: CharacterSnapshot
  missingScopes: string[]
}

/**
 * Fetch-and-degrade wrapper: runs `fn`, and if it fails specifically with an ESI 403
 * (missing scope), logs a warning, records the affected scope(s) as missing, and
 * resolves to null instead of failing the whole snapshot. Any other error (ESI
 * outage, network failure, etc.) is logged and rethrown — that is a real failure,
 * not an expected "character hasn't granted this scope" case, and must not be
 * swallowed into a silent partial snapshot.
 */
async function fetchOrDegrade<T>(
  characterId: number,
  scopesForThisFetch: string[],
  missingScopes: string[],
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn()
  } catch (error: any) {
    const status = error?.response?.status
    if (status === 403) {
      logger.warn(
        'CharacterSnapshot',
        `ESI 403 for character ${characterId} (scope(s): ${scopesForThisFetch.join(', ')}) — degrading this field`,
        error?.response?.data
      )
      for (const scope of scopesForThisFetch) {
        if (!missingScopes.includes(scope)) missingScopes.push(scope)
      }
      return null
    }

    logger.error(
      'CharacterSnapshot',
      `Failed to fetch data for character ${characterId} (scope(s): ${scopesForThisFetch.join(', ')})`,
      error
    )
    throw error
  }
}

/**
 * Refreshes and persists the CharacterSnapshot used to power the shareable
 * Character Profile. Degrades per item: a character missing a given ESI scope
 * (or one that starts 403-ing mid-flight) does not blow up the whole snapshot —
 * that field is skipped, the previous persisted value (if any) is preserved, and
 * the scope is reported back via `missingScopes` so the caller can surface it in
 * the UI instead of silently showing stale/zeroed data as if it were live.
 */
export async function writeCharacterSnapshot(
  character: CharacterForSnapshot
): Promise<WriteCharacterSnapshotResult> {
  const { accessToken, error: tokenError } = await getValidAccessToken(character.id)

  if (!accessToken) {
    logger.error('CharacterSnapshot', `No valid access token for character ${character.id}`, { error: tokenError })
    throw new AppError(ErrorCodes.ESI_NO_TOKEN, 'Session expired. Please re-authenticate the character.', 401)
  }

  const scopes = parseScopesFromJwt(accessToken)
  const missingScopes: string[] = []

  const hasSkillsScope = scopes.includes(SKILLS_SCOPE)
  const hasSkillqueueScope = scopes.includes(SKILLQUEUE_SCOPE)
  const hasImplantsScope = scopes.includes(IMPLANTS_SCOPE)

  if (!hasSkillsScope) missingScopes.push(SKILLS_SCOPE)
  if (!hasSkillqueueScope) missingScopes.push(SKILLQUEUE_SCOPE)
  if (!hasImplantsScope) missingScopes.push(IMPLANTS_SCOPE)

  // getCharacterSkills fetches /skills/ and /skillqueue/ together as one atomic
  // Promise.all — if either scope is missing the combined call would 403 as a
  // whole, so we only attempt it when both scopes are present. Skipping proactively
  // avoids a needless 403 round-trip to ESI.
  const canFetchSkills = hasSkillsScope && hasSkillqueueScope
  // ESI's /attributes/ endpoint is gated by the same skills scope.
  const canFetchAttributes = hasSkillsScope
  const canFetchImplants = hasImplantsScope

  if (!canFetchSkills) {
    logger.warn('CharacterSnapshot', `Skipping skills/skillqueue fetch for character ${character.id}: missing scope(s)`)
  }
  if (!canFetchAttributes) {
    logger.warn('CharacterSnapshot', `Skipping attributes fetch for character ${character.id}: missing scope ${SKILLS_SCOPE}`)
  }
  if (!canFetchImplants) {
    logger.warn('CharacterSnapshot', `Skipping implants fetch for character ${character.id}: missing scope ${IMPLANTS_SCOPE}`)
  }

  const [skillsResult, attributesResult, implantsResult] = await Promise.all([
    canFetchSkills
      ? fetchOrDegrade(character.id, [SKILLS_SCOPE, SKILLQUEUE_SCOPE], missingScopes, () =>
          getCharacterSkills(character.id, accessToken)
        )
      : Promise.resolve(null),
    canFetchAttributes
      ? fetchOrDegrade(character.id, [SKILLS_SCOPE], missingScopes, () =>
          getCharacterAttributes(character.id, accessToken)
        )
      : Promise.resolve(null),
    canFetchImplants
      ? fetchOrDegrade(character.id, [IMPLANTS_SCOPE], missingScopes, () =>
          getCharacterImplants(character.id, accessToken)
        )
      : Promise.resolve(null),
  ])

  const existing = await prisma.characterSnapshot.findUnique({ where: { characterId: character.id } })

  const totalSp = skillsResult?.total_sp ?? existing?.totalSp ?? 0
  const unallocatedSp = skillsResult?.free_sp ?? existing?.unallocatedSp ?? null

  const snapshot = await prisma.characterSnapshot.upsert({
    where: { characterId: character.id },
    create: {
      characterId: character.id,
      totalSp,
      unallocatedSp,
      // Required Json columns — on first-ever snapshot with no prior data to fall
      // back to, an empty array/object explicitly signals "no data captured yet"
      // rather than fabricating placeholder values.
      skills: skillsResult?.skills ?? [],
      skillqueue: skillsResult?.queues ?? [],
      attributes: attributesResult ?? {},
      implants: implantsResult ?? undefined,
      capturedAt: new Date(),
    },
    update: {
      totalSp,
      unallocatedSp,
      // Only overwrite a field when this run actually produced fresh data — if a
      // fetch was skipped/degraded, keep whatever was persisted last time instead
      // of blanking it out.
      ...(skillsResult ? { skills: skillsResult.skills, skillqueue: skillsResult.queues } : {}),
      ...(attributesResult ? { attributes: attributesResult } : {}),
      ...(implantsResult ? { implants: implantsResult } : {}),
      capturedAt: new Date(),
    },
  })

  return { snapshot, missingScopes }
}
