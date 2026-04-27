'use client'

import { formatISK } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FormattedNumber } from '../shared/FormattedNumber'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useMemo } from 'react'
import { Target, Zap, Clock, TrendingUp, ChevronLeft, ChevronRight, Minus, Hexagon } from 'lucide-react'
import { 
  startOfDay, 
  startOfWeek, 
  startOfMonth,
  addDays,
  addWeeks,
  addMonths,
  differenceInSeconds
} from 'date-fns'
import * as Tooltip from '@radix-ui/react-tooltip'
import Link from 'next/link'

interface LeaderboardItem {
  userId: string
  total: number
  label1?: number // bounty (ratting) or quantity (mining)
  label2?: number // ess (ratting)
  characterName: string
  characterId: number
}

interface LeaderboardListProps {
  data: LeaderboardItem[]
  currentUserId?: string
  period?: string
  type?: string
  userRank?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  isCollapsed?: boolean
}

function getCountdown(period: string): string {
  const now = new Date()
  if (period === 'alltime') return 'N/A'
  
  let target: Date
  const currentUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds())
  
  switch (period) {
    case 'daily':
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      break
    case 'weekly':
      // Get next Monday 00:00 UTC
      const day = now.getUTCDay()
      const diffToMonday = (day === 0 ? 1 : 8 - day)
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday))
      break
    case 'monthly':
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      break
    default:
      return '--'
  }

  const diff = Math.floor((target.getTime() - now.getTime()) / 1000)
  if (diff <= 0) return 'Resetting...'

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const mins = Math.floor((diff % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`
  }
  return `${hours}h ${mins}m ${diff % 60}s`
}

function PlayerTooltip({
  item,
  rank,
  type,
  t,
  children,
}: {
  item: LeaderboardItem
  rank: number
  type: string
  t: (key: string) => string
  children: React.ReactNode
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="center"
          sideOffset={5}
          className="z-50 animate-in fade-in zoom-in duration-200"
        >
          <div className="w-64 overflow-hidden rounded-[24px] border border-white/5 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-2xl">
             <div className="flex items-center gap-4 border-b border-white/5 pb-3 mb-3">
                <Avatar className="h-10 w-10 border border-white/10 shadow-inner">
                  <AvatarImage src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`} />
                  <AvatarFallback className="bg-zinc-900 text-zinc-500 font-black">{item.characterName[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white truncate font-outfit uppercase tracking-tight">{item.characterName}</h4>
                  <p className="text-[9px] text-cyan-400 font-black uppercase tracking-[0.2em] font-outfit mt-0.5">COMMANDER #{rank}</p>
                </div>
             </div>
             
             <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-500 uppercase font-black tracking-widest font-outfit">Gross ISK</span>
                  <span className="text-white font-mono font-black">{formatISK(item.total)}</span>
                </div>
                
                {type === 'ratting' && (
                  <>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500 uppercase font-black tracking-widest font-outfit">Bounties</span>
                      <span className="text-zinc-400 font-mono italic">{formatISK(item.label1 || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-500 uppercase font-black tracking-widest font-outfit">ESS Bank</span>
                      <span className="text-zinc-400 font-mono italic">{formatISK(item.label2 || 0)}</span>
                    </div>
                  </>
                )}

                {type === 'mining' && (
                   <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 uppercase font-black tracking-widest font-outfit">Yield</span>
                    <span className="text-zinc-400 font-mono italic"><FormattedNumber value={item.label1 || 0} suffix=" m³" /></span>
                  </div>
                )}

                {type === 'exploration' && (
                   <div className="flex justify-between items-center text-[10px]">
                    <span className="text-zinc-500 uppercase font-black tracking-widest font-outfit">Systems</span>
                    <span className="text-zinc-400 font-mono italic"><FormattedNumber value={item.label1 || 0} /></span>
                  </div>
                )}
             </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className={cn(
                  "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] font-outfit",
                  rank === 1 ? "bg-cyan-500/10 text-cyan-400" : "bg-white/5 text-zinc-500"
                )}>
                  {rank === 1 ? "ELITE PILOT" : "ACTIVE OPERATIVE"}
                </div>
                <Link 
                  href={`/players/${item.userId}`}
                  className="text-[9px] text-cyan-500 hover:text-cyan-400 font-black uppercase tracking-widest font-outfit flex items-center gap-1 transition-colors"
                >
                  {t('dashboard.viewProfile')} <ChevronRight className="h-2 w-2" />
                </Link>
              </div>
           </div>
          <Tooltip.Arrow className="fill-zinc-950/90" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function FuturisticMedal({ rank, className }: { rank: number; className?: string }) {
  const colors = [
    'text-cyan-400 fill-cyan-400/20 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]', // 1st
    'text-yellow-500 fill-yellow-500/20 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]', // 2nd
    'text-amber-600 fill-amber-600/20 drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]', // 3rd
  ]
  
  if (rank > 3) return <span className="text-[10px] font-black text-zinc-600 font-outfit">#{rank}</span>

  return (
    <div className={cn("relative flex items-center justify-center animate-in zoom-in duration-500", className)}>
      <Hexagon className={cn("h-6 w-6 stroke-[2]", colors[rank - 1])} />
      <span className="absolute text-[10px] font-black text-white drop-shadow-md font-outfit">{rank}</span>
    </div>
  )
}



export function LeaderboardList({ 
  data, 
  currentUserId, 
  period,
  type = 'ratting',
  userRank,
  onRefresh,
  isRefreshing,
  isCollapsed = false
}: LeaderboardListProps) {
  const { t } = useTranslations()
  const [page, setPage] = useState(0)
  const [countdown, setCountdown] = useState('')
  const itemsPerPage = 7

  const rankByUserId = useMemo(() => {
    const m = new Map<string, number>()
    data.forEach((item, i) => m.set(item.userId, i + 1))
    return m
  }, [data])

  const top3 = data.slice(0, 3)
  // Podium Order: [2nd, 1st, 3rd]
  const podiumOrder = top3.length === 3 
    ? [top3[1], top3[0], top3[2]] 
    : top3.length === 2 
      ? [top3[1], top3[0]] 
      : top3

  const remainingData = data.slice(3)
  const paginatedData = remainingData.slice(page * itemsPerPage, (page + 1) * itemsPerPage)
  const totalPages = Math.ceil(remainingData.length / itemsPerPage)

  const positionFromData = useMemo(() => {
    if (!currentUserId) return 0
    const i = data.findIndex((item) => item.userId === currentUserId)
    return i >= 0 ? i + 1 : 0
  }, [data, currentUserId])

  const userRow = useMemo(
    () => (currentUserId ? data.find((i) => i.userId === currentUserId) : undefined),
    [data, currentUserId]
  )

  const displayRank =
    positionFromData > 0
      ? positionFromData
      : userRank && userRank > 0
        ? userRank
        : 0

  useEffect(() => {
    if (!period || period === 'alltime') return
    setCountdown(getCountdown(period))
    const interval = setInterval(() => setCountdown(getCountdown(period)), 1000)
    return () => clearInterval(interval)
  }, [period])

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="relative mb-4">
          <TrendingUp className="h-12 w-12 text-zinc-800" />
          <div className="absolute inset-0 bg-cyan-500/5 blur-xl rounded-full" />
        </div>
        <p className="text-zinc-600 text-[11px] font-black uppercase tracking-[0.3em]">{t('dashboard.leaderboardEmptyTitle')}</p>
        <p className="text-zinc-800 text-[11px] mt-1 uppercase">{t('global.waitingForPilotActivity')}</p>
      </div>
    )

  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={cn("space-y-3 transition-all duration-500", isCollapsed && "space-y-1")}>
        {isCollapsed ? (
          <div className="flex flex-col gap-1.5 px-1">
            {data.slice(0, 10).map((item, index) => {
              const rank = index + 1
              return (
                <PlayerTooltip key={item.userId} item={item} rank={rank} type={type} t={t}>
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "relative group flex justify-center p-1 rounded-full cursor-help transition-all",
                      item.userId === currentUserId && "bg-cyan-500/10 shadow-[0_0_10px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20"
                    )}
                  >

                    <div className="relative">
                      <Avatar className={cn(
                        "h-8 w-8 border border-white/10 transition-all duration-300 group-hover:scale-110 group-hover:border-cyan-500/50",
                        rank === 1 ? "ring-2 ring-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.3)]" : 
                        rank === 2 ? "ring-1 ring-yellow-500/30" : 
                        rank === 3 ? "ring-1 ring-amber-600/30" : ""
                      )}>
                        <AvatarImage src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`} />
                        <AvatarFallback className="text-[8px] bg-zinc-900 text-zinc-600 font-black">{item.characterName[0]}</AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded flex items-center justify-center text-[8px] font-black border border-white/5 shadow-xl backdrop-blur-md",
                        rank === 1 ? "bg-cyan-500 text-black" : 
                        rank === 2 ? "bg-yellow-500/80 text-black" : 
                        rank === 3 ? "bg-amber-600/80 text-white" : "bg-black/80 text-zinc-500"
                      )}>
                        {rank}
                      </div>
                    </div>

                  </motion.div>
                </PlayerTooltip>
              )
            })}
          </div>
        ) : (
          <>
            {/* Podium Top 3 */}
        <div className="grid grid-cols-3 gap-2.5 pb-2 items-end min-h-[150px]">
          {podiumOrder.map((item) => {
            const isCurrentUser = currentUserId === item.userId
            const rank = rankByUserId.get(item.userId) ?? 0
            const isFirst = rank === 1
            
            return (
              <PlayerTooltip key={item.userId} item={item} rank={rank} type={type} t={t}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rank * 0.1 }}
                  className={cn(
                    "relative flex flex-col items-center p-3 rounded-[24px] border border-white/5 bg-white/[0.04] backdrop-blur-2xl transition-all duration-500",
                    isFirst ? "h-[150px] z-10 scale-105 border-cyan-500/20 shadow-[0_20px_40px_-15px_rgba(34,211,238,0.15)]" : "h-[125px]",
                    isCurrentUser && "border-cyan-500/40 bg-cyan-500/10 ring-1 ring-cyan-500/30"
                  )}
                >
                  <div className="absolute top-0 right-0 p-1.5">
                    <FuturisticMedal rank={rank} />
                  </div>
                  
                  <Avatar className={cn(
                    "mt-1 border border-white/10 transition-transform duration-300",
                    isFirst ? "h-14 w-14 ring-4 ring-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]" : "h-10 w-10"
                  )}>
                    <AvatarImage src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`} />
                    <AvatarFallback className="bg-zinc-900 text-zinc-600 font-black">{item.characterName[0]}</AvatarFallback>
                  </Avatar>

                  <div className="mt-3 text-center w-full flex-1 flex flex-col justify-center min-w-0">
                    <p className={cn(
                      "font-black truncate max-w-full px-1 tracking-tight leading-none uppercase font-outfit",
                      isFirst ? "text-[11px] text-white" : "text-[10px] text-zinc-400"
                    )}>
                      {item.characterName}
                    </p>
                    <p className={cn(
                      "font-mono font-black mt-1.5 tracking-tighter",
                      isFirst ? "text-xs text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "text-[10px] text-cyan-500/70"
                    )}>
                      {formatISK(item.total)}
                    </p>
                  </div>

                  <div className={cn(
                    "absolute bottom-0 left-0 right-0 h-1 rounded-full",
                    rank === 1 ? "bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" : rank === 2 ? "bg-yellow-500/60" : "bg-amber-600/60"
                  )} />
                </motion.div>
              </PlayerTooltip>
            )
          })}
        </div>


        {/* User Rank Indicator (Only if not in top 3) */}
        {displayRank > 3 && (
          <div className="flex items-center justify-between py-3 px-5 rounded-[20px] border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-md mb-4 shadow-[0_0_20px_rgba(6,182,212,0.1)] group">
             <div className="flex items-center gap-4">
                <div className="h-7 w-7 rounded-lg bg-cyan-500 flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                  <TrendingUp className="h-4 w-4 text-black" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black tracking-[0.2em] text-cyan-400/60 leading-none mb-1 font-outfit">{t('dashboard.yourPosition')}</span>
                  <span className="text-xs font-black text-white leading-none font-outfit">#{displayRank}</span>
                </div>
             </div>
             {userRow ? (
               <div className="text-xs font-mono font-black text-cyan-400 group-hover:scale-105 transition-transform tracking-tighter">
                 {formatISK(userRow.total)}
               </div>
             ) : (
               <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest font-outfit">{t('dashboard.outsideTopLeaderboard')}</div>
             )}
          </div>
        )}

        {/* Compact List for Remaining */}
        {data.length > 3 && (
        <AnimatePresence mode="wait">
          <motion.div
            key={(period || 'default') + page}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1.5"
          >
            {paginatedData.map((item, index) => {
              const globalIndex = 3 + page * itemsPerPage + index
              const isCurrentUser = currentUserId === item.userId
              const rank = globalIndex + 1
              const leaderTotal = data[0]?.total || 0
              const percentOfLeader = leaderTotal > 0 ? (item.total / leaderTotal) * 100 : 0

              return (
                <PlayerTooltip key={item.userId} item={item} rank={rank} type={type} t={t}>
                  <motion.div
                    variants={itemVariants}
                    className={cn(
                      "flex flex-col gap-1.5 p-2.5 pr-4 rounded-xl border border-white/5 bg-zinc-950/20 hover:bg-zinc-950/40 transition-all group cursor-help",
                      isCurrentUser && "border-cyan-500/20 bg-cyan-500/5 shadow-[0_0_10px_rgba(6,182,212,0.05)]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[10px] font-black text-zinc-700 text-center group-hover:text-zinc-500 transition-colors font-outfit">
                        {rank}
                      </span>
                      
                      <Avatar className="h-8 w-8 border border-white/5 shadow-inner">
                        <AvatarImage src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`} />
                        <AvatarFallback className="text-[10px] bg-zinc-900 text-zinc-600 font-black font-outfit">{item.characterName[0]}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-4">
                          <p className={cn(
                            "text-[11px] font-black truncate uppercase font-outfit tracking-tight",
                            isCurrentUser ? "text-cyan-400" : "text-zinc-400 group-hover:text-white transition-colors"
                          )}>
                            {item.characterName}
                          </p>
                          <p className="text-[11px] font-mono text-cyan-400/90 font-black tracking-tighter">
                            {formatISK(item.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-8 mt-1">
                      <div className="w-full bg-white/[0.03] h-1 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentOfLeader}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000 relative",
                            isCurrentUser 
                              ? "bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" 
                              : "bg-gradient-to-r from-zinc-700 to-zinc-600"
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                </PlayerTooltip>

              )
            })}
          </motion.div>
        </AnimatePresence>
        )}

        {/* Compact Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 px-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-all text-zinc-500 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600 font-black font-outfit">
               {page + 1} <span className="text-zinc-800">/</span> {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-20 transition-all text-zinc-500 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats Footer */}
        {countdown && period !== 'alltime' && (
          <div className="flex items-center justify-between px-2 pt-3 mt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-zinc-600 font-black font-outfit">
              <Clock className="h-3 w-3 text-cyan-500/50" />
              <span>{t('dashboard.leaderboardReset')}: <span className="text-zinc-400 font-mono tracking-tight">{countdown}</span></span>
            </div>
            {onRefresh && (
              <button 
                onClick={onRefresh}
                className={cn(
                  "text-[9px] text-cyan-500/60 hover:text-cyan-400 flex items-center gap-1.5 transition-all uppercase font-black tracking-widest font-outfit",
                  isRefreshing && "animate-pulse"
                )}
              >
                {t('common.syncing')} <TrendingUp className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </>
    )}

  </div>
</Tooltip.Provider>
  )
}