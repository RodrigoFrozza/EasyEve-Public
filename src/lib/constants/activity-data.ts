export const ACTIVITY_TYPES = [
  { id: 'mining', label: 'Mining' },
  { id: 'ratting', label: 'Ratting' },
  { id: 'abyssal', label: 'Abyssal' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'crab', label: 'Crab Beacon' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'pvp', label: 'PVP' },
]

export const REGIONS = ['Minmatar', 'Gallente', 'Caldari', 'Amarr', 'Jove', 'Wormhole']
export const SPACE_TYPES = ['Highsec', 'Lowsec', 'Nullsec', 'Wormhole', 'Pochven']
export const MINING_TYPES = ['Ore', 'Ice', 'Gas', 'Moon']
export const NPC_FACTIONS = ['Angel Cartel', 'Blood Raider', 'Guristas', 'Sansha', 'Serpentis', 'Rogue Drones', 'Sleepers', 'Triglavian']

export const ANOMALIES_BY_FACTION: Record<string, Record<string, string[]>> = {
  'Angel Cartel': {
    'Highsec': ['Angel Burrow', 'Angel Hideaway', 'Angel Refuge', 'Angel Den'],
    'Lowsec': ['Angel Refuge', 'Angel Den', 'Angel Watch', 'Angel Vigil'],
    'Nullsec': ['Angel Hub', 'Angel Haven', 'Angel Sanctum', 'Angel Forsaken Hub', 'Angel Forlorn Hub', 'Angel Rally Point', 'Angel Port', 'Angel Forsaken Rally Point', 'Angel Forlorn Rally Point']
  },
  'Blood Raider': {
    'Highsec': ['Blood Burrow', 'Blood Hideaway', 'Blood Refuge', 'Blood Den'],
    'Lowsec': ['Blood Refuge', 'Blood Den', 'Blood Watch', 'Blood Vigil'],
    'Nullsec': ['Blood Hub', 'Blood Haven', 'Blood Sanctum', 'Blood Forsaken Hub', 'Blood Forlorn Hub', 'Blood Rally Point', 'Blood Port']
  },
  'Guristas': {
    'Highsec': ['Guristas Burrow', 'Guristas Hideaway', 'Guristas Refuge', 'Guristas Den'],
    'Lowsec': ['Guristas Refuge', 'Guristas Den', 'Guristas Watch', 'Guristas Vigil'],
    'Nullsec': ['Guristas Hub', 'Guristas Haven', 'Guristas Sanctum', 'Guristas Forsaken Hub', 'Guristas Forlorn Hub', 'Guristas Rally Point', 'Guristas Port', 'Guristas Forsaken Rally Point', 'Guristas Forlorn Rally Point']
  },
  'Sansha': {
    'Highsec': ['Sansha Burrow', 'Sansha Hideaway', 'Sansha Refuge', 'Sansha Den'],
    'Lowsec': ['Sansha Refuge', 'Sansha Den', 'Sansha Watch', 'Sansha Vigil'],
    'Nullsec': ['Sansha Hub', 'Sansha Haven', 'Sansha Sanctum', 'Sansha Forsaken Hub', 'Sansha Forlorn Hub', 'Sansha Rally Point', 'Sansha Port']
  },
  'Serpentis': {
    'Highsec': ['Serpentis Burrow', 'Serpentis Hideaway', 'Serpentis Refuge', 'Serpentis Den'],
    'Lowsec': ['Serpentis Refuge', 'Serpentis Den', 'Serpentis Watch', 'Serpentis Vigil'],
    'Nullsec': ['Serpentis Hub', 'Serpentis Haven', 'Serpentis Sanctum', 'Serpentis Forsaken Hub', 'Serpentis Forlorn Hub', 'Serpentis Rally Point', 'Serpentis Port']
  },
  'Rogue Drones': {
    'Highsec': ['Drone Cluster', 'Drone Assembly', 'Drone Gathering'],
    'Lowsec': ['Drone Gathering', 'Drone Surveillance', 'Drone Siege'],
    'Nullsec': ['Drone Horde', 'Drone Patrol', 'Drone Squad', 'Drone Hive']
  },
  'Sleepers': {
    'Wormhole': [
      'Perimeter Ambush Point', 'Perimeter Camp', 'Perimeter Checkpoint', 'Perimeter Hangar',
      'Frontier Stronghold', 'Frontier Camp', 'Frontier Barracks', 'Frontier Command Post',
      'Core Garrison', 'Core Stronghold', 'Core Citadel', 'Core Bastion'
    ]
  },
  'Triglavian': {
    'Pochven': [
      'Incipient Werpost', 'Torpid Werpost', 'Observational Flashpoint', 'Stellar Fleet Deployment', 'World Ark Assault'
    ]
  }
}

