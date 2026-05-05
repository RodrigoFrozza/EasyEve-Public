'use client'

import { useMemo } from 'react'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isAbyssalActivity, isExplorationActivity } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { Users, Ship, Wallet, Percent } from 'lucide-react'
import { formatISK, cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { motion } from 'framer-motion'

interface PersonnelSectionProps {
  activity: ActivityEnhanced
}

export function PersonnelSection({ activity }: PersonnelSectionProps) {
  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])
  const totalEarned = metrics.net

  const pilotStats = useMemo(() => {
    const participants = activity.participants ?? []
    const n = participants.length
    const equalShare = n > 0 ? totalEarned / n : 0

    return participants.map((pilot, idx) => {
      let earned = 0
      const data = pilot as any

      if (isMiningActivity(activity)) {
        earned = Number(data.totalLootValue) || 0
      } else if (isRattingActivity(activity)) {
        earned = Number(data.totalLootValue) || Number(data.grossBounties) || 0
      } else if (isAbyssalActivity(activity) || isExplorationActivity(activity)) {
        earned = equalShare
      } else {
        earned = Number(data.totalLootValue) || equalShare
      }

      if (earned === 0 && totalEarned > 0 && n > 0) {
        earned = equalShare
      }

      const percentage = totalEarned > 0 ? (earned / totalEarned) * 100 : 0
      
      return {
        ...pilot,
        earned,
        percentage,
        fitName: pilot.fitName || pilot.fit || 'Unknown Fit'
      }
    }).sort((a, b) => b.earned - a.earned)
  }, [activity, totalEarned])

  if (pilotStats.length === 0) return null

  return (
    <ExpandableSection
      title="Personnel Breakdown"
      icon={<Users className="w-4 h-4" />}
      variant="default"
      summary={
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
          {pilotStats.length} Pilots · Highest Share: {pilotStats[0]?.percentage.toFixed(0)}%
        </p>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
        {pilotStats.map((pilot, idx) => (
          <div 
            key={`${pilot.characterId}-${idx}`}
            className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/10 transition-all"
          >
            <Avatar className="h-12 w-12 border border-white/10 shadow-xl group-hover:scale-105 transition-transform">
              <AvatarImage src={`https://images.evetech.net/characters/${pilot.characterId}/portrait?size=128`} />
              <AvatarFallback className="bg-zinc-900 text-xs font-black">
                {pilot.characterName[0]}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-zinc-200 truncate">
                  {pilot.characterName}
                </p>
                <span className="text-[10px] font-black text-zinc-500 font-mono">
                  {pilot.percentage.toFixed(1)}%
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Ship className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] font-black text-zinc-500 truncate uppercase tracking-widest">
                  {pilot.fitName}
                </span>
              </div>

              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pilot.percentage}%` }}
                  className="h-full bg-blue-500"
                />
              </div>

              <p className="text-[10px] font-black text-zinc-400 font-mono">
                {formatISK(pilot.earned)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ExpandableSection>
  )
}
