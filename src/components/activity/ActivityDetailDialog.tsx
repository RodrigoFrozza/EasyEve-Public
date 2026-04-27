import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { formatISK } from '@/lib/utils'
import { 
  ActivityEnhanced, 
  isMiningActivity, 
  isRattingActivity, 
  isExplorationActivity,
  isAbyssalActivity
} from '@/types/domain'
import { useActivityStats } from '@/lib/hooks/use-activity-stats'
import { motion, AnimatePresence } from 'framer-motion'
import { useActivityTimer } from './useActivityTimer'
import { ActivityToolbar } from './ActivityToolbar'
import { ActivityFooter } from './ActivityFooter'
import { ActivityParticipants } from './ActivityParticipants'
import { animations } from './animations'
import { ActivityDetailSkeleton } from './shared/ActivitySkeleton'
import { Calendar, X } from 'lucide-react'

const MiningSummaryPanel = dynamic(() => import('./summary/MiningSummaryPanel').then((m) => m.MiningSummaryPanel))
const RattingSummaryPanel = dynamic(() => import('./summary/RattingSummaryPanel').then((m) => m.RattingSummaryPanel))
const ExplorationSummaryPanel = dynamic(() => import('./summary/ExplorationSummaryPanel').then((m) => m.ExplorationSummaryPanel))
const AbyssalSummaryPanel = dynamic(() => import('./summary/AbyssalSummaryPanel').then((m) => m.AbyssalSummaryPanel))

interface ActivityDetailDialogProps {
  activity: ActivityEnhanced
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ActivityDetailDialog({ activity: initialActivity, trigger, open, onOpenChange }: ActivityDetailDialogProps) {
  const { t } = useTranslations()
  const [activity, setActivity] = useState<ActivityEnhanced>(initialActivity)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed')
  const [isMtuModalOpen, setIsMtuModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dateFilter, setDateFilter] = useState<{ start: string | null; end: string | null }>({ start: null, end: null })
  const [showDateFilter, setShowDateFilter] = useState(false)

  const elapsed = useActivityTimer(activity.startTime, activity.endTime)

  useEffect(() => {
    setMounted(true)
  }, [])

  const remoteSyncKey = `${initialActivity.status}|${initialActivity.data?.lastSyncAt ?? ''}|${initialActivity.endTime ?? ''}`
  useEffect(() => {
    setActivity(initialActivity)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid clobbering local edits on referential churn
  }, [initialActivity.id, remoteSyncKey])

  const { 
    miningActivity, 
    rattingActivity, 
    miningData, 
    rattingData,
    isMining
  } = useActivityStats(activity)

  const filterLogsByDate = <T extends { date?: string; dateAdded?: string }>(logs: T[]): T[] => {
    if (!dateFilter.start && !dateFilter.end) return logs
    return logs.filter(log => {
      const logDate = new Date(log.date || log.dateAdded || '')
      if (dateFilter.start && logDate < new Date(dateFilter.start)) return false
      if (dateFilter.end) {
        const endDate = new Date(dateFilter.end)
        endDate.setHours(23, 59, 59, 999)
        if (logDate > endDate) return false
      }
      return true
    })
  }

  const filteredMiningLogs = useMemo(() => 
    filterLogsByDate(miningData?.logs || []), 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [miningData?.logs, dateFilter])
  
  const filteredRattingLogs = useMemo(() => 
    filterLogsByDate(rattingData?.logs || []), 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rattingData?.logs, dateFilter])

