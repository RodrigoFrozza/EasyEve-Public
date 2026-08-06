'use client'

import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn, calculateNetProfit } from '@/lib/utils'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { type Activity, useActivityStore } from '@/lib/stores/activity-store'
import { type ActivityType } from '@/lib/constants/activity-colors'
import { ActivityCardHeader } from './shared/ActivityCardHeader'
import {
  getActivityCardContentClass,
  getActivityCardShellClass,
} from './shared/activity-card-layout'
import {
  ActivityCardLayoutProvider,
  toActivityCardLayoutMode,
} from './shared/activity-card-display-context'
import dynamic from 'next/dynamic'
import { useTranslations } from '@/i18n/hooks'
import {
  collectAbyssalItemNames,
  repriceAbyssalActivityRuns,
} from '@/lib/activities/abyssal-loot-contents'

// Lazy loaded heavy components
const MiningActivityContent = dynamic(() => import('./types/MiningActivityContent').then(mod => mod.MiningActivityContent), { ssr: false })
const RattingActivityContent = dynamic(() => import('./types/RattingActivityContentV2').then(mod => mod.RattingActivityContentV2), { ssr: false })
const ExplorationActivityContent = dynamic(() => import('./types/ExplorationActivityContent').then(mod => mod.ExplorationActivityContent), { ssr: false })
const AbyssalActivityContent = dynamic(() => import('./types/AbyssalActivityContentV2').then(mod => mod.AbyssalActivityContentV2), { ssr: false })
const SalvagingActivityContent = dynamic(() => import('./types/SalvagingActivityContent').then(mod => mod.SalvagingActivityContent), { ssr: false })
const EscalationsActivityContent = dynamic(() => import('./types/EscalationsActivityContent').then(mod => mod.EscalationsActivityContent), { ssr: false })

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
    }

    const resumeMarkers =
      !isPausing
        ? {
            data: {
              lastSyncAt: new Date(serverNow).toISOString(),
              lastDataAt: new Date(serverNow).toISOString(),
            },
          }
        : {}

    updateActivity(activity.id, { ...updates, ...resumeMarkers })
    try {
      const patchBody = isPausing
        ? { isPaused: updates.isPaused, pausedAt: updates.pausedAt }
        : {
            isPaused: updates.isPaused,
            pausedAt: updates.pausedAt,
            accumulatedPausedTime: updates.accumulatedPausedTime,
            data: resumeMarkers.data,
          }

      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
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
    const isSalvaging = activity.type === 'salvaging'
    const serverNow = Date.now() + serverClockOffset
    
    if (isAbyssal) {
      const toastId = toast.loading(t('activity.updatingPrices'))
      try {
        const activityData = (activity.data as Record<string, unknown>) || {}
        const runs = (activityData.runs as Array<Record<string, unknown>>) || []
        const logs = (activityData.logs as Array<Record<string, unknown>>) || []

        if (runs.length === 0) {
          const { getMarketAppraisal } = await import('@/lib/market')
          const itemNames = Array.from(
            new Set(
              logs.flatMap((l) =>
                ((l.items as Array<{ name?: string }>) || []).map((i) => i.name as string),
              ),
            ),
          ).filter(Boolean) as string[]

          if (itemNames.length === 0) {
            const data = {
              ...activityData,
              lastSyncAt: new Date(serverNow).toISOString(),
            }
            await fetch(`/api/activities/${activity.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data }),
            })
            updateActivity(activity.id, { data })
            toast.error(t('activity.noItemsAppraise'), { id: toastId })
            setIsSyncing(false)
            return
          }

          const prices = await getMarketAppraisal(itemNames)
          let newTotalValue = 0
          const updatedLogs = logs.map((log) => {
            if (!log.items) return log
            const items = (log.items as Array<{ name?: string; quantity: number; price?: number }>).map(
              (i) => {
                const price = prices[i.name?.toLowerCase() ?? ''] || i.price || 0
                newTotalValue += price * i.quantity
                return { ...i, price, total: price * i.quantity }
              },
            )
            return {
              ...log,
              items,
              value: items.reduce((s, i) => s + ((i as { total?: number }).total || 0), 0),
            }
          })
          const data = {
            ...activityData,
            totalLootValue: newTotalValue,
            logs: updatedLogs,
            lastSyncAt: new Date(serverNow).toISOString(),
          }
          await fetch(`/api/activities/${activity.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          })
          updateActivity(activity.id, { data })
          toast.success(t('activity.pricesUpdated'), { id: toastId })
          setSyncStatus('success')
        } else {
          const { getMarketAppraisal } = await import('@/lib/market')
          const itemNames = collectAbyssalItemNames(runs)
          if (itemNames.length === 0) {
            const data = {
              ...activityData,
              lastSyncAt: new Date(serverNow).toISOString(),
            }
            await fetch(`/api/activities/${activity.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data }),
            })
            updateActivity(activity.id, { data })
            toast.error(t('activity.noItemsAppraise'), { id: toastId })
            setIsSyncing(false)
            return
          }

          const prices = await getMarketAppraisal(itemNames)
          const repriced = repriceAbyssalActivityRuns(runs, logs, prices)
          const data = {
            ...activityData,
            runs: repriced.runs,
            logs: repriced.logs,
            totalLootValue: repriced.totalLootValue,
            lootValue: repriced.totalLootValue,
            lootContents: repriced.lootContents,
            lastSyncAt: new Date(serverNow).toISOString(),
          }
          await fetch(`/api/activities/${activity.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
          })
          updateActivity(activity.id, { data })
          toast.success(t('activity.pricesUpdated'), { id: toastId })
          setSyncStatus('success')
        }
      } catch (e) {
        setSyncStatus('error')
        toast.error(t('activity.syncFailed'), { id: toastId })
      } finally {
        setIsSyncing(false)
      }
      return
    }

    if (isExploration || isSalvaging) {
      const toastId = toast.loading(t('activity.updatingPrices'))
      try {
        const { getMarketAppraisal } = await import('@/lib/market')
        const logs = (activity.data as any)?.logs || []
        const itemNames = Array.from(new Set(logs.flatMap((l: any) => l.items?.map((i: any) => i.name as string) || []))) as string[]
        if (itemNames.length === 0) {
          const data = { 
            ...(activity.data as any), 
            lastSyncAt: new Date(serverNow).toISOString(),
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
      case 'salvaging': return <SalvagingActivityContent {...props} />
      case 'escalations': return <EscalationsActivityContent {...props} />
      default: return <div className="py-4 text-center text-muted-foreground text-sm">{t('activity.detailedModeNotAvailable')}</div>
    }
  }

  const theme = getActivityTheme(activity.type)
  const layoutMode = toActivityCardLayoutMode(displayMode)
  const cardShellClass = getActivityCardShellClass(layoutMode)
  const cardContentClass = getActivityCardContentClass(layoutMode)

  if (!isMounted) {
    return (
      <Card
        className={cn(
          'flex w-full min-w-0 flex-col overflow-visible border-0 bg-transparent shadow-none',
          cardShellClass,
          theme.card,
          theme.cardGlow
        )}
      >
        <div className={cn('space-y-4 p-4 sm:p-5', theme.body)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-lg border border-white/5 bg-black/30" />
              <div className="space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-md bg-white/5" />
                <div className="h-4 w-36 animate-pulse rounded-md bg-white/10" />
              </div>
            </div>
            <div className="h-9 w-24 animate-pulse rounded-lg bg-white/5" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[4.5rem] animate-pulse rounded-lg border border-white/5 bg-black/25"
              />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Card
        data-activity-card-layout={layoutMode}
        className={cn(
          'group/card relative isolate flex w-full min-w-0 flex-col overflow-visible border-0 bg-transparent shadow-none transition-all duration-300 hover:-translate-y-0.5',
          cardShellClass,
          theme.card,
          theme.cardGlow
        )}
      >
        <div className={theme.cardTint} aria-hidden />
        <div className={theme.cardOrb} aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(135deg,rgba(255,255,255,0.04)_0%,transparent_45%,transparent_100%)]"
          aria-hidden
        />

        <ActivityCardHeader
          activity={activity}
          index={index}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          elapsed={metrics.elapsedFormatted}
          mounted={isMounted}
          typeLabel={t(`activity.types.${activity.type}`) || t('activity.activeOperations')}
        />
        
        <CardContent
          className={cn('relative z-[2] p-4 sm:p-5', cardContentClass, theme.body)}
        >
          <ActivityCardLayoutProvider mode={layoutMode}>
            {displayMode === 'compact'
              ? renderContent('compact')
              : renderContent('expanded')}
          </ActivityCardLayoutProvider>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
