'use client'

import { memo, useMemo, useState } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Clock, Users, Trash2, ChevronRight, Pickaxe, Sword, Compass, ShieldAlert, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ActivityHistoryItemProps {
  activity: any
  onDelete: (id: string) => void
  onOpenDetail: (activity: any) => void
}

function getAccentColor(type: string) {
  if (type === 'mining') return 'bg-blue-500'
  if (type === 'ratting') return 'bg-rose-500'
  if (type === 'exploration') return 'bg-emerald-500'
  if (type === 'abyssal') return 'bg-purple-500'
  return 'bg-zinc-500'
}

function ActivityHistoryItemComponent({
  activity,
  onDelete,
  onOpenDetail,
}: ActivityHistoryItemProps) {
  const { t } = useTranslations()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const startTime = useMemo(() => new Date(activity.startTime), [activity.startTime])
  const data = useMemo(() => activity.data || {}, [activity.data])
  const isMining = activity.type === 'mining'
  const participantsCount = activity.participants?.length || 0

  const durationText = useMemo(() => {
    const isCompleted = activity.status === 'completed'
    const isPaused = activity.status === 'paused' || activity.isPaused
    
    let end: Date
    if (isCompleted && activity.endTime) {
      end = new Date(activity.endTime)
    } else if (isPaused && activity.pausedAt) {
      // For history view, if it's currently paused, the duration shown is up to the moment it paused
      end = new Date(activity.pausedAt)
    } else if (isCompleted) {
      // Fallback if endTime is missing for some reason
      end = new Date(activity.updatedAt || activity.startTime)
    } else {
      end = new Date()
    }
    
    let durationMs = end.getTime() - startTime.getTime()
    if (activity.accumulatedPausedTime) {
      durationMs -= activity.accumulatedPausedTime
    }
    
    durationMs = Math.max(0, durationMs)
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60))
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m`
  }, [activity.endTime, activity.status, activity.isPaused, activity.pausedAt, activity.updatedAt, activity.accumulatedPausedTime, startTime])

  const netEarnings = useMemo(
    () => getActivityFinancialMetrics({ type: activity.type, data }).net,
    [activity.type, data]
  )

  const relativeTime = useMemo(() => {
    const now = new Date()
    const diff = now.getTime() - startTime.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return t('common.now')
    if (minutes < 60) return t('common.minutesAgo', { count: minutes })
    if (hours < 24) return t('common.hoursAgo', { count: hours })
    if (days === 1) return t('common.yesterday')
    if (days < 7) return t('common.daysAgo', { count: days })
    return t('common.weeksAgo', { count: Math.floor(days / 7) })
  }, [startTime, t])

  const isSyncing = useMemo(() => {
    if (activity.status !== 'completed' || !activity.endTime) return false
    const diffMs = Date.now() - new Date(activity.endTime).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    return activity.type === 'ratting' ? diffMins <= 150 : activity.type === 'mining' ? diffMins <= 60 : false
  }, [activity.endTime, activity.status, activity.type])

  const typeIcon = useMemo(() => {
    switch (activity.type) {
      case 'mining': return <Pickaxe className="h-4 w-4 text-blue-400" />
      case 'ratting': return <Sword className="h-4 w-4 text-rose-400" />
      case 'exploration': return <Compass className="h-4 w-4 text-emerald-400" />
      case 'abyssal': return <Zap className="h-4 w-4 text-purple-400" />
      default: return <Pickaxe className="h-4 w-4 text-zinc-400" />
    }
  }, [activity.type])

  const containerClass = true
    ? 'rounded-2xl px-3 py-3 sm:px-4'
    : 'rounded-3xl px-5 py-5 sm:px-6'

  return (
    <div className="group relative w-full">
      <div
        onClick={() => onOpenDetail(activity)}
        className={cn(
          'bg-zinc-950/40 backdrop-blur-md border border-white/5 hover:bg-white/[0.04] hover:border-white/10 cursor-pointer group/item relative overflow-hidden transition-colors duration-200',
          containerClass
        )}
      >
        <div className={cn('absolute top-0 left-0 w-1 h-full opacity-60', getAccentColor(activity.type))} />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center relative z-10">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center justify-center shrink-0">
                {typeIcon}
              </div>
              <p className={cn('font-black text-white uppercase truncate tracking-tight', true ? 'text-sm' : 'text-base')}>
                {data.siteName || activity.type}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] h-5 uppercase font-black tracking-wider px-2 rounded-md border-opacity-30',
                  activity.space === 'high' && 'text-emerald-400 border-emerald-400 bg-emerald-400/5',
                  activity.space === 'low' && 'text-amber-400 border-amber-400 bg-amber-400/5',
                  activity.space === 'null' && 'text-rose-400 border-rose-400 bg-rose-400/5'
                )}
              >
                {activity.space || 'SEC'}
              </Badge>
              {isSyncing && (
                <Badge variant="secondary" className="text-[9px] h-5 uppercase font-black tracking-wider px-2 bg-blue-500/10 text-blue-400 border-blue-500/20 rounded-md">
                  {t('common.syncing')}
                </Badge>
              )}
              {activity.data?.isAutoTracked && (
                <Badge variant="outline" className="text-[9px] h-5 uppercase font-black tracking-wider px-2 bg-blue-500/10 text-blue-400 border-blue-500/20 rounded-md">
                  {t('common.auto')}
                </Badge>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                <Clock className="h-3 w-3 text-zinc-600" />
                {durationText}
              </span>
              <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                <Users className="h-3 w-3 text-zinc-600" />
                {participantsCount} {t('common.session.pilots')}
              </span>
              {isMining && data.totalQuantity > 0 && (
                <span className="flex items-center gap-1.5 text-blue-400/80 bg-blue-400/5 px-2 py-1 rounded-md border border-blue-400/10">
                  <Pickaxe className="h-3 w-3" />
                  {formatNumber(data.totalQuantity)} m³
                </span>
              )}
              <span className="text-zinc-600 hidden sm:inline-flex">{relativeTime}</span>
              <span className="text-zinc-600 hidden xl:inline-flex">
                <FormattedDate date={activity.startTime} />
              </span>
            </div>
          </div>

          <div className="text-left lg:text-right shrink-0">
            <p className={cn(
              'font-black font-inter tracking-tight tabular-nums leading-none',
              true ? 'text-xl' : 'text-3xl',
              netEarnings > 0 ? 'text-emerald-400' : 'text-zinc-600'
            )}>
              {formatISK(netEarnings)}
            </p>
            <p className="text-[10px] text-zinc-600 uppercase font-black tracking-[0.2em] mt-1">
              {t('common.pilotNet')}
            </p>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <div className={cn(
              'rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-zinc-500 group-hover/item:text-white group-hover/item:border-white/20 transition-colors',
              true ? 'h-9 w-9' : 'h-11 w-11'
            )}>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        title={t('common.delete')}
        onClick={(e) => {
          e.stopPropagation()
          setShowDeleteConfirm(true)
        }}
        className="absolute -right-2 -top-2 h-8 w-8 rounded-lg bg-zinc-950 border border-white/10 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 z-10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[420px] bg-zinc-950 border border-white/5 rounded-2xl p-0 backdrop-blur-2xl">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tight">
                <div className="p-2 bg-rose-500/10 rounded-lg border border-rose-500/20">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                </div>
                {t('common.deleteConfirmTitle')}
              </DialogTitle>
              <DialogDescription className="text-zinc-400 pt-4 text-xs leading-relaxed">
                {t('common.deleteConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="bg-black/40 p-5 flex-col sm:flex-row gap-3 border-t border-white/5">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900 font-black uppercase tracking-[0.14em] text-[10px] h-10 rounded-lg"
            >
              {t('common.keep')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(activity.id)
                setShowDeleteConfirm(false)
              }}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-[0.14em] text-[10px] h-10 rounded-lg"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ActivityHistoryItem = memo(ActivityHistoryItemComponent)
