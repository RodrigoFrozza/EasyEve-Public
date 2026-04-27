/**
 * Canonical activity tags for characters (ESI-linked pilots).
 * Keep in sync with UI filters and POST /api/characters/[id]/tags validation.
 */
export const CHARACTER_PI_TAG = 'Planet Manager (PI)' as const

export const CHARACTER_ACTIVITY_TAGS = [
  'Ratter',
  'Miner',
  'Explorer',
  'Industrialist',
  'Skill Point Farmer',
  'Abyssal Runner',
  CHARACTER_PI_TAG,
] as const

export type CharacterActivityTag = (typeof CHARACTER_ACTIVITY_TAGS)[number]

export const CHARACTER_ACTIVITY_TAG_SET = new Set<string>(
  CHARACTER_ACTIVITY_TAGS as readonly string[]
)

export function isAllowedCharacterTagList(tags: unknown): tags is string[] {
  if (!Array.isArray(tags)) return false
  return tags.every((t) => typeof t === 'string' && CHARACTER_ACTIVITY_TAG_SET.has(t))
}
