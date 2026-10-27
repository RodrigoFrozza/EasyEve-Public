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
            className="grid grid-cols-[1fr_auto_auto_auto] md:grid-cols-[1fr_auto_auto_auto_40px] gap-2 md:gap-4 items-center px-4 py-3 bg-black border border-zinc-900 rounded-none cursor-pointer hover:bg-zinc-900/60 transition-none"
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
          {expandedPilots[pilot.pilotKey] && (
            <div className="overflow-hidden">
              <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900/20 border-t border-zinc-900">
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
            </div>
          )}
        </div>
      ))}
    </div>
  )
}