import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'
import { getCharacterSkills } from '@/lib/esi'
import type { SkillProfile } from '@/types/fit'
import { logger } from '@/lib/server-logger'

/**
 * Resolves optional skill profile for fitting: explicit payload wins, then ESI via linked character.
 */
export async function resolveSkillProfileForFitting(options: {
  userId: string
  characterId?: number | null
  explicitProfile?: SkillProfile | null
}): Promise<SkillProfile | undefined> {
  if (options.explicitProfile?.skills?.length) {
    return options.explicitProfile
  }
  if (!options.characterId) {
    return undefined
  }
  const char = await prisma.character.findFirst({
    where: { id: options.characterId, userId: options.userId },
  })
  if (!char) {
    logger.warn('Fitting', 'Character not found for skill profile', { characterId: options.characterId })
    return undefined
  }
  const { accessToken } = await getValidAccessToken(options.characterId)
  if (!accessToken) {
    logger.warn('Fitting', 'No valid token for character skills', { characterId: options.characterId })
    return undefined
  }
  try {
    const data = await getCharacterSkills(options.characterId, accessToken)
    const skills = (data.skills || []).map((s) => ({
      id: s.skill_id,
      level: s.active_skill_level ?? s.trained_skill_level ?? 0,
      name: undefined as string | undefined,
    }))
    return { type: 'character', skills }
  } catch (e) {
    logger.error('Fitting', 'Failed to load character skills from ESI', e, {
      characterId: options.characterId,
    })
    return undefined
  }
}