/**
 * Very precise information about anomaly waves, NPC types, loot, and escalations.
 */
export interface AnomalyIntel {
  waves: string[];
  notableNpcs: string[];
  loot: string;
  escalation: string;
  tips: string;
}

export const ANOMALY_INTEL: Record<string, AnomalyIntel> = {
  // === GURISTAS ===
  'Guristas Refuge': {
    waves: ['Wave 1: 3x Frigates', 'Wave 2: 4x Frigates, 2x Destroyers', 'Wave 3: 3x Cruisers (Trigger: Last Cruiser)', 'Wave 4: 2x Cruisers, 1x Dread Guristas (Rare)'],
    notableNpcs: ['Dread Guristas (Faction Spawn)'],
    loot: 'Guristas Copper/Silver Tags, Dread Guristas Modules (C-Type), Worm BPC.',
    escalation: 'Guristas Scout Outpost (4/10 DED)',
    tips: 'Watch out for ECM from Guristas cruisers.'
  },
  'Guristas Haven': {
    waves: ['Wave 1: 6x Battleships, 4x Cruisers', 'Wave 2: 5x Battleships, 3x Elite Frigates (ECM)', 'Wave 3: 6x Battleships, 4x Destroyers', 'Wave 4: 4x Battleships, 1x Dread Guristas (Rare)'],
    notableNpcs: ['Dread Guristas (Faction)', 'Pith Massacrer (High Bounty)'],
    loot: 'Pith B-Type Modules, Dread Guristas Modules, Gila BPC.',
    escalation: 'Guristas Fleet Outpost (10/10 DED)',
    tips: 'Prioritize ECM frigates to avoid losing lock.'
  },
  'Guristas Sanctum': {
    waves: ['Wave 1: 8x Battleships, 4x Cruisers', 'Wave 2: 7x Battleships, 4x Elite Frigates', 'Wave 3: 8x Battleships, 2x Dread Guristas (Rare)', 'Wave 4: 5x Battleships (Final)'],
    notableNpcs: ['Dread Guristas (Faction)', 'Pith Usurper (Top Priority)'],
    loot: 'Pith A-Type Modules, Dread Guristas Modules, Rattlesnake BPC.',
    escalation: 'The Maze (10/10 DED)',
    tips: 'The "Station" variant has much stronger boss spawns than the "Ring" variant.'
  },
  // === SERPENTIS ===
  'Serpentis Haven': {
    waves: ['Wave 1: 6x Battleships, 4x Cruisers', 'Wave 2: 5x Battleships, 3x Elite Frigates (Web/Scram)', 'Wave 3: 6x Battleships, 4x Destroyers', 'Wave 4: 4x Battleships, 1x Shadow Serpentis (Rare)'],
    notableNpcs: ['Shadow Serpentis (Faction)', 'Core Admiral'],
    loot: 'Core B-Type Modules, Shadow Serpentis Modules, Cynabal BPC.',
    escalation: 'Serpentis Fleet Shipyard (10/10 DED)',
    tips: 'Serpentis deal heavy Thermal damage. Use Sensor Dampening resistance.'
  },
  'Serpentis Sanctum': {
    waves: ['Wave 1: 8x Battleships, 4x Cruisers', 'Wave 2: 7x Battleships, 4x Elite Frigates', 'Wave 3: 8x Battleships, 2x Shadow Serpentis (Rare)', 'Wave 4: 5x Battleships (Final)'],
    notableNpcs: ['Shadow Serpentis (Faction)', 'Core High Admiral'],
    loot: 'Core A-Type Modules, Shadow Serpentis Modules, Vindicator BPC.',
    escalation: 'Serpentis Fleet Shipyard (10/10 DED)',
    tips: 'The "Station" variant spawns more elite cruisers that use Sensor Dampening.'
  },
  // === SLEEPERS ===
  'Core Garrison': {
    waves: ['Wave 1: 4x Sleeper Battleships, 6x Cruisers', 'Wave 2: 5x Sleeper Battleships, 4x Frigates (Trigger: Last BS)', 'Wave 3: 6x Sleeper Battleships (Final)'],
    notableNpcs: ['Sleeper Battleships (High DPS/RR)'],
    loot: 'Blue Loot (Neural Network Analyzers, Ancient Coordinates Database).',
    escalation: 'None (Wormhole sites don\'t escalate, but can spawn Drifters).',
    tips: 'Sleepers deal OMNI damage and use Neutralizers. High capacitor resistance required.'
  }
}

