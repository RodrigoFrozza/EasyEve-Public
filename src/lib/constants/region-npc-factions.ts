/**
 * Best-effort mapping from EVE Online region name to the NPC faction that
 * dominates rat spawns there, so auto-detected ratting sessions can fill in
 * npcFaction/space from the character's actual location instead of leaving
 * a permanent 'unknown' placeholder that pollutes loot-intel analytics.
 *
 * Empire regions map to that empire's associated pirate faction (the one
 * whose rats spawn in that empire's belts/anomalies). Null-sec regions map
 * to whichever pirate faction is documented as dominant there. Coverage is
 * necessarily incomplete for obscure/contested regions — callers must treat
 * a miss as "unknown, leave unset", never as a wrong guess.
 */
export const REGION_NPC_FACTION_MAP: Record<string, string> = {
  // --- Amarr Empire -> Blood Raider ---
  'Domain': 'Blood Raider',
  'Kador': 'Blood Raider',
  'Kor-Azor': 'Blood Raider',
  'Genesis': 'Blood Raider',
  'Aridia': 'Blood Raider',
  'Devoid': 'Blood Raider',
  'Tash-Murkon': 'Blood Raider',
  'The Bleak Lands': 'Blood Raider',
  'Derelik': 'Blood Raider',
  'Khanid': 'Blood Raider',

  // --- Caldari State -> Guristas ---
  'The Forge': 'Guristas',
  'Lonetrek': 'Guristas',
  'The Citadel': 'Guristas',
  'Black Rise': 'Guristas',

  // --- Gallente Federation -> Serpentis ---
  'Essence': 'Serpentis',
  'Verge Vendor': 'Serpentis',
  'Solitude': 'Serpentis',
  'Placid': 'Serpentis',
  'Sinq Laison': 'Serpentis',
  'Everyshore': 'Serpentis',

  // --- Minmatar Republic -> Angel Cartel ---
  'Heimatar': 'Angel Cartel',
  'Metropolis': 'Angel Cartel',
  'Molden Heath': 'Angel Cartel',

  // --- Null-sec: Angel Cartel ---
  'Impass': 'Angel Cartel',
  'Feythabolis': 'Angel Cartel',
  'Omist': 'Angel Cartel',
  'Tenerifis': 'Angel Cartel',
  'Immensea': 'Angel Cartel',
  'Curse': 'Angel Cartel',
  'Scalding Pass': 'Angel Cartel',
  'Wicked Creek': 'Angel Cartel',
  'Detorid': 'Angel Cartel',
  'Insmother': 'Angel Cartel',
  'Great Wildlands': 'Angel Cartel',
  'Cache': 'Angel Cartel',

  // --- Null-sec: Blood Raider ---
  'Delve': 'Blood Raider',
  'Querious': 'Blood Raider',
  'Period Basis': 'Blood Raider',

  // --- Null-sec: Guristas ---
  'Tenal': 'Guristas',
  'Branch': 'Guristas',
  'Venal': 'Guristas',
  'Deklein': 'Guristas',
  'Pure Blind': 'Guristas',
  'Geminate': 'Guristas',
  'Vale of the Silent': 'Guristas',
  'Tribute': 'Guristas',
  'Cobalt Edge': 'Guristas',
  'Etherium Reach': 'Guristas',
  'Oasa': 'Guristas',
  'Kalevala Expanse': 'Guristas',
  'The Spire': 'Guristas',

  // --- Null-sec: Sansha's Nation ---
  'Stain': 'Sansha',
  'Paragon Soul': 'Sansha',
  'Esoteria': 'Sansha',
  'Catch': 'Sansha',
  'Providence': 'Sansha',
  'Malpais': 'Sansha',

  // --- Null-sec: Serpentis ---
  'Fade': 'Serpentis',
  'Outer Ring': 'Serpentis',
  'Cloud Ring': 'Serpentis',
  'Syndicate': 'Serpentis',
  'Fountain': 'Serpentis',

  // --- Null-sec: Rogue Drones (deep NE corner) ---
  'Perrigen Falls': 'Rogue Drones',
  'Outer Passage': 'Rogue Drones',
}

/**
 * Infers the dominant NPC faction from a resolved region name + security band
 * (see src/lib/mining-system-geo.ts for how securityBand is derived — it
 * already special-cases Wormhole/Pochven by region_id, which is more
 * reliable than guessing from the region/system name here).
 */
export function inferNpcFactionFromRegion(
  regionName: string | undefined,
  securityBand: 'Highsec' | 'Lowsec' | 'Nullsec' | 'Wormhole' | 'Pochven' | undefined
): string | undefined {
  if (securityBand === 'Wormhole') return 'Sleepers'
  if (securityBand === 'Pochven') return 'Triglavian'
  if (!regionName) return undefined
  return REGION_NPC_FACTION_MAP[regionName]
}
