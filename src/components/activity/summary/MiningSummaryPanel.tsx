'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Package, Gem, TrendingUp, Clock, Info, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import Image from 'next/image'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, MiningLogEntry } from '@/types/domain'
import { VirtualizedList } from '../shared/VirtualizedList'

interface MiningSummaryPanelProps {
  activity: ActivityEnhanced
  logs: MiningLogEntry[]
  viewMode: 'detailed' | 'compact'
}

interface CharacterGroup {
  charId: number;
  charName: string;
  ores: Record<string, {
    oreName: string;
    typeId: number;
    quantity: number;
    m3: number;
    value: number;
  }>;
  totalValue: number;
  totalM3: number;
}

interface OreSummary {
  oreName: string;
  typeId: number;
  quantity: number;
  m3: number;
  value: number;
}

export function MiningSummaryPanel({ activity, logs, viewMode }: MiningSummaryPanelProps) {
  const { t } = useTranslations()
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

  const groupedByCharacter = useMemo(() => {
    const groups: Record<string, CharacterGroup> = {}

    logs.forEach(log => {
      const charId = log.characterId || log.charId || 0
      const charName = log.characterName || log.charName || t('activity.character.deleted')
      const val = log.estimatedValue || log.value || 0
      const vol = log.volumeValue || log.m3 || 0
      
      if (!groups[charId]) {
        groups[charId] = {
          charId,
          charName,
          ores: {},
          totalValue: 0,
          totalM3: 0
        }
      }

      const oreKey = log.oreName || t('activity.unknownOre')
      if (!groups[charId].ores[oreKey]) {
        groups[charId].ores[oreKey] = {
          oreName: oreKey,
          typeId: log.typeId,
          quantity: 0,
          m3: 0,
          value: 0
        }
      }

      groups[charId].ores[oreKey].quantity += (log.quantity || 0)
      groups[charId].ores[oreKey].m3 += vol
      groups[charId].ores[oreKey].value += val
      
      groups[charId].totalValue += val
      groups[charId].totalM3 += vol
    })

    return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue)
  }, [logs, t])

  const globalOreSummary = useMemo(() => {
    const globalOres: Record<string, OreSummary> = {}
    logs.forEach(log => {
      const oreKey = log.oreName || t('activity.unknownOre')
      const val = log.estimatedValue || log.value || 0
      const vol = log.volumeValue || log.m3 || 0

      if (!globalOres[oreKey]) {
        globalOres[oreKey] = { oreName: oreKey, typeId: log.typeId, quantity: 0, m3: 0, value: 0 }
      }
      globalOres[oreKey].quantity += (log.quantity || 0)
      globalOres[oreKey].m3 += vol
      globalOres[oreKey].value += val
    })
    return Object.values(globalOres).sort((a, b) => b.value - a.value)
  }, [logs, t])

  if (!mounted) return null

  const totalValue = globalOreSummary.reduce((sum, ore) => sum + ore.value, 0)
  const totalM3 = globalOreSummary.reduce((sum, ore) => sum + ore.m3, 0)
  
  const start = new Date(activity.startTime).getTime()
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
  const hours = Math.max(0.1, (end - start) / (1000 * 60 * 60))
  const m3PerHour = totalM3 / hours
  const iskPerHour = totalValue / hours

  if (logs.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="py-32 text-center border border-white/5 bg-zinc-950/40 rounded-[40px] backdrop-blur-md shadow-2xl"
      >
        <Package className="h-16 w-16 text-zinc-800 mx-auto mb-8 opacity-20" />
        <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[11px] font-outfit">NO EXTRACTION DATA RECORDED</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-16">
      {/* Global Results Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <ActivityStatDisplay
          label="GROSS YIELD"
          value={totalM3}
          subValue="m³"
          variant="accent"
          formatAsNumber
          icon={<Package className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="GROSS REVENUE"
          value={totalValue}
          variant="success"
          formatAsISK
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="YIELD PER HOUR"
          value={m3PerHour}
          subValue="m³/h"
          variant="default"
          formatAsNumber
          icon={<Info className="h-4 w-4" />}
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

      {/* Global Inventory Summary */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-950/40 border border-white/5 rounded-[40px] overflow-hidden p-10 backdrop-blur-md relative shadow-2xl group transition-all duration-700 hover:border-white/10"
      >
        {/* Background Accent */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full group-hover:bg-blue-500/10 transition-all duration-700" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12 relative z-10">
           <div className="flex items-center gap-6">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner group-hover:bg-blue-500/20 transition-all duration-500">
                 <Gem className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                 <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 font-outfit">CONSOLIDATED CARGO</h3>
                 <p className="text-[11px] text-zinc-600 font-bold uppercase mt-2 font-outfit tracking-widest">Fleet-wide extraction protocols</p>
              </div>
           </div>
           <div className="bg-black/40 px-6 py-3 rounded-xl border border-white/5 backdrop-blur-md">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-outfit">TYPES: {globalOreSummary.length}</span>
           </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 relative z-10">
            {globalOreSummary.slice(0, 18).map((ore, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-3 bg-zinc-950/60 p-4 rounded-xl border border-white/5 group/ore hover:border-blue-500/30 transition-all duration-500 hover:bg-zinc-950 shadow-sm hover:shadow-blue-500/5"
              >
                 <div className="relative flex-shrink-0">
                   <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover/ore:opacity-100 transition-opacity" />
                   <Image 
                      src={`https://images.evetech.net/types/${ore.typeId}/icon?size=64`} 
                      width={48}
                      height={48}
                      className="h-8 w-8 sm:h-10 sm:w-10 relative z-10 transition-transform duration-500 group-hover/ore:scale-110" 
                      alt={ore.oreName} 
                   />
                 </div>
                <div className="min-w-0">
                   <p className="text-[11px] font-black text-zinc-300 uppercase truncate font-outfit tracking-wider group-hover/ore:text-white transition-colors">{ore.oreName}</p>
                   <p className="text-[11px] font-black font-mono text-blue-500 mt-1.5 group-hover/ore:text-blue-400 transition-colors">
                    {formatNumber(ore.m3)}<span className="text-[9px] text-zinc-600 ml-1 uppercase font-inter font-bold">m³</span>
                   </p>
                </div>
              </motion.div>
            ))}
        </div>
      </motion.div>

      <div className="space-y-8">
        <div className="flex items-center gap-6 mb-4">
           <h4 className="text-[11px] uppercase font-black tracking-[0.5em] text-zinc-700 font-outfit shrink-0">PERSONNEL LOGS</h4>
           <div className="h-[1px] flex-1 bg-gradient-to-r from-white/5 to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {groupedByCharacter.map((group, idx) => (
            <motion.div 
              key={group.charId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className="bg-zinc-950/40 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-md group/char hover:border-white/10 transition-all duration-500"
            >
              <div 
                onClick={() => toggleChar(group.charId)}
                className={cn(
                  "px-6 sm:px-8 py-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6 cursor-pointer transition-all duration-700",
                  (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-white/[0.04] border-b border-white/5" : "hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-8">
                  <div className="relative">
                    <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-white/5 ring-4 ring-black/40 group-hover/char:ring-blue-500/10 transition-all duration-700">
                      <AvatarImage src={`https://images.evetech.net/characters/${group.charId}/portrait?size=128`} />
                      <AvatarFallback className="bg-zinc-900 text-zinc-600 font-black font-outfit uppercase text-xs">{(group.charName || '??').slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-zinc-950 border border-white/10 rounded-lg flex items-center justify-center shadow-2xl">
                       <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter truncate font-outfit group-hover/char:text-blue-400 transition-colors">{group.charName}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.2em] font-outfit flex items-center gap-2">
                        <span className="w-4 h-[1px] bg-zinc-800" />
                        {formatNumber(Math.round(group.totalM3))} <span className="text-zinc-700">M³</span>
                      </p>
                      <div className="h-3 w-[1px] bg-white/5" />
                      <p className="text-[11px] text-zinc-500 font-black uppercase tracking-[0.2em] font-outfit">
                        {Object.keys(group.ores).length} <span className="text-zinc-700">PROTOCOLS</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between xl:justify-end gap-6">
                  <div className="text-left xl:text-right">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] font-outfit mb-1">GROSS REVENUE</p>
                    <p className="text-2xl sm:text-3xl font-black text-white font-inter tracking-tighter tabular-nums truncate group-hover/char:text-emerald-400 transition-colors">{formatISK(group.totalValue)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 sm:h-12 sm:w-12 rounded-xl transition-all duration-500 border border-white/10 shadow-md",
                      (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-blue-500 text-white rotate-180 ring-4 ring-blue-500/20" : "hover:bg-zinc-900 text-zinc-500 hover:text-white"
                    )}
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {(viewMode === 'detailed' || expandedChars[group.charId]) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden bg-black/40"
                  >
                    <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.values(group.ores).map((ore, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="flex items-center justify-between p-6 rounded-3xl border border-white/5 bg-zinc-950/40 group/ore hover:border-white/20 transition-all duration-500 shadow-lg"
                        >
                          <div className="flex items-center gap-5">
                             <div className="relative flex-shrink-0">
                               <Image 
                                  src={`https://images.evetech.net/types/${ore.typeId}/icon?size=64`} 
                                  width={48}
                                  height={48}
                                  className="h-10 w-10 sm:h-12 sm:w-12 relative z-10 transition-transform duration-500 group-hover/ore:scale-110" 
                                  alt={ore.oreName} 
                               />
                             </div>
                            <div className="min-w-0">
                               <p className="text-[11px] font-black text-zinc-300 uppercase tracking-widest truncate font-outfit group-hover/ore:text-white transition-colors">{ore.oreName}</p>
                               <p className="text-[11px] font-black text-zinc-600 mt-2 font-mono group-hover/ore:text-blue-500 transition-colors">
                                 {formatNumber(ore.m3)}<span className="text-[9px] ml-1 uppercase">m³</span>
                               </p>
                            </div>
                          </div>
                          <div className="text-right">
                             <span className="text-sm font-black text-emerald-500/80 font-inter tabular-nums group-hover/ore:text-emerald-400 transition-colors">{formatISK(ore.value)}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
