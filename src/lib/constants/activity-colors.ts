
import { 
  Gem, 
  Target, 
  Compass, 
  Zap,
  Shield,
  Crosshair,
  TrendingUp,
  Factory,
  Recycle,
  type LucideIcon 
} from 'lucide-react'

export type ActivityType =
  | 'mining'
  | 'ratting'
  | 'exploration'
  | 'abyssal'
  | 'salvaging'
  | 'crab'
  | 'pvp'
  | 'escalations'
  | 'industry'

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
    primary: 'cyan',
    accent: 'sky',
    gradient: 'from-cyan-300/28 via-cyan-400/12 to-transparent',
    border: 'border-cyan-300/45',
    text: 'text-cyan-100',
    iconBg: 'bg-cyan-300/25',
    icon: Gem,
    sparkline: '#67e8f9',
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
    primary: 'orange',
    accent: 'amber',
    gradient: 'from-orange-500/15 to-orange-950/5',
    border: 'border-orange-500/25',
    text: 'text-orange-400',
    iconBg: 'bg-orange-500/12',
    icon: Compass,
    sparkline: '#f97316',
  },
  abyssal: {
    id: 'abyssal',
    label: 'Abyssal',
    primary: 'purple',
    accent: 'violet',
    gradient: 'from-purple-500/20 via-purple-950/10 to-eve-dark',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    icon: Zap,
    sparkline: '#a855f7',
  },
  salvaging: {
    id: 'salvaging',
    label: 'Salvaging',
    primary: 'lime',
    accent: 'green',
    gradient: 'from-lime-500/15 via-lime-950/8 to-transparent',
    border: 'border-lime-500/25',
    text: 'text-lime-400',
    iconBg: 'bg-lime-500/12',
    icon: Recycle,
    sparkline: '#84cc16',
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

