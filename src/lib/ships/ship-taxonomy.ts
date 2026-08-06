export type ShipClassId =
  | 'all'
  | 'frigate'
  | 'destroyer'
  | 'cruiser'
  | 'battlecruiser'
  | 'battleship'
  | 'industrial'
  | 'mining_barge'
  | 'carrier'
  | 'dreadnought'
  | 'titan'
  | 'supercarrier'
  | 'freighter'
  | 'jump_freighter'
  | 'marauder'
  | 'black_ops'
  | 'strategic_cruiser'
  | 'shuttle'
  | 'other'

export type ShipFactionId =
  | 'all'
  | 'amarr'
  | 'caldari'
  | 'gallente'
  | 'minmatar'
  | 'ore'
  | 'guristas'
  | 'angel'
  | 'blood_raider'
  | 'sansha'
  | 'serpentis'
  | 'triglavian'
  | 'sisters_of_eve'
  | 'mordu'
  | 'deathless'
  | 'concord'
  | 'upwell'
  | 'jove'
  | 'edencom'
  | 'unknown'

export type ShipClassOption = {
  id: ShipClassId
  label: string
  groupAliases: string[]
  keywords: string[]
}

export type ShipFactionOption = {
  id: ShipFactionId
  label: string
  aliases: string[]
}

const normalizeValue = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

export const SHIP_CLASS_OPTIONS: readonly ShipClassOption[] = [
  { id: 'all', label: 'All classes', groupAliases: [], keywords: ['all', 'ships', 'hulls'] },
  { id: 'frigate', label: 'Frigate', groupAliases: ['Frigate', 'Assault Frigate', 'Logistics Frigate'], keywords: ['frigate'] },
  { id: 'destroyer', label: 'Destroyer', groupAliases: ['Destroyer', 'Tactical Destroyer', 'Interdictor'], keywords: ['destroyer'] },
  { id: 'cruiser', label: 'Cruiser', groupAliases: ['Cruiser', 'Heavy Assault Cruiser', 'Heavy Interdiction Cruiser', 'Logistics Cruiser', 'Assault Cruiser', 'Combat Recon Ship', 'Force Recon Ship'], keywords: ['cruiser', 'hac', 'recon'] },
  { id: 'battlecruiser', label: 'Battlecruiser', groupAliases: ['Battlecruiser', 'Combat Battlecruiser', 'Attack Battlecruiser', 'Command Ship'], keywords: ['battlecruiser', 'bc'] },
  { id: 'battleship', label: 'Battleship', groupAliases: ['Battleship', 'Black Ops', 'Marauder'], keywords: ['battleship', 'bs'] },
  { id: 'industrial', label: 'Industrial', groupAliases: ['Industrial', 'Transport Ship', 'Industrial Command Ship', 'Capital Industrial Ship'], keywords: ['industrial', 'hauler'] },
  { id: 'mining_barge', label: 'Mining', groupAliases: ['Mining Barge', 'Exhumer'], keywords: ['mining', 'barge', 'exhumer'] },
  { id: 'carrier', label: 'Carrier', groupAliases: ['Carrier'], keywords: ['carrier'] },
  { id: 'dreadnought', label: 'Dreadnought', groupAliases: ['Dreadnought'], keywords: ['dreadnought', 'dread'] },
  { id: 'titan', label: 'Titan', groupAliases: ['Titan'], keywords: ['titan'] },
  { id: 'supercarrier', label: 'Supercarrier', groupAliases: ['Supercarrier'], keywords: ['supercarrier', 'super'] },
  { id: 'freighter', label: 'Freighter', groupAliases: ['Freighter'], keywords: ['freighter'] },
  { id: 'jump_freighter', label: 'Jump Freighter', groupAliases: ['Jump Freighter'], keywords: ['jump freighter', 'jf'] },
  { id: 'marauder', label: 'Marauder', groupAliases: ['Marauder'], keywords: ['marauder'] },
  { id: 'black_ops', label: 'Black Ops', groupAliases: ['Black Ops'], keywords: ['black ops', 'blops'] },
  { id: 'strategic_cruiser', label: 'Strategic Cruiser', groupAliases: ['Strategic Cruiser'], keywords: ['strategic cruiser', 't3 cruiser'] },
  { id: 'shuttle', label: 'Shuttle', groupAliases: ['Shuttle'], keywords: ['shuttle'] },
  { id: 'other', label: 'Other', groupAliases: [], keywords: ['other'] },
] as const

