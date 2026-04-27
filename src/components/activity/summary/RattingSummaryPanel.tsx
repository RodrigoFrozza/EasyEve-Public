'use client'

import { useState, useEffect, useMemo } from 'react'
import { formatISK, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { 
  Search, 
  Wallet, 
  PiggyBank, 
  Receipt, 
  History,
  Box,
  TrendingUp,
  Clock,
  ShieldCheck,
  ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { Input } from '@/components/ui/input'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, RattingLogEntry, isRattingActivity } from '@/types/domain'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { VirtualizedList } from '../shared/VirtualizedList'

interface RattingSummaryPanelProps {
  activity: ActivityEnhanced
  logs: RattingLogEntry[]
  viewMode: 'detailed' | 'compact'
  onOpenMTU: () => void
}

interface CharacterGroup {
  charId: number
  charName: string
  bounty: number
  ess: number
  tax: number
  total: number
  logs: RattingLogEntry[]
}

export function RattingSummaryPanel({ activity, logs, viewMode, onOpenMTU }: RattingSummaryPanelProps) {
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
    const groups: Record<number, CharacterGroup> = {}

    logs.forEach(log => {
      const charId = log.characterId || log.charId || 0
      const charName = log.characterName || log.charName || t('common.unknown')
      
      if (!groups[charId]) {
        groups[charId] = {
          charId,
          charName,
          bounty: 0,
          ess: 0,
          tax: 0,
          total: 0,
          logs: []
        }
      }

      if (log.type === 'bounty') groups[charId].bounty += log.amount
      if (log.type === 'ess') groups[charId].ess += log.amount
      if (log.type === 'tax') groups[charId].tax += log.amount
      
      groups[charId].logs.push(log)
    })

    return Object.values(groups).map(group => ({
      ...group,
      total: (group.bounty + group.ess) - group.tax,
      logs: group.logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    })).sort((a, b) => b.total - a.total)
  }, [logs, t])

  const filteredData = useMemo(() => {
    if (!searchTerm) return characterData
    return characterData.filter(c => 
      c.charName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [characterData, searchTerm])

  if (!mounted) return null
  if (!isRattingActivity(activity)) return null

  const totalBounty = characterData.reduce((sum, char) => sum + char.bounty, 0)
  const totalEss = characterData.reduce((sum, char) => sum + char.ess, 0)
  const totalTax = characterData.reduce((sum, char) => sum + char.tax, 0)
  const netTotal = (totalBounty + totalEss) - totalTax

  const start = new Date(activity.startTime).getTime()
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
  const hours = Math.max(0.1, (end - start) / (1000 * 60 * 60))
  const iskPerHour = netTotal / hours

  return (
    <div className="space-y-16">
      {/* Global Results Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <ActivityStatDisplay
          label="GROSS BOUNTY"
          value={totalBounty}
          variant="success"
          formatAsISK
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="ESS BANK"
          value={totalEss}
          variant="warning"
          formatAsISK
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <ActivityStatDisplay
          label="PILOT NET"
          value={netTotal}
          variant="accent"
          formatAsISK
          icon={<Wallet className="h-4 w-4" />}
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

      {/* Search & Action Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col xl:flex-row gap-6 items-center justify-between bg-zinc-950/40 backdrop-blur-md p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden group"
      >
        {/* Subtle Background Decoration */}
        <div className="absolute top-0 right-0 w-32 h-full bg-blue-500/5 blur-3xl pointer-events-none group-hover:bg-blue-500/10 transition-all duration-700" />
        
        <div className="relative w-full xl:w-[450px] group z-10">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 group-focus-within:text-blue-400 transition-colors" />
          <Input 
            placeholder="FILTER COMBAT PERSONNEL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-14 h-14 bg-black/60 border-white/10 text-[11px] font-black uppercase tracking-[0.2em] focus:ring-blue-500/20 rounded-2xl font-outfit shadow-inner"
          />
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={onOpenMTU}
          className="h-14 px-10 bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-[11px] font-black uppercase tracking-[0.4em] gap-4 w-full xl:w-auto rounded-2xl shadow-xl transition-all duration-500 font-outfit z-10"
        >
          <Box className="h-5 w-5" />
          MTU REGISTRY HUB
        </Button>
      </motion.div>

      {/* Content */}
      <div className="space-y-8">
        <div className="flex items-center gap-6 mb-4">
           <h4 className="text-[11px] uppercase font-black tracking-[0.5em] text-zinc-700 font-outfit shrink-0">COMBAT PERSONNEL LOGS</h4>
           <div className="h-[1px] flex-1 bg-gradient-to-r from-white/5 to-transparent" />
        </div>

        {filteredData.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-32 text-center flex flex-col items-center gap-8 opacity-40 bg-zinc-950/20 border border-white/5 rounded-[40px] backdrop-blur-md"
          >
            <History className="h-20 w-20 text-zinc-800" />
            <p className="text-[11px] text-zinc-600 font-black uppercase tracking-[0.5em] font-outfit">NO COMBAT DATA DETECTED IN LOGS</p>
          </motion.div>
        ) : (
          filteredData.map((group, idx) => (
            <motion.div 
              key={group.charId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + (idx * 0.05) }}
              className="group/char bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[40px] overflow-hidden transition-all duration-500 hover:border-white/10 shadow-2xl"
            >
              {/* Character Summary Row */}
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
                      <AvatarFallback className="bg-zinc-900 text-xs font-black font-outfit uppercase">{(group.charName || '??').slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-zinc-950 border border-white/10 rounded-lg flex items-center justify-center shadow-2xl">
                       <ShieldCheck className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter truncate font-outfit group-hover/char:text-blue-400 transition-colors">{group.charName}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                       <div className="flex items-center gap-3 bg-black/40 px-4 py-1.5 rounded-xl border border-white/5 group-hover/char:border-emerald-500/20 transition-all">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[11px] font-black font-mono text-emerald-400/80">{formatISK(group.bounty)}</span>
                       </div>
                       <div className="flex items-center gap-3 bg-black/40 px-4 py-1.5 rounded-xl border border-white/5 group-hover/char:border-amber-500/20 transition-all">
                          <PiggyBank className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-[11px] font-black font-mono text-amber-400/80">{formatISK(group.ess)}</span>
                       </div>
                       <div className="flex items-center gap-3 bg-black/40 px-4 py-1.5 rounded-xl border border-white/5 group-hover/char:border-rose-500/20 transition-all">
                          <Receipt className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-[11px] font-black font-mono text-rose-400/80">{formatISK(group.tax)}</span>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 xl:justify-end">
                  <div className="text-left xl:text-right">
                    <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] font-outfit mb-1">INDIVIDUAL NET</p>
                    <p className="text-2xl sm:text-3xl font-black text-white font-inter tracking-tighter tabular-nums group-hover/char:text-blue-400 transition-all">{formatISK(group.total)}</p>
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

              {/* Detailed Transaction Logs */}
              <AnimatePresence>
                {(viewMode === 'detailed' || expandedChars[group.charId]) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="bg-black/60 overflow-hidden"
                  >
                    <div className="p-8 sm:p-12 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                      <VirtualizedList
                        items={group.logs}
                        keyExtractor={(log, idx) => `${log.date}-${idx}`}
                        pageSize={30}
                        renderItem={(log, logIdx) => (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(logIdx * 0.02, 0.3) }}
                            className="px-8 py-5 flex items-center justify-between bg-zinc-950/40 border border-white/5 rounded-2xl hover:bg-zinc-950 hover:border-white/10 transition-all duration-500 group/log shadow-lg"
                          >
                            <div className="flex items-center gap-6">
                              <div className={cn(
                                "w-2 h-8 rounded-full flex-shrink-0 shadow-[0_0_12px_rgba(0,0,0,0.5)] transition-all duration-500",
                                log.type === 'bounty' ? "bg-emerald-500/80 group-hover/log:bg-emerald-400 shadow-emerald-500/20" : log.type === 'ess' ? "bg-amber-500/80 group-hover/log:bg-amber-400 shadow-amber-500/20" : "bg-rose-500/80 group-hover/log:bg-rose-400 shadow-rose-500/20"
                              )} />
                              <div>
                                <p className="text-[11px] font-black uppercase text-zinc-300 tracking-[0.2em] font-outfit group-hover/log:text-white transition-colors">
                                  {log.type} PROTOCOL
                                </p>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1 font-mono tracking-tighter">
                                  <FormattedDate date={log.date} mode="time" options={{ hour: '2-digit', minute: '2-digit', second: '2-digit' }} />
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                "text-lg font-black font-mono tabular-nums tracking-tighter",
                                log.type === 'tax' ? "text-rose-500" : "text-emerald-400"
                              )}>
                                {log.type === 'tax' ? '-' : '+'}{formatISK(log.amount)}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      />
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
