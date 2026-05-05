'use client'

import { useState, useMemo, useEffect } from 'react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { useTranslations } from '@/i18n/hooks'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { calculateNetProfit } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity as ActivityIcon, Package } from 'lucide-react'
import { useActivityStore } from '@/lib/stores/activity-store'
import { cn, formatISK } from '@/lib/utils'
import { Sparkline } from '@/components/ui/Sparkline'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardActions } from '../shared/ActivityCardActions'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { MTUInputModal, SalvageInputModal, ConfirmEndModal, LootListModal } from '../modals'

interface RattingActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  essCountdown?: string
  displayMode?: 'compact' | 'tabs' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

export function RattingActivityContent({ 
  activity, 
  onSync, 
  isSyncing, 
  syncStatus,
  essCountdown,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause
}: RattingActivityContentProps) {
  const { t } = useTranslations()
  const [lootListOpen, setLootListOpen] = useState(false)
  const [mtuModalOpen, setMtuModalOpen] = useState(false)
  const [salvageModalOpen, setSalvageModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const { metrics, isMounted } = useActivityMetrics(activity)

  const automatedBounties = activity.data?.automatedBounties || 0
  const automatedEss = activity.data?.automatedEss || 0
  const additionalBounties = activity.data?.additionalBounties || 0

  const totalIsk = calculateNetProfit(activity.data)
  const logs = useMemo(() => (activity.data as any)?.logs || [], [activity.data])
  const incomeHistory = useMemo(() => (activity.data as any)?.incomeHistory || [], [activity.data])
  const mtuContents = useMemo(() => activity.data?.mtuContents || [], [activity.data])
  const salvageContents = useMemo(() => activity.data?.salvageContents || [], [activity.data])
  const iskTrend = (activity.data as any)?.iskTrend || 'stable'
  
  const TrendIcon = iskTrend === 'up' ? TrendingUp : iskTrend === 'down' ? TrendingDown : ActivityIcon
  const trendColor = iskTrend === 'up' ? 'text-green-400' : iskTrend === 'down' ? 'text-red-400' : 'text-zinc-500'

  const handleMTUChange = async (newMTUs: any[]) => {
    if (newMTUs.length === 0) return

    const { getMarketAppraisal } = await import('@/lib/market')
    const itemNames = newMTUs.map(i => i.name)
    const prices = await getMarketAppraisal(itemNames)
    
    let totalValue = 0
    const itemsWithPrices = newMTUs.map(item => {
      const price = prices[item.name.toLowerCase()] || 0
      const total = price * item.quantity
      totalValue += total
      return { ...item, value: total }
    })

    const timestamp = new Date().toISOString()
    const newLog = {
      refId: `mtu-${Date.now()}`,
      date: timestamp,
      amount: totalValue,
      type: 'mtu',
      charName: t('activity.ratting.mtuRegistration'),
      charId: 0
    }

    const currentMtuContents = activity.data?.mtuContents || []
    const newMtuContents = [...currentMtuContents, itemsWithPrices]

    const allMtuLogs = logs.filter((l: any) => l.type === 'mtu')
    const newEstimatedLootValue = [...allMtuLogs, newLog].reduce((sum, l) => sum + (l.amount || 0), 0)

    const updatedData = { 
      ...activity.data, 
      mtuContents: newMtuContents,
      estimatedLootValue: newEstimatedLootValue,
      logs: [newLog, ...logs]
    }

    // Update store
    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    // Persist to API
    fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updatedData })
    }).catch(err => console.error('Failed to persist MTU log:', err))
  }

  const handleSalvageChange = async (newSalvage: any[]) => {
    if (newSalvage.length === 0) return

    const { getMarketAppraisal } = await import('@/lib/market')
    const itemNames = newSalvage.map(i => i.name)
    const prices = await getMarketAppraisal(itemNames)
    
    let totalValue = 0
    const itemsWithPrices = newSalvage.map(item => {
      const price = prices[item.name.toLowerCase()] || 0
      const total = price * item.quantity
      totalValue += total
      return { ...item, value: total }
    })

    const timestamp = new Date().toISOString()
    const newLog = {
      refId: `salvage-${Date.now()}`,
      date: timestamp,
      dateFormatted: timestamp,
      amount: totalValue,
      type: 'salvage',
      charName: t('activity.ratting.salvageCollection'),
      charId: 0
    }

    const currentSalvageContents = activity.data?.salvageContents || []
    const newSalvageContents = [...currentSalvageContents, itemsWithPrices]

    const allSalvageLogs = logs.filter((l: any) => l.type === 'salvage')
    const newEstimatedSalvageValue = [...allSalvageLogs, newLog].reduce((sum, l) => sum + (l.amount || 0), 0)

    const updatedData = { 
      ...activity.data, 
      salvageContents: newSalvageContents,
      estimatedSalvageValue: newEstimatedSalvageValue,
      logs: [newLog, ...logs]
    }

    // Update store
    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

    // Persist to API
    fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updatedData })
    }).catch(err => console.error('Failed to persist Salvage log:', err))
  }

  const handleConfirmEnd = () => {
    setConfirmEndOpen(false)
    onEnd?.()
  }

  const handleExport = () => {
    if (logs.length === 0) return

    const headers = [
      t('common.date') || 'Date', 
      t('common.character') || 'Character', 
      t('common.type') || 'Type', 
      t('common.amount') || 'Amount (ISK)'
    ]
    const csvRows = [headers.join(',')]

    logs.forEach((log: any) => {
      const dateStr = new Date(log.date).toISOString().replace(/T/, ' ').replace(/\..+/, '')
      const char = log.charName || t('common.unknown') || 'Unknown'
      const type = log.type || t('common.entry') || 'Entry'
      const amount = Math.round(log.amount || 0)
      csvRows.push(`${dateStr},${char},${type},${amount}`)
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ratting_export_${activity.id}_${new Date().getTime()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const top3Rewards = useMemo(() => {
    return (logs || []).filter((l: any) => ['bounty', 'ess', 'mtu'].includes(l.type))
      .sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA)
      })
      .slice(0, 3)
  }, [logs])

  const latestIncomeSection = (
    <div className="bg-zinc-950/40 border border-white/[0.03] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{t('activity.ratting.latestRewards')}</p>
        <TrendingUp className={cn("h-3 w-3", trendColor)} />
      </div>
      <div className="space-y-1.5">
        {top3Rewards.length > 0 ? top3Rewards.map((log: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                log.type === 'ess' ? "bg-yellow-500" : 
                log.type === 'mtu' ? "bg-blue-500" : 
                log.type === 'salvage' ? "bg-orange-500" : "bg-green-500"
              )} />
              <p className="text-[10px] text-zinc-300 font-bold truncate tracking-tight uppercase">
                {log.charName || (log.type === 'bounty' ? t('activity.ratting.bountyPayment') : log.type.toUpperCase())}
              </p>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-[10px] font-mono font-black tracking-tighter",
                log.type === 'ess' ? "text-yellow-400" : 
                log.type === 'mtu' ? "text-blue-400" : 
                log.type === 'salvage' ? "text-orange-400" : "text-emerald-400"
              )}>
                {formatISK(log.amount || 0)}
              </p>
            </div>
          </div>
        )) : (
          <div className="py-2 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.ratting.noRecentBounties')}</p>
          </div>
        )}
      </div>
    </div>
  )


  const statsGrid = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <ActivityStatDisplay
        label={t('activity.ratting.bounty')}
        value={automatedBounties + additionalBounties}
        variant="success"
      />

      <ActivityStatDisplay
        label={t('activity.ratting.ess')}
        value={automatedEss}
        subValue={essCountdown}
        variant="warning"
      />

      <ActivityStatDisplay
        label={t('activity.ratting.loot')}
        value={(activity.data?.estimatedLootValue || 0) + (activity.data?.estimatedSalvageValue || 0)}
        subValue={mtuContents.length + salvageContents.length > 0 ? `${mtuContents.length + salvageContents.length} items` : undefined}
        variant="accent"
        icon={<Package className="h-3 w-3" />}
        className="cursor-pointer"
        onClick={() => setLootListOpen(true)}
      />

      <ActivityStatDisplay
        label={t('activity.ratting.efficiency')}
        value={metrics.iskPerHour}
        variant="accent"
      />
    </div>
  )

  const expandedStats = (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ActivityStatDisplay
          label={t('activity.ratting.bounty')}
          value={automatedBounties}
          subValue={additionalBounties > 0 ? `+${formatISK(additionalBounties)} ${t('activity.ratting.registered')}` : undefined}
          variant="success"
        />

        <ActivityStatDisplay
          label={t('activity.ratting.ess')}
          value={automatedEss}
          subValue={essCountdown}
          variant="warning"
        />

        <ActivityStatDisplay
          label={t('activity.ratting.loot')}
          value={(activity.data?.estimatedLootValue || 0) + (activity.data?.estimatedSalvageValue || 0)}
          subValue={mtuContents.length + salvageContents.length > 0 ? `${mtuContents.length + salvageContents.length} items` : undefined}
          variant="accent"
          icon={<Package className="h-3 w-3" />}
          className="cursor-pointer"
          onClick={() => setLootListOpen(true)}
        />

        <ActivityStatDisplay
          label={t('activity.ratting.efficiency')}
          value={metrics.iskPerHour}
          variant="accent"
        >
          <div className="mt-2 h-6 relative z-10" suppressHydrationWarning>
            {isMounted ? (
              <Sparkline 
                data={incomeHistory.map((v: number, i: number, a: number[]) => i === 0 ? v : Math.max(0, v - a[i-1])).slice(-10)} 
                width={100} 
                height={24} 
                color={metrics.trend === 'up' ? "#22c55e" : metrics.trend === 'down' ? "#ef4444" : "#00d4ff"} 
                strokeWidth={2}
              />
            ) : (
              <div className="h-6 w-[100px] bg-zinc-900/50 rounded animate-pulse" />
            )}
          </div>
        </ActivityStatDisplay>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-zinc-950/40 border border-white/[0.03] rounded-2xl p-4 relative overflow-hidden group/logs">
          <div className="absolute inset-0 bg-green-500/[0.01] opacity-0 group-hover/logs:opacity-100 transition-opacity" />
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <div className="h-3 w-1 bg-green-500 rounded-full" />
            <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.ratting.liveTransactions')}</span>
          </div>
          <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
            {(logs || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 15).map((log: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-xl hover:bg-zinc-900/40 transition-colors group/item">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full", 
                    log.type === 'ess' ? "bg-yellow-500" : 
                    log.type === 'mtu' ? "bg-blue-500" : 
                    log.type === 'salvage' ? "bg-orange-500" : "bg-green-500"
                  )} />
                  <span className="text-zinc-300 font-bold truncate max-w-[120px]">{log.charName || t('common.unknown')}</span>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "font-mono font-black", 
                    log.type === 'bounty' || log.type === 'ess' || log.type === 'mtu' || log.type === 'salvage' ? "text-emerald-400" : "text-zinc-400"
                  )} suppressHydrationWarning>
                    {isMounted ? '+' : ''}{isMounted ? formatISK(log.amount || 0) : '--- ISK'}
                  </span>
                  <div className="text-[8px] text-zinc-600 font-black uppercase mt-0.5">
                    {t(`activity.ratting.${log.type}`)} • <FormattedDate date={log.date} mode="time" />
                  </div>
                </div>
              </div>
            ))}
            {(logs || []).length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.ratting.noRecentTransactions')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )

  if (!isMounted) return null

  if (displayMode === 'compact') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {statsGrid}
        
        <ActivityCardActions
          activityType="ratting"
          mode="compact"
          onOpenLootModal={() => setLootListOpen(true)}
          onOpenSalvageModal={() => setSalvageModalOpen(true)}
        />

        {latestIncomeSection}

        <ActivityCardFooter
          activityType="ratting"
          mode="compact"
          onSync={onSync}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onTogglePause={onTogglePause!}
          isPaused={isPaused!}
          onExport={handleExport}
          onEnd={() => setConfirmEndOpen(true)}
        />

        <MTUInputModal
          open={mtuModalOpen}
          onOpenChange={setMtuModalOpen}
          onSave={handleMTUChange}
          existingItems={[]}
        />
        
        <SalvageInputModal
          open={salvageModalOpen}
          onOpenChange={setSalvageModalOpen}
          onSave={handleSalvageChange}
          existingItems={[]}
        />

        <LootListModal
          open={lootListOpen}
          onOpenChange={setLootListOpen}
          activity={activity}
          onRefresh={onSync}
        />

        <ConfirmEndModal
          open={confirmEndOpen}
          onOpenChange={setConfirmEndOpen}
          onConfirm={handleConfirmEnd}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ActivityCardActions
        activityType="ratting"
        mode="expanded"
        onOpenLootModal={() => setLootListOpen(true)}
        onOpenSalvageModal={() => setSalvageModalOpen(true)}
      />

      {expandedStats}

      <ActivityCardFooter
        activityType="ratting"
        mode="expanded"
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onExport={handleExport}
        onEnd={() => setConfirmEndOpen(true)}
      />

      <MTUInputModal
        open={mtuModalOpen}
        onOpenChange={setMtuModalOpen}
        onSave={handleMTUChange}
        existingItems={[]}
      />
      
      <SalvageInputModal
        open={salvageModalOpen}
        onOpenChange={setSalvageModalOpen}
        onSave={handleSalvageChange}
        existingItems={[]}
      />

      <LootListModal
        open={lootListOpen}
        onOpenChange={setLootListOpen}
        activity={activity}
        onRefresh={onSync}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={handleConfirmEnd}
      />
    </div>
  )
}