export const SHIP_FACTION_OPTIONS: readonly ShipFactionOption[] = [
  { id: 'all', label: 'All factions', aliases: ['all'] },
  { id: 'amarr', label: 'Amarr', aliases: ['amarr', 'amarr empire'] },
  { id: 'caldari', label: 'Caldari', aliases: ['caldari', 'caldari state'] },
  { id: 'gallente', label: 'Gallente', aliases: ['gallente', 'gallente federation'] },
  { id: 'minmatar', label: 'Minmatar', aliases: ['minmatar', 'minmatar republic'] },
  { id: 'ore', label: 'ORE', aliases: ['ore'] },
  { id: 'guristas', label: 'Guristas', aliases: ['guristas', 'guristas pirates'] },
  { id: 'angel', label: 'Angel Cartel', aliases: ['angel', 'angel cartel'] },
  { id: 'blood_raider', label: 'Blood Raider', aliases: ['blood raider', 'blood raiders'] },
  { id: 'sansha', label: "Sansha's Nation", aliases: ["sansha's nation", 'sansha'] },
  { id: 'serpentis', label: 'Serpentis', aliases: ['serpentis'] },
  { id: 'triglavian', label: 'Triglavian', aliases: ['triglavian', 'triglavian collective'] },
  { id: 'sisters_of_eve', label: 'Sisters of EVE', aliases: ['sisters of eve'] },
  { id: 'mordu', label: "Mordu's Legion", aliases: ["mordu's legion", 'mordu'] },
  { id: 'deathless', label: 'The Deathless', aliases: ['the deathless', 'deathless circle'] },
  { id: 'concord', label: 'CONCORD', aliases: ['concord', 'concord assembly'] },
  { id: 'upwell', label: 'Upwell Consortium', aliases: ['upwell consortium', 'upwell'] },
  { id: 'jove', label: 'Jove', aliases: ['jove', 'jove empire'] },
  { id: 'edencom', label: 'EDENCOM', aliases: ['edencom'] },
  { id: 'unknown', label: 'Unknown', aliases: ['unknown'] },
] as const

const shipClassByNormalizedGroup = new Map<string, ShipClassId>()
for (const option of SHIP_CLASS_OPTIONS) {
  for (const alias of option.groupAliases) {
    shipClassByNormalizedGroup.set(normalizeValue(alias), option.id)
  }
}

const shipFactionByAlias = new Map<string, ShipFactionId>()
for (const option of SHIP_FACTION_OPTIONS) {
  for (const alias of option.aliases) {
    shipFactionByAlias.set(normalizeValue(alias), option.id)
  }
}

const classById = new Map(SHIP_CLASS_OPTIONS.map(option => [option.id, option]))
const factionById = new Map(SHIP_FACTION_OPTIONS.map(option => [option.id, option]))

export function resolveShipClassId(groupName: string | null | undefined): ShipClassId {
  if (!groupName) return 'other'
  const normalized = normalizeValue(groupName)
  const exactMatch = shipClassByNormalizedGroup.get(normalized)
  if (exactMatch) return exactMatch

  if (normalized.includes('titan')) return 'titan'
  if (normalized.includes('supercarrier')) return 'supercarrier'
  if (normalized.includes('carrier')) return 'carrier'
  if (normalized.includes('dreadnought')) return 'dreadnought'
  if (normalized.includes('jump freighter')) return 'jump_freighter'
  if (normalized.includes('freighter')) return 'freighter'
  if (normalized.includes('battleship')) return 'battleship'
  if (normalized.includes('battlecruiser')) return 'battlecruiser'
  if (normalized.includes('cruiser')) return 'cruiser'
  if (normalized.includes('destroyer')) return 'destroyer'
  if (normalized.includes('frigate')) return 'frigate'
  if (normalized.includes('industrial') || normalized.includes('transport')) return 'industrial'
  if (normalized.includes('barge') || normalized.includes('exhumer')) return 'mining_barge'
  if (normalized.includes('shuttle')) return 'shuttle'

  return 'other'
}

export function normalizeShipFactionId(factionName: string | null | undefined): ShipFactionId {
  if (!factionName) return 'unknown'
  return shipFactionByAlias.get(normalizeValue(factionName)) ?? 'unknown'
}

export function getShipClassLabel(classId: ShipClassId): string {
  return classById.get(classId)?.label ?? 'Other'
}

export function getShipFactionLabel(factionId: ShipFactionId): string {
  return factionById.get(factionId)?.label ?? 'Unknown'
}

export function getFactionAliasesForFilter(factionId: ShipFactionId): string[] {
  return factionById.get(factionId)?.aliases ?? []
}

export function getGroupAliasesForClassFilter(classId: ShipClassId): string[] {
  return classById.get(classId)?.groupAliases ?? []
}

