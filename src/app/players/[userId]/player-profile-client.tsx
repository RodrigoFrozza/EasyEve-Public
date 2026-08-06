'use client'

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  MessageSquare, Mail, Gift, UserPlus, Flag, 
  Shield, Gem, Activity, Loader2, Trophy, Users, Layout, 
  Copy, Plus, ChevronRight, Building2, Cog,
  TrendingUp, Zap, Target, Database, Rocket
} from 'lucide-react'
import { useSession } from '@/lib/session-client'
import { useRouter } from 'next/navigation'
import { cn, formatNumber, formatISK } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Image from 'next/image'
import { ProfileBio } from '@/components/players/ProfileBio'
import { SocialLinks } from '@/components/players/SocialLinks'

interface CharacterInfo {
  id: number
  name: string
  tags: string[]
  isMain?: boolean
  corporation: {
    id: number
    name: string
    ticker: string
  } | null
  alliance: {
    id: number
    name: string
  } | null
}

interface MedalInfo {
  id: string
  name: string
  description: string | null
  icon: string | null
  tier: string
  count: number
  awardedAt: Date
}

interface PlayerProfileClientProps {
  userId: string
  accountCode: string | null
  createdAt: Date
  lastLoginAt: Date | null
  isOnline: boolean
  isTester: boolean
  profile: {
    bio: string | null
    bannerUrl: string | null
    discordUrl: string | null
    websiteUrl: string | null
    customThemeColor: string | null
  }
  privacySettings?: {
    showKills: boolean
    showDeaths: boolean
    showReputation: boolean
    showMedals: boolean
    showActivities: boolean
    showFits: boolean
    showContacts: boolean
    showLocation: boolean
    showShip: boolean
    showWallet: boolean
  }
  mainCharacter: CharacterInfo | null
  allCharacters: CharacterInfo[]
  charactersCount: number
  friendCount: number
  contactStatus: 'none' | 'pending' | 'friends'
  publicFits: Array<{
    id: string
    name: string
    ship: string | null
    shipTypeId: number | null
    updatedAt: Date
    eft: string
  }>
  totalReputation: number
  activeActivity: {
    type: string
    startTime: Date
  } | null
  medals: MedalInfo[]
  feats: {
    totalHours: number
    activityCount: number
    mining: { volume: number; topShip: string | null; topOre: string | null }
    industry: { jobs: number }
    trading: { profit: number }
    exploration: { sites: number }
  }
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
}

