'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatISK, cn } from '@/lib/utils'
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
  Layers
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { Input } from '@/components/ui/input'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, isExplorationActivity } from '@/types/domain'
import { FormattedDate } from '@/components/shared/FormattedDate'

interface ExplorationSummaryPanelProps {
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

export function ExplorationSummaryPanel({ activity, viewMode }: ExplorationSummaryPanelProps) {
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
    if (!isExplorationActivity(activity)) return []
    
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

      groups[charId].totalValue += log.amount
      groups[charId].logs.push(log)
    })

    return Object.values(groups).map(group => ({
      ...group,
      logs: group.logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })).sort((a, b) => b.totalValue - a.totalValue)
  }, [activity, t])

  const filteredData = useMemo(() => {
    if (!searchTerm) return characterData
    return characterData.filter(c => 
      c.charName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [characterData, searchTerm])

  if (!mounted) return null
  if (!isExplorationActivity(activity)) return null

  const lootContents = activity.data.lootContents || []
  const totalLootValue = activity.data.totalLootValue || 0
  const totalItems = lootContents.reduce((acc, item) => acc + (item.quantity || 0), 0)
  
  const start = new Date(activity.startTime).getTime()
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
  const hours = Math.max(0.1, (end - start) / (1000 * 60 * 60))
  const iskPerHour = totalLootValue / hours

  return (
    <div className="space-y-8">
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
          label="SITES COMPLETED"
          value={lootContents.length}
          variant="accent"
          formatAsNumber
          icon={<Sparkles className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="TOTAL ITEMS"
          value={totalItems}
          variant="default"
          formatAsNumber
          icon={<Layers className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="REVENUE PER HOUR"
          value={iskPerHour}
          subValue="isk/h"
          variant="accent"
          formatAsISK
          icon={<Clock className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="SITES COMPLETED"
          value={lootContents.length}
          variant="accent"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="TOTAL ITEMS"
          value={totalItems}
          variant="default"
          icon={<Layers className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="REVENUE PER HOUR"
          value={iskPerHour}
          subValue="isk/h"
          variant="accent"
          icon={<Clock className="h-4 w-4" />}
        />
      </motion.div>

      {/* Search Bar - Modernized */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative group"
      >
        <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
        </div>
        <Input 
          placeholder="FILTER DISCOVERY DATA..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-14 h-16 bg-zinc-950/40 backdrop-blur-md border-white/5 text-[11px] font-black uppercase tracking-[0.2em] focus:ring-blue-500/20 rounded-[32px] font-outfit shadow-xl"
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
            <p className="text-xs text-zinc-600 font-black uppercase tracking-[0.4em] font-outfit">NO DISCOVERY LOGS FOUND</p>
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
                    <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-zinc-800 ring-4 ring-black/40 group-hover/char:ring-blue-500/10 transition-all duration-500">
                      <AvatarImage src={`https://images.evetech.net/characters/${group.charId}/portrait?size=128`} />
                      <AvatarFallback className="bg-zinc-900 text-xs font-black">{group.charName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-zinc-950 rounded-full border border-white/10 flex items-center justify-center">
                      <Box className="h-3 w-3 text-zinc-500" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter truncate font-outfit leading-none">{group.charName}</h3>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">DISCOVERY SPECIALIST</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-1 font-outfit">PILOT NET VALUE</p>
                    <p className="text-2xl sm:text-3xl font-black text-white font-inter tracking-tighter tabular-nums leading-none">{formatISK(group.totalValue)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-10 w-10 sm:h-12 sm:w-12 rounded-xl transition-all duration-500",
                      (viewMode === 'detailed' || expandedChars[group.charId]) ? "bg-blue-500/20 text-blue-400 rotate-180" : "bg-white/5 text-zinc-600"
                    )}
                  >
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Detailed Discovery Logs */}
              <AnimatePresence>
                {(viewMode === 'detailed' || expandedChars[group.charId]) && (
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
                              <div className="w-2 h-8 rounded-full flex-shrink-0 bg-blue-500/30 shadow-lg shadow-blue-500/10" />
                              <div>
                                <p className="text-[11px] font-black uppercase text-white/90 tracking-widest font-outfit">
                                  {t('activity.exploration.discovery')}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-wider">
                                  <FormattedDate date={log.date} mode="time" options={{ hour: '2-digit', minute: '2-digit' }} />
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black font-inter tabular-nums text-white group-hover/log:text-blue-400 transition-colors">
                                +{formatISK(log.amount)}
                              </p>
                              <div className="text-[9px] text-zinc-600 font-black uppercase tracking-tighter mt-1">LOGGED RECORD</div>
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
