'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatISK, cn } from '@/lib/utils'
import { Target, Zap, Clock, PlayCircle, PauseCircle, CheckCircle2, MapPin, ChevronRight, Activity } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { differenceInMinutes, formatDistanceToNow } from 'date-fns'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { useRouter } from 'next/navigation'

interface ActivityData {
  id: string
  type: string
  status: string
  startTime: Date
  endTime?: Date | null
  region?: string | null
  space?: string | null
  isPaused: boolean
  pausedAt?: Date | string | null
  accumulatedPausedTime?: number | null
  updatedAt?: Date | string | null
  typeId?: number | null
  data?: Record<string, unknown> | null
}

interface RecentActivityProps {
  activities: ActivityData[]
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  MINING: { icon: Zap, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', label: 'Mining' },
  RATTING: { icon: Target, color: 'text-rose-400', bgColor: 'bg-rose-500/10', label: 'Ratting' },
  EXPLORATION: { icon: MapPin, color: 'text-amber-400', bgColor: 'bg-amber-500/10', label: 'Exploration' },
  ABYSSAL: { icon: Activity, color: 'text-purple-400', bgColor: 'bg-purple-500/10', label: 'Abyssal' },
}

function getStatusIcon({ status, isPaused }: { status: string; isPaused: boolean }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-3 w-3 text-emerald-400" />
  }
  if (isPaused) {
    return <PauseCircle className="h-3 w-3 text-amber-400" />
  }
  return <PlayCircle className="h-3 w-3 text-cyan-400 animate-pulse" />
}

function getActivityEarnings(activity: ActivityData): number {
  return getActivityFinancialMetrics({ 
    type: activity.type?.toLowerCase(), 
    data: activity.data as any 
  }).gross
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const { t } = useTranslations()
  const router = useRouter()

  return (
    <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[24px] overflow-hidden shadow-xl">
      <div className="flex items-center justify-between py-3 px-5 border-b border-white/5 bg-white/[0.02]">
        <h3 className="text-[11px] uppercase tracking-[0.2em] font-black text-zinc-500 font-outfit flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {t('activity.recent')}
        </h3>
        <Link href="/dashboard/activity">
          <Button variant="ghost" className="h-6 px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-white/5 border-none transition-all">
            {t('common.viewAll')}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      
      <div className="p-3 space-y-1.5">
        {activities.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-zinc-600 text-xs font-inter">{t('activity.noRecent')}</p>
          </div>
        ) : (
          activities.slice(0, 5).map((activity) => {
            const normalizedType = activity.type?.toUpperCase() || ''
            const config = typeConfig[normalizedType] || { icon: PlayCircle, color: 'text-zinc-400', bgColor: 'bg-zinc-400/10' }
            const label = normalizedType ? t(`activity.types.${normalizedType.toLowerCase()}`) : t('common.unknown')
            const earnings = getActivityEarnings(activity)
            const isCompleted = activity.status === 'completed'
            const isPaused = activity.status === 'paused' || activity.isPaused
            
            let end: Date
            if (isCompleted && activity.endTime) {
              end = new Date(activity.endTime)
            } else if (isPaused && activity.pausedAt) {
              end = new Date(activity.pausedAt)
            } else {
              end = new Date()
            }
            
            let durationMs = end.getTime() - new Date(activity.startTime).getTime()
            if (activity.accumulatedPausedTime) {
              durationMs -= activity.accumulatedPausedTime
            }
            
            const duration = Math.max(0, Math.floor(durationMs / (1000 * 60)))
            
            return (
              <div
                key={activity.id}
                onClick={() => router.push(`/dashboard/activity?viewId=${activity.id}`)}
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-white/[0.01] p-2.5 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/5 cursor-pointer"
              >
                <div className={cn("shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110", config.bgColor, config.color)}>
                  <config.icon className="h-5 w-5" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-white uppercase tracking-tight font-outfit truncate">
                      {label}
                    </span>
                    {getStatusIcon({ status: activity.status, isPaused: activity.isPaused })}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-medium text-zinc-500 font-inter">
                    {activity.region && (
                      <span className="flex items-center gap-1 truncate max-w-[100px]">
                        <MapPin className="h-2.5 w-2.5 opacity-50" />
                        {activity.region}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 opacity-50" />
                      {formatDistanceToNow(activity.startTime, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  {earnings > 0 ? (
                    <div className="text-xs font-black text-emerald-400 font-inter tracking-tighter">
                      +{formatISK(earnings)}
                    </div>
                  ) : (
                    <div className="text-xs font-black text-zinc-700 font-inter tracking-tighter">
                      0 ISK
                    </div>
                  )}
                  <div className="text-[9px] text-zinc-600 font-black uppercase tracking-widest font-outfit">
                    {duration}m
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}