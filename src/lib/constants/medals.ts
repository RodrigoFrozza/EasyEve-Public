export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum'
export type MedalType = 'instant' | 'daily' | 'weekly' | 'monthly'
export type MedalCriteriaType = 'hours' | 'count' | 'ranking' | 'first_activity'
export type ActivityType = 'mining' | 'ratting' | 'exploration'

export interface MedalDefinition {
  id: string
  name: string
  description: string
  icon: string
  tier: MedalTier
  type: MedalType
  criteria: {
    type: MedalCriteriaType
    value: number
    activity?: ActivityType
  }
}

export const EASY_EVE_MEDALS: MedalDefinition[] = [
  // === TIME-BASED (hours) ===
  {
    id: 'new_eden_explorer',
    name: 'New Eden Explorer',
    description: 'Complete your first activity in EasyEve',
    icon: '🚀',
    tier: 'bronze',
    type: 'instant',
    criteria: { type: 'first_activity', value: 1 }
  },
  {
    id: 'stellar_pioneer',
    name: 'Stellar Pioneer',
    description: 'Spend 10 hours in activities',
    icon: '⭐',
    tier: 'bronze',
    type: 'instant',
    criteria: { type: 'hours', value: 10 }
  },
  {
    id: 'galactic_wanderer',
    name: 'Galactic Wanderer',
    description: 'Spend 100 hours in activities',
    icon: '🌌',
    tier: 'silver',
    type: 'instant',
    criteria: { type: 'hours', value: 100 }
  },
  {
    id: 'cosmos_veteran',
    name: 'Cosmos Veteran',
    description: 'Spend 1000 hours in activities',
    icon: '🏆',
    tier: 'gold',
    type: 'instant',
    criteria: { type: 'hours', value: 1000 }
  },

  // === MINING COUNT ===
  {
    id: 'asteroid_harvester',
    name: 'Asteroid Harvester',
    description: 'Complete 10 mining activities',
    icon: '💎',
    tier: 'bronze',
    type: 'instant',
    criteria: { type: 'count', value: 10, activity: 'mining' }
  },
  {
    id: 'belt_commander',
    name: 'Belt Commander',
    description: 'Complete 100 mining activities',
    icon: '⛏️',
    tier: 'silver',
    type: 'instant',
    criteria: { type: 'count', value: 100, activity: 'mining' }
  },
  {
    id: 'ore_tycoon',
    name: 'Ore Tycoon',
    description: 'Complete 1000 mining activities',
    icon: '👑',
    tier: 'gold',
    type: 'instant',
    criteria: { type: 'count', value: 1000, activity: 'mining' }
  },

  // === RATTING COUNT ===
  {
    id: 'sansha_slayer',
    name: 'Sansha Slayer',
    description: 'Complete 10 ratting activities',
    icon: '⚔️',
    tier: 'bronze',
    type: 'instant',
    criteria: { type: 'count', value: 10, activity: 'ratting' }
  },
  {
    id: 'pirate_hunter',
    name: 'Pirate Hunter',
    description: 'Complete 100 ratting activities',
    icon: '🎯',
    tier: 'silver',
    type: 'instant',
    criteria: { type: 'count', value: 100, activity: 'ratting' }
  },
  {
    id: 'concord_outlaw',
    name: 'Concord Outlaw',
    description: 'Complete 1000 ratting activities',
    icon: '🛡️',
    tier: 'gold',
    type: 'instant',
    criteria: { type: 'count', value: 1000, activity: 'ratting' }
  },

  // === EXPLORATION COUNT ===
  {
    id: 'signature_scanner',
    name: 'Signature Scanner',
    description: 'Complete 10 exploration activities',
    icon: '📡',
    tier: 'bronze',
    type: 'instant',
    criteria: { type: 'count', value: 10, activity: 'exploration' }
  },
  {
    id: 'ded_hunter',
    name: 'DED Hunter',
    description: 'Complete 100 exploration activities',
    icon: '🔭',
    tier: 'silver',
    type: 'instant',
    criteria: { type: 'count', value: 100, activity: 'exploration' }
  },
  {
    id: 'wormhole_explorer',
    name: 'Wormhole Explorer',
    description: 'Complete 1000 exploration activities',
    icon: '🌀',
    tier: 'gold',
    type: 'instant',
    criteria: { type: 'count', value: 1000, activity: 'exploration' }
  },

  // === RANKING DAILY ===
  {
    id: 'daily_ratting_ace',
    name: 'Daily Ratting Ace',
    description: 'Reach #1 in daily ratting ranking',
    icon: '🥇',
    tier: 'gold',
    type: 'daily',
    criteria: { type: 'ranking', value: 1, activity: 'ratting' }
  },
  {
    id: 'daily_mining_ace',
    name: 'Daily Mining Ace',
    description: 'Reach #1 in daily mining ranking',
    icon: '🥇',
    tier: 'gold',
    type: 'daily',
    criteria: { type: 'ranking', value: 1, activity: 'mining' }
  },

  // === RANKING WEEKLY ===
  {
    id: 'weekly_ratting_ace',
    name: 'Weekly Ratting Ace',
    description: 'Reach #1 in weekly ratting ranking',
    icon: '🏅',
    tier: 'gold',
    type: 'weekly',
    criteria: { type: 'ranking', value: 1, activity: 'ratting' }
  },
  {
    id: 'weekly_mining_ace',
    name: 'Weekly Mining Ace',
    description: 'Reach #1 in weekly mining ranking',
    icon: '🏅',
    tier: 'gold',
    type: 'weekly',
    criteria: { type: 'ranking', value: 1, activity: 'mining' }
  },

  // === RANKING MONTHLY ===
  {
    id: 'monthly_ratting_ace',
    name: 'Monthly Ratting Ace',
    description: 'Reach #1 in monthly ratting ranking',
    icon: '💎',
    tier: 'platinum',
    type: 'monthly',
    criteria: { type: 'ranking', value: 1, activity: 'ratting' }
  },
  {
    id: 'monthly_mining_ace',
    name: 'Monthly Mining Ace',
    description: 'Reach #1 in monthly mining ranking',
    icon: '💎',
    tier: 'platinum',
    type: 'monthly',
    criteria: { type: 'ranking', value: 1, activity: 'mining' }
  }
]

export const TIER_COLORS: Record<MedalTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2'
}

export const getMedalById = (id: string): MedalDefinition | undefined => {
  return EASY_EVE_MEDALS.find(m => m.id === id)
}