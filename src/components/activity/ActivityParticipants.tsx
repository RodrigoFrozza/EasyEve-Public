'use client'

import { useState, useMemo } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { motion, AnimatePresence } from 'framer-motion'
import { ActivityEnhanced } from '@/types/domain'
import { useTranslations } from '@/i18n/hooks'
import { Search, X, User, Ship } from 'lucide-react'

interface ActivityParticipantsProps {
  activity: ActivityEnhanced
}

export function ActivityParticipants({ activity }: ActivityParticipantsProps) {
  const { t } = useTranslations()
  const [showParticipants, setShowParticipants] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredParticipants = useMemo(() => {
    if (!activity.participants || activity.participants.length === 0) return []
    if (!searchTerm) return activity.participants
    
    const term = searchTerm.toLowerCase()
    return activity.participants.filter(p => 
      (p.characterName || '').toLowerCase().includes(term) ||
      (p.fitName || p.fit || '').toLowerCase().includes(term)
    )
  }, [activity.participants, searchTerm])

  if (!activity.participants || activity.participants.length === 0) {
    return null
  }

  return (
    <TooltipProvider delayDuration={300}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 pt-4 border-t border-white/5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-600 font-outfit shrink-0">ACTIVE PERSONNEL</h4>
              <span className="text-[10px] text-zinc-500">
                {searchTerm ? `${filteredParticipants.length}/${activity.participants.length}` : activity.participants.length}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowParticipants((v) => !v)}
              className="h-7 px-3 text-[9px] uppercase tracking-[0.12em] text-zinc-400 hover:text-white"
            >
              {showParticipants ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showParticipants && (
            <>
              <div className="flex items-center gap-6">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-white/5 to-transparent" />
              </div>
              
              {activity.participants.length > 3 && (
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <Input 
                    placeholder="FILTER PERSONNEL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 h-10 bg-zinc-950/60 border-white/10 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl font-outfit pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredParticipants.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full py-8 text-center text-zinc-500 text-[11px] font-black uppercase tracking-[0.2em]"
                  >
                    NO RESULTS FOUND
                  </motion.div>
                ) : (
                  filteredParticipants.map((participant) => (
                    <motion.div 
                      key={participant.characterId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-zinc-950/20 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-3 hover:bg-zinc-950/40 hover:border-white/10 transition-all duration-300 group shadow-xl"
                    >
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-pointer">
                            <Avatar className="h-10 w-10 border border-white/5 ring-2 ring-black/40 group-hover:ring-blue-500/10 transition-all duration-300">
                              <AvatarImage src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=128`} />
                              <AvatarFallback className="text-[11px] bg-zinc-900 uppercase font-black font-outfit text-zinc-600">
                                {(participant.characterName || '??').slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-zinc-950 border border-white/10 rounded-md flex items-center justify-center shadow-2xl">
                              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-zinc-900 border-zinc-700 text-zinc-100">
                          <div className="space-y-1 p-1">
                            <p className="font-bold text-xs">{participant.characterName || 'Unknown'}</p>
                            <p className="text-zinc-400 text-[10px] flex items-center gap-1">
                              <User className="h-3 w-3" /> Character ID: {participant.characterId}
                            </p>
                            {(participant.fitName || participant.fit) && (
                              <p className="text-zinc-400 text-[10px] flex items-center gap-1">
                                <Ship className="h-3 w-3" /> {participant.fitName || participant.fit}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate tracking-tight font-outfit uppercase group-hover:text-blue-400 transition-colors">
                          {participant.characterName || t('activity.character.deleted')}
                        </p>
                        <p className="text-[9px] text-zinc-500 truncate uppercase font-black tracking-[0.06em] mt-1 font-outfit flex items-center gap-2">
                          <span className="w-3 h-[1px] bg-zinc-800 group-hover:w-5 group-hover:bg-blue-500 transition-all" />
                          {participant.fitName || participant.fit || t('activity.noFitSelected')}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </TooltipProvider>
  )
}
