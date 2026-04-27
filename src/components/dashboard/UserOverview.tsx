'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp,
  User,
  Plus,
  RefreshCw,
  Award
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/session-client'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MedalInfo {
  id: string
  name: string
  icon: string | null
  tier: string
  count: number
}

interface CharacterInfo {
  id: number
  name: string
  isMain: boolean
}

interface UserOverviewProps {
  userId: string
  mainCharacter: {
    id: number
    name: string
    corporation?: {
      name: string
      ticker: string
    } | null
    alliance?: {
      name: string
    } | null
  } | null
  characters: CharacterInfo[]
  totalReputation: number
  medals: MedalInfo[]
  activeActivity: {
    type: string
    startTime: Date
  } | null
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export function UserOverview({
  userId,
  mainCharacter,
  characters,
  totalReputation,
  medals,
  activeActivity
}: UserOverviewProps) {
  const router = useRouter()
  const { t } = useTranslations()

  return (
    <TooltipProvider delayDuration={0}>
    <div className="space-y-4">
      {/* Header Card with Characters */}
      <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[32px] p-6 shadow-2xl overflow-hidden relative group">
        {/* Subtle glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 blur-[80px] rounded-full group-hover:bg-cyan-500/15 transition-colors" />
        
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <div className="flex -space-x-4 items-center">
            {characters.filter(c => c.isMain).map(char => (
              <Avatar key={char.id} className="h-20 w-20 border-4 border-cyan-500/30 relative z-10 shadow-2xl ring-1 ring-white/10">
                <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=256`} />
                <AvatarFallback className="bg-zinc-900 text-cyan-400 font-outfit text-2xl">
                  {char.name[0]}
                </AvatarFallback>
              </Avatar>
            ))}
            <div className="flex -space-x-3">
              {characters.filter(c => !c.isMain).slice(0, 3).map((char, i) => (
                <Avatar key={char.id} className={cn("h-11 w-11 border-2 border-zinc-950 shadow-lg relative transition-all hover:-translate-y-1 hover:z-20", i === 0 && "ml-2")}>
                  <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
                  <AvatarFallback className="text-[10px] bg-zinc-900 font-inter">{char.name[0]}</AvatarFallback>
                </Avatar>
              ))}
              {characters.length > 4 && (
                <div className="h-11 w-11 rounded-full bg-zinc-900 border-2 border-zinc-950 flex items-center justify-center text-[10px] text-zinc-500 font-black relative z-0">
                  +{characters.length - 4}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-1">
              <h2 className="text-2xl font-black text-white font-outfit tracking-tight leading-none">
                {mainCharacter?.name || 'Pilot'}
              </h2>
              {activeActivity && (
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-2 py-0 h-5 text-[10px] font-black uppercase tracking-widest animate-pulse mx-auto md:mx-0">
                  Online
                </Badge>
              )}
            </div>
            
            {mainCharacter?.corporation ? (
              <div className="flex items-center justify-center md:justify-start gap-1.5 text-xs font-medium text-zinc-400 font-inter">
                <span className="text-amber-400/80 font-black">[{mainCharacter.corporation.ticker}]</span>
                <span>{mainCharacter.corporation.name}</span>
                {mainCharacter.alliance && (
                  <>
                    <span className="text-zinc-700">•</span>
                    <span className="text-zinc-500">{mainCharacter.alliance.name}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-inter">Independent Pilot</div>
            )}
          </div>

          {/* Commands - INTEGRADOS NO CARD */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  className="bg-blue-600 hover:bg-blue-500 text-white border-none rounded-xl h-10 w-10 p-0 shadow-[0_0_15px_rgba(37,99,235,0.2)] transition-all"
                  onClick={() => router.push('/dashboard/activity')}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('dashboard.commands.startActivity')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline"
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 rounded-xl h-10 w-10 p-0"
                  onClick={() => router.push('/dashboard/activity')}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('dashboard.commands.syncEsi')}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 rounded-xl h-10 w-10 p-0 text-zinc-300"
                  onClick={() => router.push(`/players/${userId}`)}
                >
                  <User className="h-4 w-4 text-cyan-500/50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('dashboard.commands.profile')}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-1 p-4 md:p-0 rounded-2xl bg-white/[0.02] md:bg-transparent w-full md:w-auto justify-center">
            <div className="flex items-center gap-2 text-cyan-400">
              <TrendingUp className="h-4 w-4" />
              <span className="text-2xl font-black font-inter tracking-tighter">{totalReputation.toLocaleString()}</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-600 font-outfit">REPUTATION</span>
          </div>
        </div>
      </div>

      {/* Active Operations Compact Row */}
      {activeActivity && (
        <Link href="/dashboard/activity" className="flex items-center gap-3 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full hover:bg-emerald-500/10 transition-all cursor-pointer">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300 uppercase">{activeActivity.type}</span>
          <span className="text-[10px] text-zinc-500">
            <FormattedDate date={activeActivity.startTime} mode="time" />
          </span>
        </Link>
      )}      {/* Stats & Medals Row */}
      {medals.length > 0 && (
        <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[24px] p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-500 font-outfit flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-amber-500/50" />
              MEDALS
            </h3>
            <Link href={`/players/${userId}?tab=medals`} className="text-[10px] font-black text-cyan-500/60 hover:text-cyan-400 uppercase tracking-widest transition-colors">
              ALL
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {medals.slice(0, 3).map((medal) => (
              <div key={medal.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group/medal">
                <div 
                  className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center text-xl shadow-inner group-hover/medal:scale-110 transition-transform"
                  style={{ color: TIER_COLORS[medal.tier] || '#fff' }}
                >
                  {medal.icon || '🎖️'}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-zinc-100 font-inter uppercase tracking-tight">{medal.name}</div>
                  <div className="text-[9px] text-zinc-600 uppercase font-black tracking-widest">{medal.tier}</div>
                </div>
                {medal.count > 1 && (
                  <div className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] font-black text-zinc-400 border border-white/5">
                    x{medal.count}
                  </div>
                )}
              </div>
            ))}
          </div>
</div>
        )}
    </div>
    </TooltipProvider>
  )
}
