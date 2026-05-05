'use client'

import { useMemo, useState } from 'react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK, formatCurrencyValue } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ConfirmEndModal, RattingAnalyticsModal, RattingLootHistoryModal } from '../modals'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, Clock3, Crosshair, Package } from 'lucide-react'
import { useActivityMetrics } from '@/lib/hooks/use-activity-metrics'
import { getActivityColors } from '@/lib/constants/activity-colors'

interface RattingActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

export function RattingActivityContentV2({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: RattingActivityContentProps) {
  const { t } = useTranslations()
  const [lootListOpen, setLootListOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const { metrics, isMounted } = useActivityMetrics(activity)
  const rattingTheme = useMemo(() => getActivityColors('ratting'), [])

  const typeColorMap: Record<string, string> = {
    bounty: 'text-emerald-500',
    loot: 'text-blue-500',  // includes salvage and mtu
    ess: 'text-yellow-500',
  }

  const logs = useMemo(() => (activity.data as any)?.logs || [], [activity.data])
  const automatedBounties = activity.data?.automatedBounties || 0
  const additionalBounties = activity.data?.additionalBounties || 0
  const automatedEss = activity.data?.automatedEss || 0
  const totalLoot = (activity.data?.estimatedLootValue || 0) + (activity.data?.estimatedSalvageValue || 0)
  const totalItems = (activity.data?.mtuContents?.length || 0) + (activity.data?.salvageContents?.length || 0)
  const lastSyncAt = (activity.data as any)?.lastSyncAt as string | undefined
  const lastSyncWithChangesAt = (activity.data as any)?.lastSyncWithChangesAt as string | undefined
  const syncCount = (activity.data as any)?.syncCount || 0
  const top3Rewards = useMemo(
    () =>
      [...logs]
        .filter((l: any) => ['bounty', 'ess', 'loot', 'salvage', 'mtu'].includes(l.type))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3),
    [logs]
  )

  const metricCardShell = cn(
    'rounded-xl border bg-zinc-900/40 backdrop-blur-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] transition-shadow duration-300',
    rattingTheme.border
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
                  <Avatar className={cn('h-9 w-9 ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-10', rattingTheme.iconBg, 'ring-red-500/30')}>
                    <AvatarImage src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`} />
                    <AvatarFallback>{participant.characterName?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{participant.characterName}</TooltipContent>
              </Tooltip>
            ))}
          </div>

           <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
         </div>
       </div>

      {/* Metrics Grid: Bounty > ESS > Loot > ISK/h */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActivityStatDisplay
          label={t('activity.ratting.bounty')}
          value={formatCurrencyValue(automatedBounties + additionalBounties)}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Crosshair className={cn('h-3 w-3', rattingTheme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.ratting.ess')}
          value={formatCurrencyValue(automatedEss)}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Banknote className={cn('h-3 w-3', rattingTheme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.ratting.loot')}
          value={formatCurrencyValue(totalLoot)}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Package className={cn('h-3 w-3', rattingTheme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer ring-1 ring-red-500/25 hover:ring-red-400/50 transition-all')}
          onClick={() => setLootListOpen(true)}
        />
         <ActivityStatDisplay
           label={t('activity.ratting.efficiency')}
           value={formatCurrencyValue(metrics.iskPerHour)}
           subValue="isk/h"
           variant="default"
           size="compact"
           valueClassName="text-white"
           icon={<Clock3 className={cn('h-3 w-3', rattingTheme.text)} />}
           className={cn(metricCardShell, 'cursor-pointer ring-1 ring-red-500/25 hover:ring-red-400/50 transition-all')}
          onClick={() => setAnalyticsOpen(true)}
        />
      </div>
    </div>
  )

  const latestIncomeSection = (
    <div className={cn('rounded-xl border p-3 bg-red-950/20 relative overflow-hidden', rattingTheme.border)}>
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{t('activity.ratting.latestRewards')}</p>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-1.5">
        {top3Rewards.length > 0 ? (
          top3Rewards.map((log: any, idx: number) => {
            const typeColor = typeColorMap[log.type] || 'text-emerald-500'
            return (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-5 w-5 shrink-0 rounded">
                     <AvatarImage src={
                       log.type === 'mtu' || log.type === 'loot'
                         ? 'https://images.evetech.net/types/33475/icon?size=32'
                         : `https://images.evetech.net/characters/${log.charId || 0}/portrait?size=32`
                     } />
                     <AvatarFallback className="text-[6px] bg-zinc-800">
                       {log.charName?.[0] || '?'}
                     </AvatarFallback>
                   </Avatar>
                  <span className={cn("h-1.5 w-1.5 rounded-full", typeColorMap[log.type] || 'bg-emerald-500')} />
                  <p className="text-[10px] text-zinc-300 font-bold truncate">{log.charName || 'Unknown'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-[8px] uppercase font-black", typeColor)}>{log.type === 'salvage' || log.type === 'mtu' ? 'loot' : log.type}</span>
                  <span className={cn('font-mono font-black text-[10px]', typeColor)}>{formatISK(log.amount || 0)}</span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="py-2 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.ratting.noRecentBounties')}</p>
          </div>
        )}
      </div>
    </div>
  )

  const liveTransactions = (
    <div className={cn('rounded-2xl p-4 relative overflow-hidden group/logs bg-red-950/20 border-l-2', rattingTheme.border)}>
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className={cn('h-3 w-1 rounded-full bg-red-500')} />
        <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.ratting.liveTransactions')}</span>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-1.5">
        {(logs || [])
          .filter((l: any) => ['bounty', 'ess', 'loot', 'salvage', 'mtu'].includes(l.type))
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((log: any, idx: number) => {
            const typeColor = typeColorMap[log.type] || 'text-emerald-500'
            
            return (
              <div key={idx} className="flex items-center justify-between gap-2 text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-5 w-5 shrink-0 rounded">
                     <AvatarImage src={
                       log.type === 'mtu' || log.type === 'loot'
                         ? 'https://images.evetech.net/types/28748/icon?size=32'
                         : `https://images.evetech.net/characters/${log.charId || log.charId || 0}/portrait?size=32`
                     } />
                     <AvatarFallback className="text-[6px] bg-zinc-800">
                       {log.charName?.[0] || '?'}
                     </AvatarFallback>
                   </Avatar>
                  <span className={cn("h-1.5 w-1.5 rounded-full", typeColorMap[log.type] || 'bg-emerald-500')} />
                  <span className="text-zinc-300 font-bold truncate">{log.charName || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-[8px] uppercase font-black", typeColor)}>{log.type === 'salvage' || log.type === 'mtu' ? 'loot' : log.type}</span>
                  <span className={cn('font-mono font-black text-[10px]', typeColor)}>{isMounted ? formatISK(log.amount || 0) : '--- ISK'}</span>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )

  if (!isMounted) return null

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {statsGrid}
      {displayMode === 'compact' ? latestIncomeSection : liveTransactions}

      <ActivityCardFooter
        activityType="ratting"
        mode={displayMode === 'compact' ? 'compact' : 'expanded'}
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onExport={() => {}}
        onEnd={() => setConfirmEndOpen(true)}
        esiMeta={{
          lastSyncAt,
          lastSyncWithChangesAt,
          syncCount,
        }}
      />

      <RattingLootHistoryModal open={lootListOpen} onOpenChange={setLootListOpen} activity={activity} onRefresh={onSync} />
      <RattingAnalyticsModal open={analyticsOpen} onOpenChange={setAnalyticsOpen} logs={logs} activity={activity} />
      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={() => {
          setConfirmEndOpen(false)
          onEnd?.()
        }}
      />
    </div>
  )
}
