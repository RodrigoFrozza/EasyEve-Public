export interface ActivityConfig {
  label: string;
  color: string;
  description?: string;
}

export const PERFORMANCE_ACTIVITIES: Record<string, ActivityConfig> = {
  mining: {
    label: 'MINING',
    color: '#06b6d4', // Cyan 500
    description: 'Extraction of ore and ice from belts and anomalies.',
  },
  ratting: {
    label: 'RATTING',
    color: '#f59e0b', // Amber 500
    description: 'Elimination of NPC pirates for bounty rewards.',
  },
  abyssal: {
    label: 'ABYSSAL',
    color: '#f43f5e', // Rose 500
    description: 'Exploration of Abyssal Deadspace nodes.',
  },
  exploration: {
    label: 'EXPLORATION',
    color: '#8b5cf6', // Violet 500
    description: 'Data and relic site hacking operations.',
  },
  escalations: {
    label: 'ESCALATIONS',
    color: '#10b981', // Emerald 500
    description: 'Combat in expedition sites (DED complexes).',
  },
  crab: {
    label: 'CRAB',
    color: '#3b82f6', // Blue 500
    description: 'Capital Response Activation Beacon operations.',
  },
  pvp: {
    label: 'PVP',
    color: '#ef4444', // Red 500
    description: 'Combat engagement against hostile pilots.',
  },
  pi: {
    label: 'PI',
    color: '#a78bfa', // Violet 400
    description: 'Planetary Industry — current colony NET ISK/h (real production, not potential).',
  },
};

export const DEFAULT_ACTIVITY_COLOR = '#27272a'; // Zinc 800

export function getActivityConfig(type: string): ActivityConfig {
  return PERFORMANCE_ACTIVITIES[type.toLowerCase()] || {
    label: type.toUpperCase(),
    color: DEFAULT_ACTIVITY_COLOR,
  };
}