  const handleExportCSV = () => {
    const logs = (isMining ? filteredMiningLogs : filteredRattingLogs) as any[]
    if (logs.length === 0) {
      toast.error('No logs available for export')
      return
    }
    
    const headers = miningActivity 
      ? "Date,Character,Ore,Quantity,EstimatedValue\n"
      : "Date,Character,Type,Amount\n"
      
    const rows = logs.map((l) => {
      if (miningActivity) {
        return `${new Date(l.date).toISOString()},${l.charName},${l.oreName},${l.quantity},${l.value}`
      }
      return `${new Date(l.date).toISOString()},${l.charName},${l.type},${l.amount}`
    }).join("\n")
    
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activity.type}_history_${activity.id.slice(0, 8)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleMTUSave = (newMtus: any[]) => {
    setActivity((prev: any) => ({
      ...prev,
      data: {
        ...prev.data,
        mtuSummaries: newMtus,
        estimatedLootValue: newMtus.reduce((sum, m) => sum + (m.value || 0), 0)
      }
    }))
  }

  const handleShareLink = async () => {
    const url = `${window.location.origin}/dashboard/activity?id=${activity.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handlePrintMode = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Failed to open print window')
      return
    }

    const totalRevenue = activity.data?.totalEstimatedValue || 
      activity.data?.totalLootValue || 
      activity.data?.grossBounties || 
      activity.data?.automatedBounties || 0

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${activity.type} - Activity Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          .summary { margin: 20px 0; }
          .meta { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${activity.type} Operation Report</h1>
        <div class="meta">
          <p>REF_ID: ${activity.id}</p>
          <p>Started: ${new Date(activity.startTime).toLocaleString()}</p>
          ${activity.endTime ? `<p>Ended: ${new Date(activity.endTime).toLocaleString()}</p>` : ''}
          ${activity.data?.siteName ? `<p>Site: ${activity.data.siteName}</p>` : ''}
        </div>
        <div class="summary">
          <h2>Summary</h2>
          <p>Total Revenue: ${formatISK(totalRevenue)}</p>
          <p>Participants: ${activity.participants?.length || 0}</p>
        </div>
        <h2>Participants</h2>
        <table>
          <tr><th>Character</th><th>Fitting</th></tr>
          ${(activity.participants || []).map(p => `<tr><td>${p.characterName}</td><td>${p.fitName || p.fit || '-'}</td></tr>`).join('')}
        </table>
      </body>
      </html>
    `
    
    printWindow.document.write(content)
    printWindow.document.close()
    printWindow.print()
  }

  if (!mounted) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="bg-zinc-950/95 border-white/5 lg:max-w-[980px] md:max-w-[94vw] max-h-[84vh] overflow-hidden flex flex-col p-0 gap-0 shadow-2xl backdrop-blur-2xl rounded-[24px]">
        
        {/* Header */}
        <motion.div 
          className="bg-zinc-900/40 border-b border-white/5 p-4 sm:p-5 relative overflow-hidden"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 blur-[120px] pointer-events-none rounded-full" />
          
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 relative z-10">
            <div className="p-0 text-left flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <span className="px-2.5 py-1 text-[9px] uppercase font-black tracking-[0.2em] border border-blue-500/30 text-blue-400 bg-blue-500/10 rounded-md font-outfit shadow-lg shadow-blue-500/5">
                  {activity.type} OPERATION BRIEFING
                </span>
                <div className="h-4 w-[1px] bg-white/10" />
                <span className="text-[10px] font-black font-mono text-zinc-600 uppercase tracking-[0.12em] truncate">
                  REF_ID: {activity.id.slice(0, 12)}
                </span>
              </div>
              
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight flex items-center gap-3 flex-wrap leading-[1.15] font-outfit uppercase">
                <span className="line-clamp-2 break-words max-w-full">{activity.data?.siteName || activity.type}</span>
                {activity.status === 'completed' && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-[9px] uppercase tracking-[0.18em] px-2.5 py-1 font-outfit rounded-md">
                    ARCHIVED
                  </span>
                )}
              </h2>
              
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.08em] mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 font-outfit">
                <span className="text-zinc-600">DEPLOYMENT:</span>
                <span className="text-zinc-300 font-mono tracking-tighter">{new Date(activity.startTime).toLocaleString()}</span>
                {activity.endTime && (
                  <span className="flex items-center gap-2">
                    <span className="text-zinc-600">RETRACTION:</span>
                    <span className="text-zinc-300 font-mono tracking-tighter">{new Date(activity.endTime).toLocaleString()}</span>
                  </span>
                )}
              </div>
