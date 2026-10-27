import type { Module, ShipStats } from '@/types/fit'

export interface FitSuggestion {
  id: string
  kind: 'cpu' | 'power' | 'capacitor' | 'slots' | 'damage'
  message: string
  priority: 'high' | 'medium' | 'low'
}

export interface FitPreset {
  id: string
  role: 'pvp-frig' | 'ratting-bs' | 'logi' | 'mining'
  title: string
  summary: string
  moduleHints: string[]
  tacticalNotes: string[]
}

export function buildFitSuggestions(stats: ShipStats, modules: Module[]): FitSuggestion[] {
  const suggestions: FitSuggestion[] = []
  if (stats.cpu.overflow) {
    suggestions.push({
      id: 'cpu-overflow',
      kind: 'cpu',
      priority: 'high',
      message: 'CPU overflow: replace one high-slot module with a compact/meta variant or add a co-processor.',
    })
  }
  if (stats.power.overflow) {
    suggestions.push({
      id: 'pg-overflow',
      kind: 'power',
      priority: 'high',
      message: 'Powergrid overflow: downgrade a weapon tier, use an ancillary current router, or add reactor control.',
    })
  }
  if (!stats.capacitor.stable) {
    suggestions.push({
      id: 'cap-unstable',
      kind: 'capacitor',
      priority: 'high',
      message: `Capacitor unstable (${stats.capacitor.percent.toFixed(1)}%): reduce active modules or add battery/recharger.`,
    })
  }
  if (stats.validation.slotsOverflow.high || stats.validation.slotsOverflow.med || stats.validation.slotsOverflow.low || stats.validation.slotsOverflow.rig) {
    suggestions.push({
      id: 'slot-overflow',
      kind: 'slots',
      priority: 'high',
      message: 'Slot overflow detected: remove extra modules in overflowing racks.',
    })
  }
  const weaponModules = modules.filter((m) => (m.groupName || '').toLowerCase().includes('turret') || (m.groupName || '').toLowerCase().includes('launcher'))
  if (weaponModules.length >= 2) {
    const turretCount = weaponModules.filter((m) => (m.groupName || '').toLowerCase().includes('turret')).length
    const launcherCount = weaponModules.filter((m) => (m.groupName || '').toLowerCase().includes('launcher')).length
    if (turretCount > 0 && launcherCount > 0) {
      suggestions.push({
        id: 'mixed-weapons',
        kind: 'damage',
        priority: 'medium',
        message: 'Mixed turret + launcher platform detected: consider specializing for stronger bonuses and cleaner ammo logistics.',
      })
    }
  }
  return suggestions
}

export function defaultRolePresets(): FitPreset[] {
  return [
    {
      id: 'pvp-frig-baseline',
      role: 'pvp-frig',
      title: 'PvP Frigate Baseline',
      summary: 'Fast tackle with scram/web and compact tank.',
      moduleHints: ['Propulsion module', 'Warp scrambler', 'Stasis webifier', 'Damage control'],
      tacticalNotes: ['Prioritize speed and signature control', 'Keep cap stable under point+prop'],
    },
    {
      id: 'ratting-bs-baseline',
      role: 'ratting-bs',
      title: 'Ratting Battleship Baseline',
      summary: 'Sustained PvE DPS with cap-aware tank.',
      moduleHints: ['Main weapon rack with matching damage type', 'Large repairer or shield booster', 'Cap support'],
      tacticalNotes: ['Optimize for sustained cap and range control', 'Use ammo profile by NPC faction'],
    },
    {
      id: 'logi-baseline',
      role: 'logi',
      title: 'Logistics Baseline',
      summary: 'Remote reps, cap chain readiness, survivability.',
      moduleHints: ['Remote armor/shield reps', 'Cap transfer', 'Resist profile', 'Afterburner'],
      tacticalNotes: ['Prioritize lock range and scan resolution', 'Validate cap chain stability'],
    },
    {
      id: 'mining-baseline',
      role: 'mining',
      title: 'Mining Baseline',
      summary: 'Yield + safety with practical mobility.',
      moduleHints: ['Mining lasers/strips', 'Survey scanner', 'Tank layer', 'Mobility utility'],
      tacticalNotes: ['Balance yield and survival', 'Keep fitting within CPU/PG margins'],
    },
  ]
}
