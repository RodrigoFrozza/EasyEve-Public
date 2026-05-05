'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { isPremium } from '@/lib/utils'
import { 
  ActivityEnhanced, 
  isMiningActivity, 
  isRattingActivity, 
  isExplorationActivity,
  isAbyssalActivity
} from '@/types/domain'
import { useActivityStats } from '@/lib/hooks/use-activity-stats'
import { motion } from 'framer-motion'
import { useActivityTimer } from './useActivityTimer'
import { ActivityToolbar } from './ActivityToolbar'
import { useSession } from '@/lib/session-client'
import { MTUManagementModal } from './summary/MTUManagementModal'
import { UnifiedSummaryPanel } from './summary/UnifiedSummaryPanel'

interface ActivityDetailDialogProps {
  activity: ActivityEnhanced
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ActivityDetailDialog({ activity: initialActivity, trigger, open, onOpenChange }: ActivityDetailDialogProps) {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [activity, setActivity] = useState<ActivityEnhanced>(initialActivity)
  const [isMtuModalOpen, setIsMtuModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  const elapsed = useActivityTimer(
    activity.startTime, 
    activity.endTime,
    activity.isPaused,
    activity.accumulatedPausedTime ?? 0,
    activity.pausedAt
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const remoteSyncKey = `${initialActivity.status}|${initialActivity.data?.lastSyncAt ?? ''}|${initialActivity.endTime ?? ''}`
  useEffect(() => {
    setActivity(initialActivity)
    // Intentionally narrow deps: resync when operation id or remote sync fingerprint changes only,
    // so parent re-renders do not wipe optimistic local edits (e.g. MTU save).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialActivity.id, remoteSyncKey])

  const { 
    miningActivity, 
    rattingActivity, 
    miningData, 
    rattingData,
    isMining,
    logs,
  } = useActivityStats(activity)

  const activityType = activity.type
  const { color, bgGradient, borderGlow } = useMemo(() => {
    switch (activityType) {
      case 'mining':
        return { color: 'blue', bgGradient: 'bg-blue-500/5', borderGlow: 'hover:ring-blue-500/30' }
      case 'ratting':
        return { color: 'rose', bgGradient: 'bg-rose-500/5', borderGlow: 'hover:ring-rose-500/30' }
      case 'exploration':
        return { color: 'emerald', bgGradient: 'bg-emerald-500/5', borderGlow: 'hover:ring-emerald-500/30' }
      case 'abyssal':
        return { color: 'purple', bgGradient: 'bg-purple-500/5', borderGlow: 'hover:ring-purple-500/30' }
      default:
        return { color: 'blue', bgGradient: 'bg-blue-500/5', borderGlow: 'hover:ring-blue-500/30' }
    }
  }, [activityType])

  const hasPremium = isPremium(session?.user?.subscriptionEnd)

  const handleExportCSV = () => {
    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/0b3ed3dd-cac3-4ecb-96a9-dd70e4ca6ac5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07f47e'},body:JSON.stringify({sessionId:'07f47e',runId:'revalidation-3',hypothesisId:'H1',location:'ActivityDetailDialog.tsx:95',message:'export_csv_attempt',data:{activityType:activity.type,hasPremium,isMining},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!hasPremium) {
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/0b3ed3dd-cac3-4ecb-96a9-dd70e4ca6ac5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07f47e'},body:JSON.stringify({sessionId:'07f47e',runId:'revalidation-3',hypothesisId:'H1',location:'ActivityDetailDialog.tsx:98',message:'export_blocked_non_premium',data:{activityType:activity.type},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error(t('activity.summary.exportPremiumOnly'))
      return
    }
    const exportLogs = (isMining ? miningData?.logs : rattingData?.logs) as unknown[] || []
    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/0b3ed3dd-cac3-4ecb-96a9-dd70e4ca6ac5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'07f47e'},body:JSON.stringify({sessionId:'07f47e',runId:'revalidation-3',hypothesisId:'H2',location:'ActivityDetailDialog.tsx:103',message:'export_log_count',data:{activityType:activity.type,logCount:exportLogs.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (exportLogs.length === 0) {
      toast.error(t('activity.summary.exportNoLogs'))
      return
    }
    
    const headers = miningActivity 
      ? "Date,Character,Ore,Quantity,EstimatedValue\n"
      : "Date,Character,Type,Amount\n"
      
    const rows = (exportLogs as Array<Record<string, unknown>>).map((l) => {
      if (miningActivity) {
        return `${new Date(String(l.date)).toISOString()},${l.charName},${l.oreName},${l.quantity},${l.value}`
      }
      return `${new Date(String(l.date)).toISOString()},${l.charName},${l.type},${l.amount}`
    }).join("\n")
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activity.type}_history_${activity.id.slice(0, 8)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleMTUSave = (newMtus: Array<{ value?: number }>) => {
    setActivity((prev: ActivityEnhanced) => ({
      ...prev,
      data: {
        ...(prev.data as Record<string, unknown>),
        mtuSummaries: newMtus,
        estimatedLootValue: newMtus.reduce((sum, m) => sum + (m.value || 0), 0)
      } as ActivityEnhanced['data']
    }))
  }

  // Legacy tab list removed in favor of unified dashboard

  const colorClasses = {
    blue: {
      text: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      shadow: 'shadow-blue-500/5',
      ring: 'ring-blue-500/20',
    },
    rose: {
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      shadow: 'shadow-rose-500/5',
      ring: 'ring-rose-500/20',
    },
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      shadow: 'shadow-emerald-500/5',
      ring: 'ring-emerald-500/20',
    },
    purple: {
      text: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      shadow: 'shadow-purple-500/5',
      ring: 'ring-purple-500/20',
    },
  }

  const c = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue

  // Legacy overviewPanel logic removed

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={`bg-zinc-950/95 border-white/5 lg:max-w-[980px] md:max-w-[94vw] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 shadow-2xl backdrop-blur-2xl rounded-[24px] [&>button]:right-4 [&>button]:top-4 [&>button]:text-white [&>button]:hover:text-red-400 [&>button]:h-10 [&>button]:w-10 ${borderGlow}`}>
        <DialogHeader className="sr-only">
          <DialogTitle>{activity.data?.siteName || activity.type}</DialogTitle>
          <DialogDescription>
            Detailed view of the current activity including duration, logs, and pilots.
          </DialogDescription>
        </DialogHeader>
        
        {/* Header */}
        <motion.div 
          className={`bg-zinc-900/40 border-b border-white/5 p-3 sm:p-4 lg:p-5 relative overflow-visible`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className={`absolute top-0 right-0 w-[500px] h-[500px] ${bgGradient} blur-[120px] pointer-events-none rounded-full`} />
          
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 lg:gap-4 relative z-10">
            <div className="flex flex-row items-center gap-4 lg:gap-6">
              <div className="flex flex-col items-start gap-1">
                <span className="text-[8px] lg:text-[9px] text-zinc-600 font-black tracking-[0.24em] uppercase font-outfit">{t('common.session.duration')}</span>
                <div className={`bg-zinc-950/60 border border-white/10 px-4 py-2 rounded-[12px] shadow-xl backdrop-blur-xl ring-1 ${c.ring} group`}>
                  <span className={`text-xl lg:text-2xl font-black font-mono ${c.text} tracking-tight tabular-nums group-hover:opacity-80 transition-colors`}>{elapsed}</span>
                </div>
              </div>
            </div>

            <div className="p-0 text-left flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                <span className={`px-2 py-0.5 sm:py-1 text-[8px] sm:text-[9px] uppercase font-black tracking-[0.2em] border ${c.border} ${c.text} ${c.bg} rounded-md font-outfit shadow-lg ${c.shadow}`}>
                  {t(`activity.types.${activity.type}`)}
                </span>
                {activity.data?.isAutoTracked && (
                  <span className="px-2 py-0.5 sm:py-1 text-[8px] sm:text-[9px] uppercase font-black tracking-[0.2em] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md font-outfit shadow-lg shadow-blue-500/5">
                    AUTO
                  </span>
                )}
                <div className="h-3 sm:h-4 w-[1px] bg-white/10" />
                <span className="text-[9px] sm:text-[10px] font-black font-mono text-zinc-600 uppercase tracking-[0.12em] truncate">
                  {activity.id.slice(0, 12)}
                </span>
              </div>
              
              <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black text-white tracking-tight flex items-center gap-2 sm:gap-3 flex-wrap leading-[1.15] font-outfit uppercase">
                <span className="line-clamp-2 break-words max-w-full">{(activity.data as { siteName?: string }).siteName || activity.type}</span>
                {activity.status === 'completed' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[8px] sm:text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 sm:py-1 font-outfit rounded-md">
                    {t('common.session.done')}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-zinc-500">{t('common.session.start')}</span>
                  <p className="text-base sm:text-lg font-black text-zinc-200 font-mono tracking-tight">{new Date(activity.startTime).toLocaleString()}</p>
                </div>
                {activity.endTime && (
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.1em] text-zinc-500">{t('common.session.end')}</span>
                    <p className="text-base sm:text-lg font-black text-zinc-200 font-mono tracking-tight">{new Date(activity.endTime).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Unified Dashboard Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5 lg:p-6">
          
          <ActivityToolbar 
            onExportCSV={handleExportCSV}
            isPremium={hasPremium}
          />

          <UnifiedSummaryPanel 
            activity={activity} 
            onOpenMTU={() => setIsMtuModalOpen(true)}
          />
        </div>

        {rattingActivity && (
          <MTUManagementModal 
            activityId={activity.id}
            initialMtus={rattingData?.mtuSummaries || []}
            isOpen={isMtuModalOpen}
            onOpenChange={setIsMtuModalOpen}
            onSave={handleMTUSave}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