</div>
              
              <div className="flex flex-row xl:flex-col items-center xl:items-end justify-between xl:justify-start gap-4 flex-shrink-0">
                <button
                  onClick={handleShareLink}
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-[0.14em] gap-2 rounded-lg transition-all duration-300 font-outfit flex items-center text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  <span className="hidden sm:inline">SHARE</span>
                </button>
                <button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className={`h-8 px-3 text-[9px] font-black uppercase tracking-[0.14em] gap-2 rounded-lg transition-all duration-300 font-outfit flex items-center ${showDateFilter ? 'bg-blue-500 text-white shadow-2xl shadow-blue-500/30 ring-1 ring-white/20' : 'text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="hidden sm:inline">FILTER</span>
                </button>
                <button
                  onClick={handlePrintMode}
                  className="h-8 px-3 text-[9px] font-black uppercase tracking-[0.14em] gap-2 rounded-lg transition-all duration-300 font-outfit flex items-center text-zinc-500 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  <span className="hidden sm:inline">PRINT</span>
                </button>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-[9px] text-zinc-600 font-black tracking-[0.24em] uppercase font-outfit">TOTAL TIME</span>
                  <div className="bg-zinc-950/60 border border-white/10 px-4 py-2 rounded-[12px] shadow-xl backdrop-blur-xl ring-1 ring-white/5 group">
                    <span className="text-xl sm:text-2xl font-black font-mono text-blue-400 tracking-tight tabular-nums group-hover:text-blue-300 transition-colors">{elapsed}</span>
                  </div>
                </div>
              
              <div className="flex bg-black/60 p-1 rounded-[12px] border border-white/10 backdrop-blur-xl shadow-inner">
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`h-8 px-3 text-[9px] font-black uppercase tracking-[0.14em] gap-2 rounded-lg transition-all duration-300 font-outfit flex items-center ${viewMode === 'detailed' ? 'bg-blue-500 text-white shadow-2xl shadow-blue-500/30 ring-1 ring-white/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                  <span className="hidden sm:inline">ANALYTICS</span>
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`h-8 px-3 text-[9px] font-black uppercase tracking-[0.14em] gap-2 rounded-lg transition-all duration-300 font-outfit flex items-center ${viewMode === 'compact' ? 'bg-blue-500 text-white shadow-2xl shadow-blue-500/30 ring-1 ring-white/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  <span className="hidden sm:inline">LOGS</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-5 lg:p-6">
          
          {/* Toolbar */}
          <ActivityToolbar 
            onExportCSV={handleExportCSV}
          />

          {/* Date Filter */}
          <AnimatePresence>
            {showDateFilter && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col sm:flex-row gap-4 p-4 bg-zinc-950/60 border border-white/5 rounded-2xl">
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">FROM DATE</label>
                    <Input
                      type="date"
                      value={dateFilter.start || ''}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value || null }))}
                      className="h-10 bg-zinc-900/60 border-white/10 text-[10px] font-mono"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">TO DATE</label>
                    <Input
                      type="date"
                      value={dateFilter.end || ''}
                      onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value || null }))}
                      className="h-10 bg-zinc-900/60 border-white/10 text-[10px] font-mono"
                    />
                  </div>
                  {(dateFilter.start || dateFilter.end) && (
                    <div className="flex items-end">
                      <button
                        onClick={() => setDateFilter({ start: null, end: null })}
                        className="h-10 px-4 text-zinc-500 hover:text-white transition-colors"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Summary Panels */}
          <div className="space-y-4">
            <div className="relative">
              {isMining ? (
                <MiningSummaryPanel activity={activity} logs={filteredMiningLogs} viewMode={viewMode} />
              ) : rattingActivity ? (
                <RattingSummaryPanel 
                  activity={activity} 
                  logs={filteredRattingLogs} 
                  viewMode={viewMode}
                  onOpenMTU={() => setIsMtuModalOpen(true)}
                />
              ) : isExplorationActivity(activity) ? (
                <ExplorationSummaryPanel 
                  activity={activity} 
                  viewMode={viewMode} 
                />
              ) : isAbyssalActivity(activity) ? (
                <AbyssalSummaryPanel 
                  activity={activity} 
                  viewMode={viewMode} 
                />
              ) : (
                <div className="py-32 text-center opacity-30 flex flex-col items-center gap-6">
                  <svg className="h-16 w-16 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-[11px] font-black uppercase tracking-[0.5em] font-outfit">NO LOG DATA REGISTERED</p>
                </div>
              )}
            </div>
          </div>

          {/* Participants */}
          <ActivityParticipants activity={activity} />
        </div>

        {/* Footer */}
        <ActivityFooter onDismiss={() => onOpenChange?.(false)} />

        {/* Modal Management */}
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

import { MTUManagementModal } from './summary/MTUManagementModal'