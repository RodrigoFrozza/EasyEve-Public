'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn, calculateNetProfit } from '@/lib/utils'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { type Activity, useActivityStore } from '@/lib/stores/activity-store'
import { type ActivityType } from '@/lib/constants/activity-colors'
import { ActivityCardHeader } from './shared/ActivityCardHeader'
import dynamic from 'next/dynamic'
import { useTranslations } from '@/i18n/hooks'

// Lazy loaded heavy components
const MiningActivityContent = dynamic(() => import('./types/MiningActivityContent').then(mod => mod.MiningActivityContent), { ssr: false })
const RattingActivityContent = dynamic(() => import('./types/RattingActivityContentV2').then(mod => mod.RattingActivityContentV2), { ssr: false })
const ExplorationActivityContent = dynamic(() => import('./types/ExplorationActivityContent').then(mod => mod.ExplorationActivityContent), { ssr: false })
const AbyssalActivityContent = dynamic(() => import('./types/AbyssalActivityContentV2').then(mod => mod.AbyssalActivityContentV2), { ssr: false })

export interface ActivityCardProps {
  activity: Activity
  index: number
  onEnd: () => void
}

export function ActivityCard({ activity, index, onEnd }: ActivityCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [displayMode, setDisplayMode] = useState<'compact' | 'expanded'>('compact')
  const { t } = useTranslations()

  const { metrics, isMounted } = useActivityMetrics(activity)
  const updateActivity = useActivityStore(s => s.updateActivity)
  const serverClockOffset = useActivityStore(s => s.serverClockOffset)

  const cardTheme = useMemo(() => getActivityColors(activity.type as ActivityType), [activity.type])
  const hoverBorderClass = `hover:border-${cardTheme.primary}-500/20`
  const gradientClass = `from-${cardTheme.primary}-500/5 via-transparent to-transparent`

  const handleTogglePause = async () => {
    const isPausing = !activity.isPaused
    const serverNow = Date.now() + serverClockOffset
    
    let updates: Partial<Activity> = { isPaused: isPausing }
    
    if (isPausing) {
      updates.pausedAt = new Date(serverNow).toISOString()
    } else {
      const pausedAt = activity.pausedAt ? new Date(activity.pausedAt).getTime() : serverNow
      const pausedDuration = Math.max(0, serverNow - pausedAt)
      updates.accumulatedPausedTime = (activity.accumulatedPausedTime || 0) + pausedDuration
      updates.pausedAt = null
      
      // Manual resume: update sync markers to prevent immediate re-pause by auto-detection
      const currentData = (activity.data as any) || {}
      updates.data = {
        ...currentData,
        lastSyncAt: new Date(serverNow).toISOString(),
        lastDataAt: new Date(serverNow).toISOString()
      }
    }
    
    updateActivity(activity.id, updates)
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates })
      })
    } catch (e) {
      toast.error(t('activity.failedSyncPause'))
    }
  }

  const handleSyncFinancials = async () => {
    setIsSyncing(true)
    setSyncStatus('idle')
    const isExploration = activity.type === 'exploration'
    const isAbyssal = activity.type === 'abyssal'
    const serverNow = Date.now() + serverClockOffset
    
    if (isExploration || isAbyssal) {
      const toastId = toast.loading(t('activity.updatingPrices'))
      try {
        const { getMarketAppraisal } = await import('@/lib/market')
        const logs = (activity.data as any)?.logs || []
        const itemNames = Array.from(new Set(logs.flatMap((l: any) => l.items?.map((i: any) => i.name as string) || []))) as string[]
        if (itemNames.length === 0) {
          // Even if no items, we update sync markers to show activity
          const data = { 
            ...(activity.data as any), 
            lastSyncAt: new Date(serverNow).toISOString(),
            lastDataAt: new Date(serverNow).toISOString()
          }
          await fetch(`/api/activities/${activity.id}`, { method: 'PATCH', body: JSON.stringify({ data }) })
          updateActivity(activity.id, { data })
          
          toast.error(t('activity.noItemsAppraise'), { id: toastId })
          setIsSyncing(false)
          return
        }
        const prices = await getMarketAppraisal(itemNames)
        let newTotalValue = 0
        const updatedLogs = logs.map((log: any) => {
          if (!log.items) return log
          const items = log.items.map((i: any) => {
            const price = prices[i.name?.toLowerCase()] || i.price || 0
            newTotalValue += price * i.quantity
            return { ...i, price, total: price * i.quantity }
          })
          return { ...log, items, value: items.reduce((s: number, i: any) => s + (i.total || 0), 0) }
        })
        const data = { 
          ...(activity.data as any), 
          totalLootValue: newTotalValue, 
          logs: updatedLogs,
          lastSyncAt: new Date(serverNow).toISOString(),
          lastDataAt: new Date(serverNow).toISOString()
        }
        await fetch(`/api/activities/${activity.id}`, { method: 'PATCH', body: JSON.stringify({ data }) })
        updateActivity(activity.id, { data })
        toast.success(t('activity.pricesUpdated'), { id: toastId })
        setSyncStatus('success')
      } catch (e) {
        setSyncStatus('error')
        toast.error(t('activity.syncFailed'), { id: toastId })
      } finally { setIsSyncing(false) }
      return
    }

    const endpoint = metrics.isMining ? 'sync-mining' : 'sync'
    const toastId = toast.loading(t('activity.syncingESI'))
    try {
      const res = await fetch(`/api/activities/${endpoint}?id=${activity.id}`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        updateActivity(activity.id, updated)
        setSyncStatus('success')
        toast.success(t('activity.syncESIComplete'), { id: toastId })
      } else {
        setSyncStatus('error')
        toast.error(t('activity.syncFailed'), { id: toastId })
      }
    } catch (error) {
      setSyncStatus('error')
      toast.error(t('activity.syncFailed'), { id: toastId })
    } finally {
      setTimeout(() => { setIsSyncing(false); setTimeout(() => setSyncStatus('idle'), 3000) }, 500)
    }
  }

  const renderContent = (mode: 'compact' | 'expanded') => {
    const props = {
      activity,
      onSync: handleSyncFinancials,
      isSyncing,
      syncStatus,
      onEnd,
      displayMode: mode,
      isPaused: activity.isPaused,
      onTogglePause: handleTogglePause,
      essCountdown: metrics.essCountdown
    }

    switch (activity.type) {
      case 'mining': return <MiningActivityContent {...props} />
      case 'ratting': return <RattingActivityContent {...props} />
      case 'exploration': return <ExplorationActivityContent {...props} />
      case 'abyssal': return <AbyssalActivityContent {...props} />
      default: return <div className="py-4 text-center text-zinc-500 text-sm">{t('activity.detailedModeNotAvailable')}</div>
    }
  }

  if (!isMounted) {
    return (
      <Card className="overflow-hidden bg-zinc-950/40 border-white/[0.03] backdrop-blur-xl rounded-2xl h-full flex flex-col">
        <div className="p-4 space-y-4">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/5 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
                <div className="h-3 w-16 bg-white/5 animate-pulse rounded" />
              </div>
            </div>
            <div className="h-6 w-20 bg-white/5 animate-pulse rounded-full" />
          </div>
          
          {/* Content Skeleton */}
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse" />
            ))}
          </div>
          
          {/* Footer Skeleton */}
          <div className="flex justify-between mt-auto pt-4 border-t border-white/5">
            <div className="h-8 w-24 bg-white/5 animate-pulse rounded" />
            <div className="h-8 w-24 bg-white/5 animate-pulse rounded" />
          </div>
        </div>
      </Card>
    )
  }
  
  return (
    <TooltipProvider delayDuration={200}>
      <Card className={cn(
        "bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-[40px] overflow-hidden shadow-2xl transition-all duration-700 group/card relative",
        hoverBorderClass
      )}>
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover/card:opacity-100 transition-opacity duration-1000 pointer-events-none",
          gradientClass
        )} />
        
        <ActivityCardHeader 
          activity={activity}
          index={index}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          elapsed={metrics.elapsedFormatted}
          mounted={isMounted}
          typeLabel={t(`activity.types.${activity.type}`) || t('activity.activeOperations')}
        />
        
        <CardContent className="p-6">
          {displayMode === 'compact' ? (
            <div className="space-y-4">{renderContent('compact')}</div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-2 duration-700">
              {renderContent('expanded')}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
