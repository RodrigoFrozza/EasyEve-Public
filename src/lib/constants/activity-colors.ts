
import { 
  Gem, 
  Target, 
  Compass, 
  Zap,
  Shield,
  Crosshair,
  TrendingUp,
  Factory,
  type LucideIcon 
} from 'lucide-react'

export type ActivityType = 'mining' | 'ratting' | 'exploration' | 'abyssal' | 'crab' | 'pvp' | 'escalations' | 'industry'

export interface ActivityColorPalette {
  id: ActivityType
  label: string
  primary: string
  accent: string
  gradient: string
  border: string
  text: string
  iconBg: string
  icon: LucideIcon
  sparkline: string
}

export const ACTIVITY_COLORS: Record<ActivityType, ActivityColorPalette> = {
  mining: {
    id: 'mining',
    label: 'Mining',
    primary: 'blue',
    accent: 'cyan',
    gradient: 'from-blue-500/10 to-blue-500/5',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    icon: Gem,
    sparkline: '#00d4ff',
  },
  ratting: {
    id: 'ratting',
    label: 'Ratting',
    primary: 'red',
    accent: 'rose',
    gradient: 'from-red-500/20 via-rose-500/10 to-red-500/5',
    border: 'border-red-500/30',
    text: 'text-red-400',
    iconBg: 'bg-red-500/15',
    icon: Target,
    sparkline: '#ef4444',
  },
  exploration: {
    id: 'exploration',
    label: 'Exploration',
    primary: 'cyan',
    accent: 'indigo',
    gradient: 'from-cyan-500/10 to-cyan-500/5',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    iconBg: 'bg-cyan-500/10',
    icon: Compass,
    sparkline: '#6366f1',
  },
  abyssal: {
    id: 'abyssal',
    label: 'Abyssal',
    primary: 'purple',
    accent: 'rose',
    gradient: 'from-purple-500/20 via-fuchsia-500/10 to-red-500/10',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    icon: Zap,
    sparkline: '#e879f9',
  },
  crab: {
    id: 'crab',
    label: 'Crab Beacon',
    primary: 'orange',
    accent: 'amber',
    gradient: 'from-orange-500/10 to-orange-500/5',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    iconBg: 'bg-orange-500/10',
    icon: Shield,
    sparkline: '#f97316',
  },
  pvp: {
    id: 'pvp',
    label: 'PVP',
    primary: 'red',
    accent: 'rose',
    gradient: 'from-red-500/10 to-red-500/5',
    border: 'border-red-500/20',
    text: 'text-red-400',
    iconBg: 'bg-red-500/10',
    icon: Crosshair,
    sparkline: '#ef4444',
  },
  escalations: {
    id: 'escalations',
    label: 'Escalations',
    primary: 'yellow',
    accent: 'orange',
    gradient: 'from-yellow-500/10 to-yellow-500/5',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    icon: TrendingUp,
    sparkline: '#eab308',
  },
  industry: {
    id: 'industry',
    label: 'Industry',
    primary: 'slate',
    accent: 'gray',
    gradient: 'from-slate-500/10 to-slate-500/5',
    border: 'border-slate-500/20',
    text: 'text-slate-400',
    iconBg: 'bg-slate-500/10',
    icon: Factory,
    sparkline: '#64748b',
  }
}

export function getActivityColors(type: ActivityType): ActivityColorPalette {
  return ACTIVITY_COLORS[type] || ACTIVITY_COLORS.ratting
}

