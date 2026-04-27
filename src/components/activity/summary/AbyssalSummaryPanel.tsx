'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatISK, cn, formatNumber } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Wallet, 
  History,
  Box,
  TrendingUp,
  Clock,
  ChevronDown,
  Sparkles,
  Layers,
  Crosshair
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { Input } from '@/components/ui/input'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, isAbyssalActivity, AbyssalActivityData } from '@/types/domain'
import { FormattedDate } from '@/components/shared/FormattedDate'
import Image from 'next/image'

interface AbyssalSummaryPanelProps {
  activity: ActivityEnhanced
  viewMode: 'detailed' | 'compact'
}

interface CharacterGroup {
  charId: number
  charName: string
  totalValue: number
  itemsCount: number
  logs: any[]
}

export function AbyssalSummaryPanel({ activity, viewMode }: AbyssalSummaryPanelProps) {
  const { t } = useTranslations()
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)
  const [expandedChars, setExpandedChars] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleChar = (charId: number) => {
    setExpandedChars(prev => ({
      ...prev,
      [charId]: !prev[charId]
    }))
  }

  const characterData = useMemo(() => {
    if (!isAbyssalActivity(activity)) return []
    
    const logs = activity.data.logs || []
    const groups: Record<number, CharacterGroup> = {}

    logs.forEach(log => {
      const charId = log.charId || 0
      const charName = log.charName || t('common.unknown')
      
      if (!groups[charId]) {
        groups[charId] = {
          charId,
          charName,
          totalValue: 0,
          itemsCount: 0,
          logs: []
        }
      }

      // If logs have specific values attributed to characters, sum them up here.
      // Often Abyssal loot is shared, but we track individual participation logs.
      groups[charId].logs.push(log)
    })

    return Object.values(groups).map(group => ({
      ...group,
      logs: group.logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
  }, [activity, t])

  const filteredData = useMemo(() => {
    if (!searchTerm) return characterData
    return characterData.filter(c => 
      c.charName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [characterData, searchTerm])

  if (!mounted) return null
  if (!isAbyssalActivity(activity)) return null

  const abyssalData = activity.data as AbyssalActivityData
  const lootContents = abyssalData.lootContents || []
  const totalLootValue = abyssalData.totalLootValue || 0
  const totalItems = lootContents.reduce((acc: number, item: { quantity?: number }) => acc + (item.quantity || 0), 0)
  
  const tier = activity.data.tier !== undefined ? `T${activity.data.tier}` : '?'
  const runsCompleted = activity.data.runsCompleted || 0
  
  const start = new Date(activity.startTime).getTime()
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
  const hours = Math.max(0.1, (end - start) / (1000 * 60 * 60))
  const iskPerHour = totalLootValue / hours

  return (
    <div className="space-y-16">
      {/* Global Results Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <ActivityStatDisplay
          label="GROSS REVENUE"
          value={totalLootValue}
          variant="success"
          formatAsISK
          icon={<Wallet className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="FILAMENT TIER"
          value={tier}
          variant="warning"
          icon={<Crosshair className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="RUNS COMPLETED"
          value={runsCompleted}
          variant="accent"
          formatAsNumber
          icon={<Sparkles className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="REVENUE PER HOUR"
          value={iskPerHour}
          subValue="isk/h"
          variant="accent"
          formatAsISK
          icon={<Clock className="h-4 w-4" />}
        />
      </motion.div>

      {/* Global Loot Summary */}
      {lootContents.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-zinc-950/40 border border-white/5 rounded-[40px] overflow-hidden p-10 backdrop-blur-md relative shadow-2xl group transition-all duration-700 hover:border-white/10"
        >
          {/* Background Accent */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-500/5 blur-[100px] pointer-events-none rounded-full group-hover:bg-red-500/10 transition-all duration-700" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12 relative z-10">
             <div className="flex items-center gap-6">
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 shadow-inner group-hover:bg-red-500/20 transition-all duration-500">
                   <Box className="h-6 w-6 text-red-400" />
                </div>
                <div>
                   <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 font-outfit">ABYSSAL LOOT CACHE</h3>
                   <p className="text-[11px] text-zinc-600 font-bold uppercase mt-2 font-outfit tracking-widest">Extracted artifacts and materials</p>
                </div>
             </div>
             <div className="bg-black/40 px-6 py-3 rounded-xl border border-white/5 backdrop-blur-md">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-outfit">TOTAL ITEMS: {formatNumber(totalItems)}</span>
             </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 relative z-10">
              {lootContents.slice(0, 18).map((item: { typeId?: number; name: string; quantity: number }, i: number) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-4 bg-zinc-950/60 p-5 rounded-2xl border border-white/5 group/item hover:border-red-500/30 transition-all duration-500 hover:bg-zinc-950 shadow-lg hover:shadow-red-500/5"
                >
                   <div className="relative flex-shrink-0">
                     <div className="absolute inset-0 bg-red-500/10 blur-xl rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity" />
                     {item.typeId ? (
                       <Image 
                          src={`https://images.evetech.net/types/${item.typeId}/icon?size=64`} 
                          width={64}
                          height={64}
                          className="h-10 w-10 sm:h-12 sm:w-12 relative z-10 transition-transform duration-500 group-hover/item:scale-110" 
                          alt={item.name} 
                       />
                     ) : (
                       <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center relative z-10">
                         <Layers className="h-5 w-5 text-zinc-500" />
                       </div>
                     )}
                   </div>
                  <div className="min-w-0">
                     <p className="text-[11px] font-black text-zinc-300 uppercase truncate font-outfit tracking-wider group-hover/item:text-white transition-colors">{item.name}</p>
                     <p className="text-[11px] font-black font-mono text-red-500 mt-1.5 group-hover/item:text-red-400 transition-colors">
                      {formatNumber(item.quantity)}<span className="text-[9px] text-zinc-600 ml-1 uppercase font-inter font-bold">UNITS</span>
                     </p>
                  </div>
                </motion.div>
              ))}
          </div>
        </motion.div>
      )}

      {/* Search Bar - Modernized */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative group"
      >
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-red-400 transition-colors" />
        </div>
        <Input 
          placeholder="FILTER RUN PERSONNEL..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-14 h-16 bg-zinc-950/40 backdrop-blur-md border-white/5 text-[11px] font-black uppercase tracking-[0.2em] focus:ring-red-500/20 rounded-[32px] font-outfit shadow-xl relative z-0"
        />
      </motion.div>

      {/* Content */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-32 text-center flex flex-col items-center gap-6 opacity-40 bg-zinc-950/20 border border-white/5 rounded-[40px]"
          >
            <History className="h-16 w-16 text-zinc-800" />
            <p className="text-xs text-zinc-600 font-black uppercase tracking-[0.4em] font-outfit">NO PERSONNEL LOGS FOUND</p>
          </motion.div>
        ) : (
          filteredData.map((group, idx) => (
            <motion.div 
              key={group.charId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className="group/char bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[40px] overflow-hidden transition-all hover:border-white/10 shadow-2xl"
            >
              {/* Character Summary Row */}
              <div 
                onClick={() => toggleChar(group.charId)}
                className={cn(
                  "px-6 sm:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 cursor-pointer transition-colors",
                  (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-8">
                  <div className="relative">
                    <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-zinc-800 ring-4 ring-black/40 group-hover/char:ring-red-500/10 transition-all duration-500">
                      <AvatarImage src={`https://images.evetech.net/characters/${group.charId}/portrait?size=128`} />
                      <AvatarFallback className="bg-zinc-900 text-xs font-black">{group.charName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-zinc-950 rounded-full border border-white/10 flex items-center justify-center">
                      <Crosshair className="h-3 w-3 text-red-500" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter truncate font-outfit leading-none">{group.charName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">ABYSSAL RUNNER</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-1 font-outfit">RUN LOG ENTRIES</p>
                    <p className="text-2xl sm:text-3xl font-black text-white font-inter tracking-tighter tabular-nums leading-none">{group.logs.length}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 sm:h-12 sm:w-12 rounded-xl transition-all duration-500",
                      (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-red-500/20 text-red-400 rotate-180" : "bg-white/5 text-zinc-600"
                    )}
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Detailed Discovery Logs */}
              <AnimatePresence>
                {(viewMode === 'detailed' || expandedChars[group.charId]) && group.logs.length > 0 && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/5 bg-black/40"
                  >
                    <div className="p-6 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 gap-2">
                        {group.logs.map((log, logIdx) => (
                          <div 
                            key={logIdx} 
                            className="px-6 py-4 flex items-center justify-between bg-white/[0.01] border border-white/[0.03] rounded-2xl hover:bg-white/[0.04] transition-all group/log"
                          >
                            <div className="flex items-center gap-5">
                              <div className="w-2 h-8 rounded-full flex-shrink-0 bg-red-500/30 shadow-lg shadow-red-500/10" />
                              <div>
                                <p className="text-[11px] font-black uppercase text-white/90 tracking-widest font-outfit">
                                  ABYSSAL TRACE
                                </p>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-wider">
                                  <FormattedDate date={log.date} mode="time" options={{ hour: '2-digit', minute: '2-digit' }} />
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter mt-1">LOGGED ENTRY</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  )
}
