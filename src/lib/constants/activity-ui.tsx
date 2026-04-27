'use client'

import { 
  Gem, 
  Crosshair, 
  Zap, 
  Compass, 
  ShieldCheck, 
  AlertTriangle, 
  Target,
  TrendingUp,
  Database,
  LucideIcon 
} from 'lucide-react'

export interface ActivityUIConfig {
  icon: LucideIcon
  color: string
  bg: string
}

export const ACTIVITY_UI_MAPPING: Record<string, ActivityUIConfig> = {
  mining: { icon: Gem, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ratting: { icon: Crosshair, color: 'text-red-400', bg: 'bg-red-500/10' },
  abyssal: { icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  exploration: { icon: Compass, color: 'text-green-400', bg: 'bg-green-500/10' },
  crab: { icon: ShieldCheck, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  escalations: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  pvp: { icon: Target, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  finance: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  market: { icon: Database, color: 'text-blue-400', bg: 'bg-blue-500/10' },
}
