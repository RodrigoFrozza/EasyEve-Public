'use client'

import { useState, useMemo } from 'react'
import { formatISK, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ChevronDown, Ship, Wallet, Percent } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, ActivityParticipant, isMiningActivity, isRattingActivity, isAbyssalActivity, isExplorationActivity } from '@/types/domain'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { motion, AnimatePresence } from 'framer-motion'

interface PilotsTabProps {
  activity: ActivityEnhanced
}

export function PilotsTab({ activity }: PilotsTabProps) {
  const { t } = useTranslations()
  const [expandedPilots, setExpandedPilots] = useState<Record<string, boolean>>({})

  const participants = useMemo(
    () => activity.participants ?? [],
    [activity.participants]
  )
  
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const totalEarned = metrics.net

  const togglePilot = (pilotKey: string) => {
    setExpandedPilots(prev => ({
      ...prev,
      [pilotKey]: !prev[pilotKey]
    }))
  }

  const pilotStats = useMemo(() => {
    const n = participants.length
    const equalShare = n > 0 ? totalEarned / n : 0

    type PilotExtras = ActivityParticipant & {
      totalLootValue?: number
      grossBounties?: number
      charId?: number
    }

    return participants.map((pilot: PilotExtras, idx) => {
      let earned = 0
      if (isMiningActivity(activity)) {
        earned = Number(pilot.totalLootValue) || 0
      } else if (isRattingActivity(activity)) {
        earned = Number(pilot.totalLootValue) || Number(pilot.grossBounties) || 0
      } else if (isAbyssalActivity(activity) || isExplorationActivity(activity)) {
        earned = equalShare
      } else {
        earned = Number(pilot.totalLootValue) || equalShare
      }

      if (earned === 0 && totalEarned > 0 && n > 0) {
        earned = equalShare
      }

      const percentage = totalEarned > 0 ? (earned / totalEarned) * 100 : 0
      const pilotKey = String(
        pilot.characterId ?? pilot.charId ?? pilot.characterName ?? `pilot-${idx}`
      )
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/0b3ed3dd-cac3-4ecb-96a9-dd70e4ca6ac5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07f47e'},body:JSON.stringify({sessionId:'07f47e',runId:'revalidation-3',hypothesisId:'H4',location:'PilotsTab.tsx:62',message:'pilot_key_generated',data:{idx,pilotKey,characterId:pilot.characterId,charId:pilot.charId,characterName:pilot.characterName},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      return {
        ...pilot,
        pilotKey,
        earned,
        percentage,
        fitName: String(pilot.fitName || pilot.fit || '-'),
      }
    }).sort((a, b) => b.earned - a.earned)
  }, [participants, totalEarned, activity])

  if (participants.length === 0) {
    return (
      <div className="py-12 text-center opacity-40">
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
          {t('common.session.pilots')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Table Header */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_auto_auto_40px] gap-4 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-600">
        <span>{t('common.character')}</span>
        <span className="text-right">{t('activity.summary.fitting')}</span>
        <span className="text-right">{t('common.session.totalEarned')}</span>
        <span className="text-right">{t('common.session.share')}</span>
        <span></span>
      </div>

      {/* Pilots List */}
      {pilotStats.map((pilot) => (
        <div key={pilot.pilotKey}>
          <div
            onClick={() => togglePilot(pilot.pilotKey)}
            className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto_40px] gap-2 md:gap-4 items-center px-4 py-3 bg-zinc-950/40 border border-white/5 rounded-xl cursor-pointer hover:bg-zinc-900/60 hover:border-white/10 transition-all"
          >
            {/* Pilot Info */}
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={`https://images.evetech.net/characters/${pilot.characterId || pilot.charId}/portrait?size=64`} />
                <AvatarFallback className="bg-zinc-900 text-xs font-black">
                  {(String(pilot.characterName || t('common.unknown')))[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-black text-zinc-200 truncate">
                  {String(pilot.characterName || t('common.unknown'))}
                </p>
                <p className="text-[9px] text-zinc-500 truncate">
                  {pilot.fitName || '-'}
                </p>
              </div>
            </div>

            {/* Fitting (hidden on mobile) */}
            <div className="hidden md:flex items-center gap-2">
              <Ship className="h-4 w-4 text-zinc-600" />
              <span className="text-[10px] font-black text-zinc-400 truncate max-w-[120px]">
                {pilot.fitName || '-'}
              </span>
            </div>

            {/* Earned */}
            <div className="text-right">
              <p className="text-sm font-black text-zinc-200 font-mono">
                {formatISK(pilot.earned)}
              </p>
            </div>

            {/* Percentage */}
            <div className="text-right">
              <p className="text-sm font-black text-zinc-400">
                {pilot.percentage.toFixed(1)}%
              </p>
            </div>

            {/* Expand Button */}
            <div className="md:w-10 flex justify-end">
              <ChevronDown className={cn(
                "h-4 w-4 text-zinc-600 transition-transform",
                expandedPilots[pilot.pilotKey] && "rotate-180"
              )} />
            </div>
          </div>

          {/* Expanded Details */}
          <AnimatePresence>
            {expandedPilots[pilot.pilotKey] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-zinc-600" />
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('common.session.totalEarned')}</p>
                      <p className="text-sm font-black text-zinc-300">{formatISK(pilot.earned)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Percent className="h-4 w-4 text-zinc-600" />
                    <div>
                      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">{t('common.session.share')}</p>
                      <p className="text-sm font-black text-zinc-300">{pilot.percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}