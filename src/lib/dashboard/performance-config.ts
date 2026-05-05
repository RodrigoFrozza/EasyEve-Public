export interface ActivityConfig {
  label: string;
  color: string;
  description?: string;
}

export const PERFORMANCE_ACTIVITIES: Record<string, ActivityConfig> = {
  mining: {
    label: 'Mineração',
    color: '#fbbf24', // Amber 400
    description: 'Coleta de minérios e gelo em cinturões e anomalias.',
  },
  ratting: {
    label: 'Ratting',
    color: '#f87171', // Red 400
    description: 'Eliminação de piratas NPCs por recompensas de bounty.',
  },
  abyssal: {
    label: 'Abyssal',
    color: '#a855f7', // Purple 500
    description: 'Exploração do Abyssal Deadspace com naves T1-T3.',
  },
  exploration: {
    label: 'Exploração',
    color: '#22d3ee', // Cyan 400
    description: 'Hackeamento de sites de dados e relíquias no espaço.',
  },
  escalations: {
    label: 'Escalações',
    color: '#f97316', // Orange 500
    description: 'Combate em sites de expedição (DED Complex).',
  },
  crab: {
    label: 'CRAB',
    color: '#84cc16', // Lime 500
    description: 'Operações de Beacon de resposta a capital (CRAB).',
  },
  pvp: {
    label: 'PVP',
    color: '#ec4899', // Pink 500
    description: 'Combate contra outros jogadores e frotas.',
  },
};

export const DEFAULT_ACTIVITY_COLOR = '#71717a'; // Zinc 400

export function getActivityConfig(type: string): ActivityConfig {
  return PERFORMANCE_ACTIVITIES[type.toLowerCase()] || {
    label: type,
    color: DEFAULT_ACTIVITY_COLOR,
  };
}