export function getRattingAnomaliesBySpaceAndFaction(space: string | undefined, faction: string | undefined): string[] {
  if (!faction) return []
  const factionData = ANOMALIES_BY_FACTION[faction]
  if (!factionData) return []
  
  if (!space) {
    // Return all if no space specified
    return Object.values(factionData).flat()
  }

  // Exact match for the security level
  return factionData[space] || []
}

// ABYSSAL_TIERS and ABYSSAL_WEATHER are primarily fetched from /api/sde/filaments
// Fallback values provided for development when SDE is not yet synced
export const ABYSSAL_TIERS = [
  { label: 'T0 (Tranquil)', iconPath: '/midia/T0.webp' },
  { label: 'T1 (Calm)', iconPath: '/midia/T1.webp' },
  { label: 'T2 (Agitated)', iconPath: '/midia/T2.webp' },
  { label: 'T3 (Fierce)', iconPath: '/midia/T3.webp' },
  { label: 'T4 (Raging)', iconPath: '/midia/T4.webp' },
  { label: 'T5 (Chaotic)', iconPath: '/midia/T5.webp' },
  { label: 'T6 (Cataclysmic)', iconPath: '/midia/T6.webp' },
]

export const ABYSSAL_WEATHER = [
  { label: 'Electrical', iconPath: '/midia/Electrical.d93ab1b345a4bde2b3ef.webp' },
  { label: 'Dark', iconPath: '/midia/Dark.3d2e3d2f96f27014fe20.webp' },
  { label: 'Exotic', iconPath: '/midia/Exotic.2c9b7e8f3ae9cb1b35d2.webp' },
  { label: 'Firestorm', iconPath: '/midia/Firestorm.f4f42ee09fcafce7da24.webp' },
  { label: 'Gamma', iconPath: '/midia/Gamma.eaebeedb1b61d0264c24.webp' },
]
export const SHIP_SIZES = ['Frigate', 'Destroyer', 'Cruiser']
export const EXPLORATION_SITE_TYPES = [
  // === RELIC SITES ===
  'Crumbling Angel Cartel Hideout',
  'Ruined Angel Cartel Warehouse',
  'Decayed Angel Cartel Hideout',
  'Monument Angel Cartel Hideout',
  'Crumbling Blood Raider Supply Depot',
  'Ruined Blood Raider Stronghold',
  'Decayed Blood Raider Supply Depot',
  'Crumbling Guristas Shipment',
  'Ruined Guristas Intelligence Center',
  'Decayed Guristas Shipment',
  'Temple Guristas Intelligence Center',
  'Crumbling Sansha\'s Suppressed Navigation',
  'Decayed Sansha\'s Suppressed Navigation',
  'Crumbling Serpentis Drug Lab',
  'Decayed Serpentis Drug Lab',
  'Crystal Quarry Serpentis Drug Lab',
  'Crumbling Rogue Drone Hive',
  'Ruined Rogue Drone Assembly',
  
  // === DATA SITES ===
  'Local Angel Cartel Info Hub',
  'Central Angel Cartel Info Hub',
  'Local Blood Raider Data Link',
  'Central Blood Raider Data Link',
  'Local Guristas Scout Grounds',
  'Regional Sansha\'s Neural Network',
  'Regional Serpentis Communications',
  'Abandoned Research Complex DA005',
  'Abandoned Research Complex DG003',
  
  // === SPECIAL & DANGEROUS ===
  'Superior Sleeper Cache',
  'Standard Sleeper Cache',
  'Limited Sleeper Cache',
  'Covert Research Facility (Ghost)',
  'Improved Covert Research Facility (Ghost)',
  'Lesser Covert Research Facility (Ghost)',
  'Superior Covert Research Facility (Ghost)',
  'Besieged Covert Research Facility',
  
  // === FALLBACK ===
  'Gas Reservoir',
  'Other / Special'
]
export const DIFFICULTIES = ['Level I', 'Level II', 'Level III', 'Level IV', 'Level V']
export const CRAB_PHASES = ['Deployment', 'Linking (4min)', 'Scanning (10min)', 'Rewards']
export const DED_LEVELS = ['1/10', '2/10', '3/10', '4/10', '5/10', '6/10', '7/10', '8/10', '9/10', '10/10']

export const ESI_REF_TYPES = {
  BOUNTY: ['bounty', 'bounty_prizes', 'bounty_payout', 'agent_mission_reward'],
  TAX: ['corporation_tax_payout', 'bounty_prize_corporation_tax'],
  ESS: ['ess_payout', 'ess_escrow']
} as const
