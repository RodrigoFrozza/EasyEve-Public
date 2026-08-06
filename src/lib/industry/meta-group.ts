/**
 * EVE metaGroupID classification (from SDE metaGroups.yaml), and the rule for
 * which items are "faction" — gated to owned blueprints in "what to produce"
 * because faction/structure-faction blueprints aren't freely buyable/inventable.
 */

export const META_GROUP = {
  TECH_I: 1,
  TECH_II: 2,
  STORYLINE: 3,
  FACTION: 4,
  OFFICER: 5,
  DEADSPACE: 6,
  TECH_III: 14,
  ABYSSAL: 15,
  PREMIUM: 17,
  LIMITED_TIME: 19,
  STRUCTURE_FACTION: 52,
  STRUCTURE_TECH_II: 53,
  STRUCTURE_TECH_I: 54,
} as const

export type TechTier = 't1' | 't2' | 't3' | 'faction' | 'storyline' | 'other'

/** Null metaGroup = unclassified; treat as Tech I baseline (safe, never faction). */
export function techTier(metaGroupId: number | null | undefined): TechTier {
  switch (metaGroupId) {
    case META_GROUP.TECH_I:
    case META_GROUP.STRUCTURE_TECH_I:
    case null:
    case undefined:
      return 't1'
    case META_GROUP.TECH_II:
    case META_GROUP.STRUCTURE_TECH_II:
      return 't2'
    case META_GROUP.TECH_III:
      return 't3'
    case META_GROUP.FACTION:
    case META_GROUP.STRUCTURE_FACTION:
      return 'faction'
    case META_GROUP.STORYLINE:
      return 'storyline'
    default:
      return 'other'
  }
}

/**
 * Faction items (Faction / Structure Faction metaGroups) require a faction
 * blueprint the player must already own — so they only belong in the main
 * "what to produce" list when the player owns the blueprint; otherwise they go
 * to the separate "opportunities" page. T1/T2/T3 are not gated (BPO buyable /
 * inventable).
 */
export function isFactionGated(metaGroupId: number | null | undefined): boolean {
  return metaGroupId === META_GROUP.FACTION || metaGroupId === META_GROUP.STRUCTURE_FACTION
}
