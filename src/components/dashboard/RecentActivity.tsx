'use client'

import { formatISK, cn } from '@/lib/utils'
import { Target, Zap, Clock, PlayCircle, PauseCircle, CheckCircle2, MapPin, ChevronRight, Activity, TrendingUp, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { formatDistanceToNow } from 'date-fns'
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
  MINING: { icon: Zap, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10', label: 'Mining' },
  RATTING: { icon: Target, color: 'text-amber-500', bgColor: 'bg-amber-500/10', label: 'Ratting' },
  EXPLORATION: { icon: MapPin, color: 'text-violet-500', bgColor: 'bg-violet-500/10', label: 'Exploration' },
  ABYSSAL: { icon: Activity, color: 'text-rose-500', bgColor: 'bg-rose-500/10', label: 'Abyssal' },
  ESCALATIONS: { icon: TrendingUp, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Escalations' },
  SALVAGING: { icon: MapPin, color: 'text-lime-500', bgColor: 'bg-lime-500/10', label: 'Salvaging' },
  CRAB: { icon: ShieldCheck, color: 'text-orange-400', bgColor: 'bg-orange-500/10', label: 'CRAB' },
  PVP: { icon: Target, color: 'text-pink-400', bgColor: 'bg-pink-500/10', label: 'PVP' },
}

function getStatusIcon({ status, isPaused }: { status: string; isPaused: boolean }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-3 w-3 text-emerald-500" />
  }
  if (isPaused) {
    return <PauseCircle className="h-3 w-3 text-amber-500" />
  }
  return <PlayCircle className="h-3 w-3 text-sky-500 animate-eve-pulse" />
}

function getActivityEarnings(activity: ActivityData): number {
  return getActivityFinancialMetrics({ 
    type: activity.type?.toLowerCase(), 
    data: activity.data as any 
  }).gross
}

export function RecentActivity({ activities: rawActivities }: RecentActivityProps) {
  const { t } = useTranslations()
  const router = useRouter()

  // Defensive filtering
  const activities = (rawActivities || []).filter(Boolean)

  return (
    <div className="bg-eve-panel border border-eve-border rounded-sm overflow-hidden">
      <div className="flex items-center justify-between py-2.5 px-4 border-b border-eve-border bg-eve-dark">
        <h3 className="text-xs font-semibold text-eve-text flex items-center gap-2">
          <Activity className="h-4 w-4 text-eve-accent" />
          {t('activity.recent')}
        </h3>
        <Link href="/dashboard/activity">
          <Button variant="ghost" className="h-7 px-3 text-xs text-eve-muted hover:text-eve-accent">
            {t('common.viewAll')}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
      
      <div className="p-3 space-y-1.5">
        {activities.length === 0 ? (
          <div className="py-10 text-center border border-eve-border/30 bg-eve-dark rounded-sm">
            <p className="text-xs text-eve-muted">{t('activity.noRecent')}</p>
          </div>
        ) : (
          activities.slice(0, 5).map((activity) => {
            if (!activity) return null
            const normalizedType = activity.type?.toUpperCase() || ''
            const config = typeConfig[normalizedType] || { icon: PlayCircle, color: 'text-eve-muted', bgColor: 'bg-eve-dark' }
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
                className="group flex items-center gap-3 rounded-sm border border-eve-border/40 bg-eve-dark p-3 transition-colors hover:bg-eve-panel-light hover:border-eve-accent/20 cursor-pointer"
              >
                <div className={cn("shrink-0 w-9 h-9 rounded-sm border border-eve-border/30 flex items-center justify-center", config.bgColor, config.color)}>
                  <config.icon className="h-4 w-4 opacity-90" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-eve-text group-hover:text-white transition-colors truncate">
                      {label}
                    </span>
                    {getStatusIcon({ status: activity.status, isPaused: activity.isPaused })}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-eve-muted">
                    {activity.region && (
                      <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <MapPin className="h-2.5 w-2.5" />
                        {activity.region}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNow(activity.startTime, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                
                <div className="text-right shrink-0">
                  {earnings > 0 ? (
                    <div className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors tabular-nums">
                      +{formatISK(earnings)}
                    </div>
                  ) : (
                    <div className="text-xs text-eve-muted tabular-nums">
                      0 ISK
                    </div>
                  )}
                  <div className="text-[10px] text-eve-muted">
                    {duration}min
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