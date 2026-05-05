import { 
  Swords, 
  Pickaxe, 
  Compass, 
  Factory, 
  Zap, 
  Ship, 
  Globe, 
  Truck, 
  Users, 
  ShieldAlert,
  Ghost,
  Target,
  Tractor,
  Layers,
  CircleDollarSign,
  BoxSelect
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Canonical activity tags for characters (ESI-linked pilots).
 * These are used as suggestions in the UI.
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
  'PvPer',
  'Hauler',
  'Alt',
  'Capital Pilot',
] as const

export type CharacterActivityTag = string // Now allowing any string, but types are kept for compatibility

export const CHARACTER_ACTIVITY_TAG_SET = new Set<string>(
  CHARACTER_ACTIVITY_TAGS as readonly string[]
)

/**
 * Mapping of canonical tags to their translation keys.
 */
export const CHARACTER_TAG_TRANSLATION_KEYS: Record<string, string> = {
  'Ratter': 'characters.tags.menuRatter',
  'Miner': 'characters.tags.menuMiner',
  'Explorer': 'characters.tags.menuExplorer',
  'Industrialist': 'characters.tags.menuIndustrialist',
  'Skill Point Farmer': 'characters.tags.menuSpFarmer',
  'Abyssal Runner': 'characters.tags.menuAbyssalRunner',
  'Planet Manager (PI)': 'characters.tags.menuPiManager',
  'PvPer': 'characters.tags.menuPvPer',
  'Hauler': 'characters.tags.menuHauler',
  'Alt': 'characters.tags.menuAlt',
  'Capital Pilot': 'characters.tags.menuCapital',
}

/**
 * Styling metadata for tags.
 */
export const CHARACTER_TAG_STYLE: Record<string, { border: string, text: string, bg: string, iconClass: string, icon: LucideIcon }> = {
  'Ratter': { border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/5', iconClass: 'text-red-400', icon: Target },
  'Miner': { border: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/5', iconClass: 'text-emerald-400', icon: Pickaxe },
  'Explorer': { border: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/5', iconClass: 'text-amber-400', icon: Compass },
  'Industrialist': { border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/5', iconClass: 'text-purple-400', icon: Factory },
  'Skill Point Farmer': { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/5', iconClass: 'text-cyan-400', icon: Zap },
  'Abyssal Runner': { border: 'border-orange-500/30', text: 'text-orange-400', bg: 'bg-orange-500/5', iconClass: 'text-orange-400', icon: Ghost },
  'Planet Manager (PI)': { border: 'border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/5', iconClass: 'text-blue-400', icon: Globe },
  'PvPer': { border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/5', iconClass: 'text-red-400', icon: Swords },
  'Hauler': { border: 'border-cyan-500/30', text: 'text-cyan-400', bg: 'bg-cyan-500/5', iconClass: 'text-cyan-400', icon: Truck },
  'Alt': { border: 'border-zinc-500/30', text: 'text-zinc-400', bg: 'bg-zinc-500/5', iconClass: 'text-zinc-400', icon: Users },
  'Capital Pilot': { border: 'border-indigo-500/30', text: 'text-indigo-400', bg: 'bg-indigo-500/5', iconClass: 'text-indigo-400', icon: ShieldAlert },
}


/**
 * Validates a list of tags. 
 * Allows any string up to 30 characters, max 20 tags.
 */
export function validateCharacterTags(tags: unknown): tags is string[] {
  if (!Array.isArray(tags)) return false
  if (tags.length > 20) return false
  return tags.every((t) => 
    typeof t === 'string' && 
    t.length > 0 && 
    t.length <= 30
  )
}

// Deprecated, use validateCharacterTags
export const isAllowedCharacterTagList = validateCharacterTags
