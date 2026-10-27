import { NPC_FACTIONS } from '@/lib/constants/activity-data'

export const CUSTOM_ESCALATION_SITE_ID = '__custom__'

export interface RattingEscalationOption {
  siteName: string
  dedRating: string
  faction: string
  sourceAnomalies?: string[]
}

export const RATTING_ESCALATIONS: RattingEscalationOption[] = [
  // Angel Cartel
  { faction: 'Angel Cartel', dedRating: '4/10', siteName: 'Angel Cartel Occupied Mining Colony', sourceAnomalies: ['Angel Hub', 'Angel Haven'] },
  { faction: 'Angel Cartel', dedRating: '5/10', siteName: "Angel's Red Light District" },
  { faction: 'Angel Cartel', dedRating: '6/10', siteName: 'Angel Mineral Acquisition Outpost' },
  { faction: 'Angel Cartel', dedRating: '7/10', siteName: 'Angel Military Operations Complex' },
  { faction: 'Angel Cartel', dedRating: '8/10', siteName: 'Angel Cartel Prisoner Retention' },
  { faction: 'Angel Cartel', dedRating: '10/10', siteName: 'Angel Cartel Naval Shipyard', sourceAnomalies: ['Angel Sanctum'] },
  // Blood Raider
  { faction: 'Blood Raider', dedRating: '4/10', siteName: 'Mul-Zatah Monastery' },
  { faction: 'Blood Raider', dedRating: '5/10', siteName: 'Blood Raider Psychotropics Depot' },
  { faction: 'Blood Raider', dedRating: '6/10', siteName: 'Crimson Hand Supply Depot' },
  { faction: 'Blood Raider', dedRating: '7/10', siteName: 'Blood Raider Coordination Center' },
  { faction: 'Blood Raider', dedRating: '8/10', siteName: 'Blood Raider Compound' },
  { faction: 'Blood Raider', dedRating: '10/10', siteName: 'Blood Raider Naval Shipyard' },
  // Guristas
  { faction: 'Guristas', dedRating: '4/10', siteName: 'Guristas Scout Outpost', sourceAnomalies: ['Guristas Refuge'] },
  { faction: 'Guristas', dedRating: '5/10', siteName: 'Guristas Hallucinogen Supply Waypoint' },
  { faction: 'Guristas', dedRating: '6/10', siteName: 'Guristas Troop Reinvigoration Camp' },
  { faction: 'Guristas', dedRating: '7/10', siteName: 'Gurista Military Operations Complex' },
  { faction: 'Guristas', dedRating: '8/10', siteName: 'Guristas Provincial HQ' },
  { faction: 'Guristas', dedRating: '10/10', siteName: 'The Maze', sourceAnomalies: ['Guristas Sanctum', 'Guristas Haven'] },
  // Sansha
  { faction: 'Sansha', dedRating: '4/10', siteName: "Sansha's Nation Occupied Mining Colony" },
  { faction: 'Sansha', dedRating: '5/10', siteName: "Sansha's Nation Neural Paralytic Facility" },
  { faction: 'Sansha', dedRating: '6/10', siteName: 'Sansha War Supply Complex' },
  { faction: 'Sansha', dedRating: '7/10', siteName: 'Sansha Military Operations Complex' },
  { faction: 'Sansha', dedRating: '8/10', siteName: 'Sansha Prisoner Camp' },
  { faction: 'Sansha', dedRating: '10/10', siteName: 'Centus Assembly T.P. Co.', sourceAnomalies: ['Sansha Sanctum'] },
  // Serpentis
  { faction: 'Serpentis', dedRating: '4/10', siteName: 'Serpentis Phi-Outpost' },
  { faction: 'Serpentis', dedRating: '5/10', siteName: 'Serpentis Corporation Hydroponics Site' },
  { faction: 'Serpentis', dedRating: '6/10', siteName: 'Serpentis Logistical Outpost' },
  { faction: 'Serpentis', dedRating: '7/10', siteName: 'Serpentis Paramilitary Complex' },
  { faction: 'Serpentis', dedRating: '8/10', siteName: 'Serpentis Base' },
  { faction: 'Serpentis', dedRating: '10/10', siteName: 'Serpentis Fleet Shipyard', sourceAnomalies: ['Serpentis Sanctum', 'Serpentis Haven'] },
  // Rogue Drones
  { faction: 'Rogue Drones', dedRating: '4/10', siteName: 'Drone Infested Mine' },
  { faction: 'Rogue Drones', dedRating: '5/10', siteName: 'Outgrowth Rogue Drone Hive' },
  { faction: 'Rogue Drones', dedRating: '6/10', siteName: 'Rogue Drone Asteroid Infestation' },
  { faction: 'Rogue Drones', dedRating: '7/10', siteName: 'Rogue Drone Nexus' },
  { faction: 'Rogue Drones', dedRating: '10/10', siteName: 'Rogue Drone Sentinel Hub' },
]

function normalizeFactionName(faction: string): string {
  return faction.trim().toLowerCase()
}

const NON_RATTING_ESCALATION_FACTIONS = new Set([
  'unknown',
  'sleepers',
  'triglavian',
])

function resolveEscalationFactionKey(faction?: string): string | undefined {
  const raw = faction?.trim()
  if (!raw) return undefined
  const normalized = normalizeFactionName(raw)
  if (NON_RATTING_ESCALATION_FACTIONS.has(normalized)) return undefined

  const exact = RATTING_ESCALATIONS.find(
    (entry) => normalizeFactionName(entry.faction) === normalized
  )
  if (exact) return exact.faction

  const prefix = RATTING_ESCALATIONS.find((entry) => {
    const catalogFaction = normalizeFactionName(entry.faction)
    return normalized.startsWith(catalogFaction) || catalogFaction.startsWith(normalized)
  })
  return prefix?.faction
}

export function getEscalationsForFaction(faction?: string): RattingEscalationOption[] {
  const resolvedFaction = resolveEscalationFactionKey(faction)
  if (!resolvedFaction) return [...RATTING_ESCALATIONS]

  return RATTING_ESCALATIONS.filter(
    (entry) => entry.faction === resolvedFaction
  )
}

export function getEscalationsForActivity(activity: {
  data?: { npcFaction?: string } | null
}): RattingEscalationOption[] {
  return getEscalationsForFaction(activity.data?.npcFaction)
}

export function findEscalationOption(
  siteName: string,
  faction?: string
): RattingEscalationOption | undefined {
  const normalizedSite = siteName.trim().toLowerCase()
  const pool = getEscalationsForFaction(faction)
  return pool.find((e) => e.siteName.toLowerCase() === normalizedSite)
}

export const RATTING_ESCALATION_FACTIONS = NPC_FACTIONS.filter((f) =>
  RATTING_ESCALATIONS.some((e) => e.faction === f)
)
