import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

/** EVE skill typeIds that reduce industry job time. */
export const INDUSTRY_SKILL_ID = 3380
export const ADVANCED_INDUSTRY_SKILL_ID = 3388

export interface IndustrySkillLevels {
  industry: number
  advancedIndustry: number
  /** When the source snapshot was captured — surfaced in the UI so a stale/absent read is visible. */
  capturedAt: Date
}

interface SnapshotSkill {
  skill_id: number
  trained_skill_level?: number
  active_skill_level?: number
}

function levelOf(skills: SnapshotSkill[], skillId: number): number {
  const s = skills.find((x) => x.skill_id === skillId)
  if (!s) return 0
  // active reflects boosters/implants (the effective level); fall back to trained.
  return s.active_skill_level ?? s.trained_skill_level ?? 0
}

/**
 * Industry (3380) and Advanced Industry (3388) levels for a character, read from
 * the persisted CharacterSnapshot (populated when the owner opens their profile
 * page — no TTL, so it can be stale or absent).
 *
 * Returns null when there is no snapshot for this character (never a fabricated
 * level-0 pair — the caller must be able to tell "no data" from "level 0", and
 * label the ISK/h accordingly, per the golden rule). `capturedAt` lets the UI
 * show how fresh the levels are.
 */
export async function getIndustrySkillLevels(
  characterId: number
): Promise<IndustrySkillLevels | null> {
  try {
    const snapshot = await prisma.characterSnapshot.findUnique({
      where: { characterId },
      select: { skills: true, capturedAt: true },
    })
    if (!snapshot) return null

    const skills = Array.isArray(snapshot.skills)
      ? (snapshot.skills as unknown as SnapshotSkill[])
      : []

    return {
      industry: levelOf(skills, INDUSTRY_SKILL_ID),
      advancedIndustry: levelOf(skills, ADVANCED_INDUSTRY_SKILL_ID),
      capturedAt: snapshot.capturedAt,
    }
  } catch (error) {
    logger.error('INDUSTRY_SKILLS', `Failed to read skills for character ${characterId}`, error)
    return null
  }
}
