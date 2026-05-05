'use client'

import { useState, useMemo, useEffect } from 'react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardActions } from '../shared/ActivityCardActions'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { AddExplorationLootModal, ConfirmEndModal, SiteSafetyModal, ExplorationAnalyticsModal, ExplorationLogDetailsModal } from '../modals'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useActivityStore } from '@/lib/stores/activity-store'
import { cn, formatISK, formatNumber, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity as ActivityIcon, 
  Trash2, 
  Shield,
  Plus,
  Compass,
  Package,
  Clock3,
  MapPin
} from 'lucide-react'
import { Sparkline } from '@/components/ui/Sparkline'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'

interface ExplorationActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'tabs' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

export function ExplorationActivityContent({ 
  activity, 
  onSync, 
  isSyncing, 
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause
}: ExplorationActivityContentProps) {
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [safetyModalOpen, setSafetyModalOpen] = useState(false)
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false)
  const [logDetailsOpen, setLogDetailsOpen] = useState(false)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const [localIsSyncing, setLocalIsSyncing] = useState(false)
  const { t } = useTranslations()
  const { metrics, isMounted } = useActivityMetrics(activity)

  const colors = getActivityColors('exploration')

  const lootContents = useMemo(() => activity.data?.lootContents || [], [activity.data])
  const logs = useMemo(() => activity.data?.logs || [], [activity.data])
  const incomeHistory = useMemo(() => activity.data?.incomeHistory || [], [activity.data])
  const iskTrend = activity.data?.iskTrend || 'stable'
  
  const TrendIcon = iskTrend === 'up' ? TrendingUp : iskTrend === 'down' ? TrendingDown : ActivityIcon
  const trendColor = iskTrend === 'up' ? 'text-green-400' : iskTrend === 'down' ? 'text-red-400' : 'text-zinc-500'

  const handleLootChange = async (newLoot: any[]) => {
    const { getMarketAppraisal } = await import('@/lib/market')
    const itemNames = newLoot.map(i => i.name)
    const prices = await getMarketAppraisal(itemNames)
    
    let totalValue = 0
    const itemsWithPrices = newLoot.map(item => {
      const price = prices[item.name.toLowerCase()] || 0
      const total = price * item.quantity
      totalValue += total
      return { ...item, value: total }
    })

    const timestamp = new Date().toISOString()
    const newLog = {
      refId: `loot-${Date.now()}`,
      date: timestamp,
      amount: totalValue,
      type: 'loot',
      charName: 'Exploration Loot',
      charId: 0
    }

    const updatedData = { 
      ...activity.data, 
      lootContents: itemsWithPrices,
      totalLootValue: totalValue,
      logs: [newLog, ...(logs || [])]
    }

    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    setLocalIsSyncing(true)
    fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updatedData })
    }).finally(() => {
      setLocalIsSyncing(false)
    }).catch(err => console.error('Failed to persist loot:', err))
  }

  const handleOpenLogDetails = (log: any) => {
    setSelectedLog(log)
    setLogDetailsOpen(true)
  }

  const handleDeleteLog = async (refId: string) => {
    const updatedLogs = logs.filter((log: any) => log.refId !== refId)
    
    // Recalculate total loot value
    const totalValue = updatedLogs
      .filter((l: any) => l.type === 'site' || l.type === 'loot')
      .reduce((sum: number, log: any) => sum + (log.amount || log.value || 0), 0)

    const updatedData = {
      ...activity.data,
      logs: updatedLogs,
      totalLootValue: totalValue
    }

    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    setLocalIsSyncing(true)
    try {
      await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData })
      })
      toast.success('Discovery removed')
    } catch (err) {
      console.error('Failed to delete log:', err)
      toast.error('Failed to sync deletion')
    } finally {
      setLocalIsSyncing(false)
    }
  }

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false)
    onEnd?.()
  }

  const handleExport = () => {
    if ((logs || []).length === 0) return

    const headers = ['Date', 'Type', 'Amount (ISK)']
    const csvRows = [headers.join(',')]

    logs.forEach((log: any) => {
      const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
      const type = log.type || 'Loot'
      const amount = Math.round(log.amount || 0)
      csvRows.push(`${dateStr},${type},${amount}`)
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `exploration_export_${activity.id}_${new Date().getTime()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const top3Rewards = useMemo(() => {
    const validLogs = (logs || []).filter((l: any) => l.type === 'site' || l.type === 'loot')
    return validLogs
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA)
      })
      .slice(0, 3)
  }, [logs])

  const latestLootSection = (
    <div className="bg-zinc-950/40 border border-white/[0.03] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
           <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{t('activity.exploration.latestDiscoveries')}</p>
         </div>
        <TrendingUp className={cn("h-3 w-3", trendColor)} />
      </div>
      <div className="space-y-1.5">
        {top3Rewards.length > 0 ? top3Rewards.map((log: any, idx: number) => (
          <div 
            key={idx} 
            className="flex items-center justify-between cursor-pointer hover:bg-white/[0.02] p-1 rounded transition-colors group"
            onClick={() => handleOpenLogDetails(log)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                log.type === 'site' ? "bg-cyan-500" : "bg-emerald-500"
              )} />
              <p className="text-[10px] text-zinc-300 font-bold truncate tracking-tight uppercase">
                {log.siteName || log.charName || 'Discovery Value'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono font-black tracking-tighter text-cyan-400">
                {formatCurrencyValue(log.amount || log.value || 0)}
              </p>
            </div>
          </div>
        )) : (
          <div className="py-2 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">No Loot Registered Yet</p>
          </div>
        )}
      </div>
    </div>
  )

  const metricCardShell = cn(
    'rounded-xl border bg-zinc-900/40 backdrop-blur-sm',
    colors.border
  )

  const statsGrid = (
    <div className="space-y-4">
      {/* Top Row: Avatars and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
            {(activity.participants || []).map((participant: any) => (
              <Tooltip key={participant.characterId}>
                <TooltipTrigger asChild>
                  <Avatar className={cn('h-9 w-9 ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-10', colors.iconBg, 'ring-cyan-500/30')}>
                    <AvatarImage src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`} />
                    <AvatarFallback>{participant.characterName?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{participant.characterName}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/40"
                onClick={() => setSafetyModalOpen(true)}
              >
                <Shield className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check Site Safety</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7 rounded-lg border-cyan-500/20 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/40"
                onClick={() => setLootModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('activity.exploration.addSiteLoot')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Metrics Grid: Location > Items > Total ISK > ISK/h */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActivityStatDisplay
          label={t('activity.exploration.actualLocation')}
          value={activity.data?.currentSystem || activity.region || 'Unknown Location'}
          subValue={activity.data?.currentSpaceType || activity.space || 'Exploring'}
          variant="warning"
          size="compact"
          valueClassName="text-amber-300"
          icon={<MapPin className={cn("h-3 w-3", colors.text)} />}
          className={metricCardShell}
        />

        <ActivityStatDisplay
          label={t('activity.exploration.itemsFound')}
          value={(logs || []).filter((l: any) => l.type === 'site' || l.type === 'loot').length}
          subValue={t('activity.exploration.totalItems')}
          variant="default"
          size="compact"
          valueClassName="text-white"
          formatAsNumber
          icon={<Package className={cn("h-3 w-3", colors.text)} />}
          className={metricCardShell}
        />

        <ActivityStatDisplay
          label={t('activity.exploration.lootValue')}
          value={activity.data?.totalLootValue || 0}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          formatAsCompactISK
          icon={<TrendingUp className={cn("h-3 w-3", colors.text)} />}
          className={metricCardShell}
        />

        <ActivityStatDisplay
          label={t('activity.exploration.efficiency')}
          value={metrics.iskPerHour}
          subValue="isk/h"
          variant="default"
          size="compact"
          valueClassName="text-white"
          formatAsCompactISK
          icon={<Clock3 className={cn("h-3 w-3", colors.text)} />}
          className={cn(metricCardShell, 'cursor-pointer ring-1 ring-cyan-500/25 hover:ring-cyan-400/50 transition-all')}
          onClick={() => setAnalyticsModalOpen(true)}
        />
      </div>
    </div>
  )

  const expandedStats = (
    <div className="grid grid-cols-1 gap-4">
      <div className="bg-zinc-950/40 border border-white/[0.03] rounded-2xl p-4 relative overflow-hidden group/logs">
        <div className="absolute inset-0 bg-cyan-500/[0.01] opacity-0 group-hover/logs:opacity-100 transition-opacity" />
        <div className="flex items-center gap-2 mb-3 relative z-10">
          <div className="h-3 w-1 bg-cyan-500 rounded-full" />
          <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">Discovery History</span>
        </div>
        <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
          {(logs || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15).map((log: any, idx: number) => (
            <div 
              key={idx} 
              className="flex justify-between items-center text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-xl hover:bg-zinc-900/40 transition-colors group/item cursor-pointer"
              onClick={() => handleOpenLogDetails(log)}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", log.type === 'site' ? 'bg-cyan-500' : 'bg-emerald-500')} />
                <div className="flex flex-col">
                  <span className="text-zinc-300 font-bold truncate max-w-[120px]">{log.siteName || log.charName || 'Discovery Value'}</span>
                  <div className="text-[8px] text-zinc-600 font-black uppercase mt-0.5">
                    {log.spaceType && `${log.spaceType} • `}<FormattedDate date={log.date} mode="time" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="font-mono font-black text-cyan-400">
                    {isMounted ? '+' : ''}{isMounted ? formatISK(log.amount || log.value || 0) : '--- ISK'}
                  </span>
                </div>
                <button 
                  onClick={() => handleDeleteLog(log.refId)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          {(logs || []).length === 0 && (
            <div className="py-12 text-center text-zinc-600 uppercase font-black text-[10px] tracking-widest">
              No discoveries logged in this session
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (!isMounted) return null

  if (displayMode === 'compact') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {statsGrid}
        
        {latestLootSection}

        <ActivityCardFooter
          activityType="exploration"
          mode="compact"
          onSync={onSync}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onTogglePause={onTogglePause!}
          isPaused={isPaused!}
          onExport={handleExport}
          onEnd={() => setConfirmEndOpen(true)}
        />

        <AddExplorationLootModal
          open={lootModalOpen}
          onOpenChange={setLootModalOpen}
          activity={activity}
        />

        <ConfirmEndModal
          open={confirmEndOpen}
          onOpenChange={setConfirmEndOpen}
          onConfirm={handleConfirmEnd}
        />

        <SiteSafetyModal
          open={safetyModalOpen}
          onOpenChange={setSafetyModalOpen}
        />

        <ExplorationAnalyticsModal
          open={analyticsModalOpen}
          onOpenChange={setAnalyticsModalOpen}
          logs={logs}
          activity={activity}
        />

        <ExplorationLogDetailsModal
          open={logDetailsOpen}
          onOpenChange={setLogDetailsOpen}
          log={selectedLog}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {statsGrid}

      {displayMode === 'expanded' && expandedStats}
      {displayMode !== 'expanded' && latestLootSection}

      <ActivityCardFooter
        activityType="exploration"
        mode="expanded"
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onExport={handleExport}
        onEnd={() => setConfirmEndOpen(true)}
      />

      <AddExplorationLootModal
        open={lootModalOpen}
        onOpenChange={setLootModalOpen}
        activity={activity}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleConfirmEnd}
      />

      <SiteSafetyModal
        open={safetyModalOpen}
        onOpenChange={setSafetyModalOpen}
      />

      <ExplorationAnalyticsModal
        open={analyticsModalOpen}
        onOpenChange={setAnalyticsModalOpen}
        logs={logs}
        activity={activity}
      />

      <ExplorationLogDetailsModal
        open={logDetailsOpen}
        onOpenChange={setLogDetailsOpen}
        log={selectedLog}
      />
    </div>
  )
}