export function PlayerProfileClient({
  userId,
  accountCode,
  createdAt,
  lastLoginAt,
  isOnline,
  isTester,
  profile: initialProfile,
  privacySettings,
  mainCharacter,
  allCharacters,
  charactersCount,
  friendCount,
  contactStatus,
  publicFits,
  totalReputation,
  activeActivity,
  medals,
  feats,
}: PlayerProfileClientProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useTranslations()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [profile, setProfile] = useState(initialProfile)

  const isOwnProfile = session?.user?.id === userId
  const isContact = contactStatus === 'friends'
  const isPending = contactStatus === 'pending'

  const privacy = privacySettings || {
    showKills: true,
    showDeaths: true,
    showReputation: true,
    showMedals: true,
    showActivities: true,
    showFits: true,
    showContacts: true,
    showLocation: false,
    showShip: false,
    showWallet: true,
  }

  const handleUpdateBio = async (newBio: string) => {
    const res = await fetch('/api/players/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: newBio || null }),
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to update bio')
    }
    setProfile(prev => ({ ...prev, bio: newBio }))
    router.refresh()
  }
  
  const handleCopyEFT = (eft: string) => {
    if (!eft) {
      toast.error('No EFT data available')
      return
    }
    
    try {
      navigator.clipboard.writeText(eft)
      toast.success(t('players.profile.designs.copyEftSuccess') || 'EFT Copied to Clipboard!')
    } catch (err) {
      console.error('Clipboard error:', err)
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleSendMessage = async () => {
    if (!session) {
      router.push('/api/auth/signin')
      return
    }
    setLoadingAction('message')
    toast.info('Comms system coming soon!')
    setLoadingAction(null)
  }

  const handleAddContact = async () => {
    if (!session) {
      router.push('/api/auth/signin')
      return
    }
    setLoadingAction('contact')
    try {
      const res = await fetch(`/api/players/${userId}/contact`, {
        method: 'POST',
      })
      const data = await res.json()
      
      if (res.ok && data.pending) {
        toast.success('Friend request sent!')
      } else if (res.status === 400) {
        toast.info(data.error || 'Request already sent')
      } else {
        toast.error('Failed to send request')
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to send request')
    }
    setLoadingAction(null)
  }

  const { scrollY } = useScroll()
  const bannerY = useTransform(scrollY, [0, 500], [0, 200])
  const bannerScale = useTransform(scrollY, [0, 500], [1.05, 1.2])
  const bannerOpacity = useTransform(scrollY, [0, 300], [1, 0.5])

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-400 selection:bg-blue-500/30 selection:text-blue-200">
      {/* Tactical Overlay Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />

      {/* Hero Banner Section */}
      <div className="relative h-[300px] md:h-[450px] w-full overflow-hidden border-b border-white/5">
        <motion.div 
          style={{ 
            backgroundImage: `url(${profile.bannerUrl || 'https://images.evetech.net/types/34562/render?size=1024'})`,
            y: bannerY,
            scale: bannerScale,
            opacity: bannerOpacity
          }}
          className="absolute inset-0 bg-cover bg-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
        
        {/* Cinematic Flare Effect */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none mix-blend-screen" />
        
        {/* Animated Particles/Fog for depth */}
        <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none">
          <div className="absolute inset-0 bg-[url('/effects/noise.png')] opacity-10 animate-pulse" />
        </div>
      </div>

      {/* Main Profile Container */}
      <div className="container mx-auto px-4 -mt-32 relative z-10 pb-20">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Top Header Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end"
          >
            {/* Avatar & Basic Info */}
            <div className="lg:col-span-8 flex flex-col md:flex-row items-center md:items-end gap-8">
              <div className="relative group">
                <div className="h-48 w-48 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl relative bg-zinc-900/50 backdrop-blur-xl">
                  <Avatar className="h-full w-full rounded-none">
                    <AvatarImage 
                      src={mainCharacter ? `https://images.evetech.net/characters/${mainCharacter.id}/portrait?size=512` : ''} 
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <AvatarFallback className="bg-zinc-900 text-zinc-700 text-6xl font-black font-outfit uppercase">
                      {mainCharacter?.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Status Indicator */}
                  <div className={cn(
                    "absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-[#050505] shadow-lg",
                    isOnline ? "bg-emerald-500 shadow-emerald-500/20" : "bg-zinc-700"
                  )} />
                </div>
              </div>

              <div className="flex-1 space-y-4 text-center md:text-left">
                <div className="space-y-1">
                  <div className="flex items-center justify-center md:justify-start gap-4 flex-wrap">
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter font-outfit uppercase">
                      {mainCharacter?.name || 'Unknown Pilot'}
                    </h1>
                    {isOnline && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest font-outfit">
                            {t('players.profile.liveSignal')}
                          </span>
                        </div>
                        {isTester && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50 text-[9px] px-2 py-0.5 font-bold">
                            TESTER
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {mainCharacter?.corporation && (
                    <div className="flex items-center justify-center md:justify-start gap-3 text-zinc-500 font-outfit font-bold text-xs uppercase tracking-[0.1em]">
                      <span className="text-blue-400">[{mainCharacter.corporation.ticker}]</span>
                      <span className="text-zinc-300">{mainCharacter.corporation.name}</span>
                      {mainCharacter.alliance && (
                        <>
                          <span className="text-zinc-700">/</span>
                          <span className="text-zinc-400">{mainCharacter.alliance.name}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-center md:justify-start items-center gap-6">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] font-outfit text-zinc-500">
                    {t('players.profile.registry')}: <span className="text-zinc-300 ml-1">
                      <FormattedDate date={createdAt} options={{ year: 'numeric', month: 'short' }} />
                    </span>
                  </div>
                  <SocialLinks 
                    discordUrl={profile.discordUrl} 
                    websiteUrl={profile.websiteUrl} 
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-4 flex flex-wrap justify-center lg:justify-end gap-3 pb-2">
              <Button 
                variant="outline"
                className="h-11 px-6 bg-zinc-900/50 border-white/5 hover:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest font-outfit transition-all"
                onClick={handleSendMessage}
              >
                <MessageSquare className="h-4 w-4 mr-2 text-blue-400" />
                {t('players.profile.sendComm')}
              </Button>
              
              {!isOwnProfile && (
                <>
                  {isContact ? (
                    <Badge variant="outline" className="h-11 px-6 bg-emerald-500/5 text-emerald-400 border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest font-outfit">
                      {t('players.profile.verifiedFriend')}
                    </Badge>
                  ) : isPending ? (
                    <Badge variant="outline" className="h-11 px-6 bg-amber-500/5 text-amber-400 border-amber-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest font-outfit">
                      {t('players.profile.pendingHandshake')}
                    </Badge>
                  ) : (
                    <Button 
                      className="h-11 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest font-outfit shadow-lg shadow-blue-900/20 transition-all"
                      onClick={handleAddContact}
                      disabled={!!loadingAction}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {t('players.profile.addContact')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Stats & Feats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Tactical Stats */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Main Metrics Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  ...(privacy.showReputation ? [{ label: t('players.profile.stats.reputation'), value: totalReputation, color: 'text-amber-400', glow: 'group-hover:shadow-amber-500/20', icon: Trophy }] : []),
                  { label: t('players.profile.stats.characters'), value: charactersCount, color: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20', icon: Users },
                  { label: t('players.profile.stats.contacts'), value: friendCount, color: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/20', icon: MessageSquare },
                  { label: t('players.profile.stats.publicFits'), value: publicFits.length, color: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20', icon: Layout },
                ].map((stat, idx) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 + 0.3 }}
                    whileHover={{ y: -5 }}
                    className={cn(
                      "relative bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl p-6 flex flex-col items-center text-center group transition-all duration-300",
                      "hover:bg-zinc-800/40 hover:border-white/10 hover:shadow-2xl",
                      stat.glow
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl bg-zinc-950/50 mb-3 border border-white/5 group-hover:scale-110 transition-transform duration-500",
                      stat.color
                    )}>
                      <stat.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] font-outfit mb-1">{stat.label}</span>
                    <span className={cn("text-3xl font-black font-inter tracking-tighter", stat.color)}>
                      {formatNumber(stat.value)}
                    </span>
                    
                    {/* Decorative Corner */}
                    <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none overflow-hidden rounded-tr-2xl">
                      <div className="absolute top-0 right-0 w-[1px] h-4 bg-white/20" />
                      <div className="absolute top-0 right-0 w-4 h-[1px] bg-white/20" />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Feats Engine Dashboard */}
              {privacy.showWallet && (
                <div className="relative bg-zinc-900/10 backdrop-blur-xl border border-white/5 rounded-[32px] overflow-hidden group/feats">
                  {/* Glass Background Highlight */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover/feats:opacity-100 transition-opacity duration-1000" />
                  
                  <div className="relative px-8 py-6 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-900/20">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white font-outfit">
                          {t('players.profile.feats.title')}
                        </h3>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Tactical Performance Analysis</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{t('players.profile.feats.totalTime')}</span>
                        <span className="text-sm font-black text-white font-mono">{feats.totalHours}H</span>
                      </div>
                      <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
                      <div className="flex flex-col items-end">
                        <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">{t('players.profile.feats.operations')}</span>
                        <span className="text-sm font-black text-white font-mono">{feats.activityCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-0 py-10">
                    {[
                      { 
                        title: t('players.profile.feats.combat'), 
                        value: feats.activityCount, 
                        unit: 'OPs',
                        icon: Shield, 
                        color: 'text-rose-500', 
                        bg: 'bg-rose-500/5',
                        border: 'border-rose-500/10',
                        trend: 'STABLE'
                      },
                      { 
                        title: t('players.profile.feats.mining'), 
                        value: formatNumber(feats.mining.volume), 
                        unit: 'm³',
                        icon: Gem, 
                        color: 'text-blue-400', 
                        bg: 'bg-blue-400/5',
                        border: 'border-blue-400/10',
                        trend: 'PEAK'
                      },
                      { 
                        title: t('players.profile.feats.industry'), 
                        value: formatNumber(feats.industry.jobs), 
                        unit: 'JOBS',
                        icon: Cog, 
                        color: 'text-purple-400', 
                        bg: 'bg-purple-400/5',
                        border: 'border-purple-400/10',
                        trend: 'ACTIVE'
                      },
                      { 
                        title: t('players.profile.feats.trading'), 
                        value: formatNumber(Math.floor(feats.trading.profit / 1000000)), 
                        unit: 'M ISK',
                        icon: TrendingUp, 
                        color: 'text-amber-500', 
                        bg: 'bg-amber-500/5',
                        border: 'border-amber-500/10',
                        trend: 'PROFIT'
                      },
                      { 
                        title: t('players.profile.feats.exploration'), 
                        value: formatNumber(feats.exploration.sites), 
                        unit: 'SIGS',
                        icon: Flag, 
                        color: 'text-emerald-500', 
                        bg: 'bg-emerald-500/5',
                        border: 'border-emerald-500/10',
                        trend: 'DISCOVERY'
                      }
                    ].map((feat, idx) => (
                      <motion.div 
                        key={feat.title}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        viewport={{ once: true }}
                        className={cn(
                          "relative space-y-6 px-8 py-4 border-white/5",
                          idx !== 0 && "lg:border-l",
                          idx > 1 && "border-t md:border-t-0",
                          idx > 2 && "lg:border-t-0"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className={cn("p-2 rounded-lg border", feat.bg, feat.border)}>
                            <feat.icon className={cn("h-4 w-4", feat.color)} />
                          </div>
                          <span className={cn("text-[7px] font-black tracking-widest px-1.5 py-0.5 rounded-sm bg-white/5", feat.color)}>
                            {feat.trend}
                          </span>
                        </div>
                        
                        <div>
                          <p className="text-[10px] font-black text-white font-outfit uppercase tracking-tight truncate">
                            {feat.title}
                          </p>
                          <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-white font-mono tracking-tighter">
                              {feat.value}
                            </span>
                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                              {feat.unit}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar (Visual decoration) */}
                        <div className="h-1 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            whileInView={{ width: '60%' }}
                            transition={{ delay: idx * 0.1 + 0.5, duration: 1 }}
                            className={cn("h-full rounded-full opacity-50", feat.color.replace('text-', 'bg-'))} 
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs Section */}
              <Tabs defaultValue="hangar" className="space-y-6">
                <TabsList className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 p-1 rounded-2xl h-14 w-full md:w-auto">
                  <TabsTrigger 
                    value="hangar" 
                    className="h-full px-8 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/20 font-outfit transition-all duration-300"
                  >
                    <Building2 className="h-3.5 w-3.5 mr-2" />
                    {t('players.profile.personnel')}
                    <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/5 text-[8px] opacity-50">{allCharacters.length}</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="fits" 
                    className="h-full px-8 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/20 font-outfit transition-all duration-300"
                  >
                    <Layout className="h-3.5 w-3.5 mr-2" />
                    {t('players.profile.designs')}
                    <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/5 text-[8px] opacity-50">{publicFits.length}</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="medals" 
                    className="h-full px-8 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-600/20 font-outfit transition-all duration-300"
                  >
                    <Trophy className="h-3.5 w-3.5 mr-2" />
                    {t('players.profile.hallOfValor')}
                    <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/5 text-[8px] opacity-50">{medals.length}</span>
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  <TabsContent value="hangar" className="mt-0 focus-visible:outline-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {allCharacters.map((char) => (
                        <div
                          key={char.id}
                          className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-5 flex items-center gap-5 group hover:bg-zinc-800/40 hover:border-white/10 transition-all duration-300"
                        >
                          <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/5 relative">
                            <Image 
                              src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} 
                              alt={char.name}
                              width={64}
                              height={64}
                              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            {char.isMain && (
                              <div className="absolute inset-x-0 bottom-0 bg-blue-600 text-[7px] font-black text-center py-0.5 uppercase tracking-widest font-outfit">
                                MAIN
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-white truncate font-outfit uppercase tracking-tight group-hover:text-blue-400 transition-colors">
                              {char.name}
                            </h4>
                            <p className="text-[10px] text-zinc-500 truncate font-mono uppercase tracking-tight mt-0.5 opacity-60">
                              {char.corporation?.ticker ? `[${char.corporation.ticker}] ${char.corporation.name}` : t('players.profile.bio.independent')}
                            </p>
                            <div className="flex gap-1.5 mt-2.5">
                              {char.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded-sm bg-white/5 text-[7px] font-bold text-zinc-400 border border-white/5 uppercase">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="fits" className="mt-0 focus-visible:outline-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* Search & Filter fits (Visual only for now) */}
                      <div className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-4 rounded-2xl">
                        <div className="flex-1 h-9 bg-zinc-950/50 rounded-lg border border-white/5 px-3 flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-zinc-600" />
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{t('players.profile.designs.recent')}</span>
                        </div>
                        {isOwnProfile && (
                          <Link href="/dashboard/fits">
                            <Button className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-9 px-4 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-600/20 transition-all">
                              <Plus className="h-3.5 w-3.5 mr-2" />
                              {t('players.profile.designs.newFit')}
                            </Button>
                          </Link>
                        )}
                      </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {publicFits.map((fit) => (
                        <div key={fit.id} className="group relative">
                          <Link href={`/fits/${fit.id}`}>
                            <div className="bg-zinc-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-5 flex items-center gap-5 group-hover:bg-zinc-800/40 group-hover:border-blue-500/30 transition-all duration-300 cursor-pointer h-full">
                              <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/5 relative shadow-inner">
                                {fit.shipTypeId ? (
                                  <Image 
                                    src={`https://images.evetech.net/types/${fit.shipTypeId}/render?size=128`} 
                                    alt={fit.ship || 'Ship'}
                                    width={80}
                                    height={80}
                                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center text-zinc-700">
                                    <Layout className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-sm font-black text-white truncate font-outfit uppercase group-hover:text-blue-400 transition-colors">
                                    {fit.name}
                                  </h4>
                                  <ChevronRight className="h-3.5 w-3.5 text-zinc-700 group-hover:text-blue-400 transition-all" />
                                </div>
                                <p className="text-[10px] text-zinc-500 truncate font-mono uppercase tracking-tight mt-1 opacity-60">
                                  {fit.ship || 'Unknown Hull'}
                                </p>
                                <div className="flex items-center gap-3 mt-4">
                                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] font-outfit">
                                    <Activity className="h-2.5 w-2.5 inline mr-1 opacity-50" />
                                    {t('common.weeksAgo', { count: Math.ceil((Date.now() - new Date(fit.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)) })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Link>
                          
                          {/* Quick Actions Hover Over */}
                          <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                            <Button 
                              size="icon" 
                              variant="secondary" 
                              className="h-8 w-8 rounded-lg bg-zinc-950/90 border border-white/10 backdrop-blur-md hover:bg-blue-600 hover:text-white transition-all shadow-xl"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCopyEFT(fit.eft);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {publicFits.length === 0 && (
                        <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-[40px] opacity-30 flex flex-col items-center gap-4 bg-zinc-900/10">
                          <div className="p-4 rounded-full bg-zinc-900/50">
                            <Layout className="h-10 w-10 text-zinc-700" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase tracking-[0.4em] font-outfit">
                              {t('players.profile.designs.empty')}
                            </p>
                            <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">No tactical drafts shared</p>
                          </div>
                        </div>
                      )}
                    </div>
                    </motion.div>
                  </TabsContent>

                  <TabsContent value="medals" className="mt-0 focus-visible:outline-none">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {medals.map((medal) => (
                        <div
                          key={medal.id}
                          className="bg-zinc-900/20 backdrop-blur-sm border border-white/5 rounded-2xl p-6 flex items-center gap-6 group hover:bg-zinc-800/30 hover:border-white/10 transition-all duration-300"
                        >
                          <div 
                            className="h-20 w-20 shrink-0 rounded-2xl bg-zinc-950/50 border border-white/5 flex items-center justify-center text-4xl shadow-2xl relative group-hover:scale-105 transition-transform duration-500 overflow-hidden"
                          >
                            {/* Inner Glow based on tier */}
                            <div 
                              className="absolute inset-0 opacity-10 blur-xl" 
                              style={{ backgroundColor: TIER_COLORS[medal.tier] || '#fff' }}
                            />
                            <span className="relative z-10 drop-shadow-2xl">{medal.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-white font-outfit uppercase tracking-tight group-hover:text-blue-400 transition-colors truncate">
                                {medal.name}
                              </h4>
                              {medal.count > 1 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-500 border border-white/5 text-[9px] font-black">
                                  x{medal.count}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 font-medium font-inter mt-1.5 line-clamp-2 leading-relaxed opacity-70">
                              {medal.description}
                            </p>
                            <div className="flex items-center gap-4 mt-4">
                              <span 
                                className="text-[8px] font-black uppercase tracking-[0.2em] font-outfit px-2 py-0.5 rounded-sm bg-white/5 border border-white/5"
                                style={{ color: TIER_COLORS[medal.tier] || '#fff' }}
                              >
                                {medal.tier.toUpperCase()}
                              </span>
                              <span className="text-[8px] text-zinc-600 font-black uppercase font-outfit tracking-widest opacity-50">
                                <FormattedDate date={medal.awardedAt} />
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {medals.length === 0 && (
                        <div className="col-span-full py-20 text-center border border-dashed border-white/5 rounded-[40px] opacity-30 flex flex-col items-center gap-4 bg-zinc-900/10">
                          <div className="p-4 rounded-full bg-zinc-900/50">
                            <Trophy className="h-10 w-10 text-zinc-700" />
                          </div>
                          <p className="text-[11px] font-black uppercase tracking-[0.4em] font-outfit">{t('players.profile.noValorRecords')}</p>
                        </div>
                      )}
                    </motion.div>
                  </TabsContent>
                </AnimatePresence>
              </Tabs>
            </div>

            {/* Right Column: Bio & Social Hub */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Bio Section */}
              <ProfileBio 
                bio={profile.bio} 
                isEditable={isOwnProfile} 
                onSave={handleUpdateBio} 
              />

              {/* Affiliations Card */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 font-outfit">
                  {t('players.profile.affiliations')}
                </h3>
                <div className="space-y-4">
                  {mainCharacter?.corporation && (
                    <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group">
                      <div className="h-12 w-12 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-center p-2 shrink-0">
                        <Avatar className="h-full w-full rounded-none">
                          <AvatarImage src={`https://images.evetech.net/corporations/${mainCharacter.corporation.id}/logo?size=64`} />
                          <AvatarFallback>C</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-white truncate font-outfit uppercase">
                          {mainCharacter.corporation.name}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-black font-outfit uppercase tracking-widest mt-0.5">
                          {t('players.profile.corpMember')}
                        </p>
                        
                        {/* Medals inline below corporation */}
                        {medals && medals.length > 0 && (
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                              {medals.slice(0, 5).map((medal) => (
                                <Tooltip key={medal.id}>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className="h-6 w-6 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center text-xs cursor-help hover:scale-110 transition-transform"
                                      style={{ color: TIER_COLORS[medal.tier] || '#fff' }}
                                      title={medal.description || ''}
                                    >
                                      {medal.icon}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white text-xs max-w-[200px] p-2">
                                    <p className="font-bold">{medal.name}</p>
                                    {medal.description && <p className="text-zinc-400 mt-1">{medal.description}</p>}
                                    <p className="text-zinc-500 text-[10px] mt-1">{medal.tier.toUpperCase()} · {medal.count > 1 && `x${medal.count}`}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {medals.length > 5 && (
                                <span className="text-[9px] text-zinc-500 font-black">+{medals.length - 5}</span>
                              )}
                            </div>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  )}
                  {mainCharacter?.alliance && (
                    <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all group">
                      <div className="h-12 w-12 rounded-lg bg-zinc-950 border border-white/5 flex items-center justify-center p-2">
                        <Avatar className="h-full w-full rounded-none">
                          <AvatarImage src={`https://images.evetech.net/alliances/${mainCharacter.alliance.id}/logo?size=64`} />
                          <AvatarFallback>A</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white truncate font-outfit uppercase">
                          {mainCharacter.alliance.name}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-black font-outfit uppercase tracking-widest mt-0.5">
                          {t('players.profile.allianceMember')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Social Hub Placeholders */}
              <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 space-y-6 relative overflow-hidden group/social">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/social:opacity-20 transition-opacity">
                  <Shield className="h-16 w-16 text-blue-500" />
                </div>
                
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 font-outfit">
                  {t('players.profile.social.title')}
                </h3>
                
                <div className="space-y-4">
                  {/* Chat Placeholder */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-2 opacity-50 grayscale hover:grayscale-0 transition-all cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-emerald-400" />
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-outfit">{t('players.profile.social.secureChannel')}</span>
                      </div>
                      <Badge variant="outline" className="text-[7px] font-black border-zinc-700 text-zinc-500">{t('players.profile.social.offline')}</Badge>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-600">
                      {t('players.profile.social.chatPlaceholder')}
                    </p>
                  </div>

                  {/* Forum Placeholder */}
                  <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 space-y-2 opacity-50 grayscale hover:grayscale-0 transition-all cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layout className="h-3 w-3 text-blue-400" />
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest font-outfit">{t('players.profile.social.intelFeed')}</span>
                      </div>
                      <Badge variant="outline" className="text-[7px] font-black border-zinc-700 text-zinc-500">{t('players.profile.social.noData')}</Badge>
                    </div>
                    <p className="text-[10px] font-medium text-zinc-600">
                      {t('players.profile.social.forumPlaceholder')}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[8px] text-center text-zinc-600 font-black uppercase tracking-[0.2em] font-outfit">
                    {t('players.profile.social.comingSoon')}
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  )
}