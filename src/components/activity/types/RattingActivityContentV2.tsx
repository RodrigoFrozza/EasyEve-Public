'use client'

import { useMemo, useState } from 'react'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ConfirmEndModal, RattingAnalyticsModal, RattingLootHistoryModal } from '../modals'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Banknote, Clock3, Crosshair, Package, Cloud, CloudOff, Loader2 } from 'lucide-react'
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
        .filter((l: any) => ['bounty', 'ess', 'mtu', 'salvage', 'loot'].includes(l.type))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3),
    [logs]
  )

  const metricCardShell = cn(
    'rounded-xl border bg-zinc-900/40 backdrop-blur-sm',
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
                  <Avatar className={cn('h-9 w-9 ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-10', rattingTheme.iconBg, 'ring-green-500/30')}>
                    <AvatarImage src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`} />
                    <AvatarFallback>{participant.characterName?.[0] || 'C'}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{participant.characterName}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/50 border border-zinc-800/50">
              {isSyncing ? (
                <Loader2 className="h-3 w-3 text-emerald-400 animate-spin" />
              ) : syncStatus === 'error' ? (
                <CloudOff className="h-3 w-3 text-red-400" />
              ) : (
                <Cloud className="h-3 w-3 text-emerald-400" />
              )}
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tighter">
                {isSyncing ? 'Syncing' : 'Cloud'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid: Bounty > ESS > Loot > ISK/h */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActivityStatDisplay
          label={t('activity.ratting.bounty')}
          value={automatedBounties + additionalBounties}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Crosshair className={cn('h-3 w-3', rattingTheme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.ratting.ess')}
          value={automatedEss}
          subValue="isk"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Banknote className={cn('h-3 w-3', rattingTheme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.ratting.loot')}
          value={totalLoot}
          subValue={totalItems > 0 ? `${totalItems} items` : undefined}
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Package className={cn('h-3 w-3', rattingTheme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer ring-1 ring-green-500/25 hover:ring-green-400/50 transition-all')}
          onClick={() => setLootListOpen(true)}
        />
        <ActivityStatDisplay
          label={t('activity.ratting.efficiency')}
          value={metrics.iskPerHour}
          subValue="isk/h"
          variant="default"
          size="compact"
          valueClassName="text-white"
          icon={<Clock3 className={cn('h-3 w-3', rattingTheme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer ring-1 ring-green-500/25 hover:ring-green-400/50 transition-all')}
          onClick={() => setAnalyticsOpen(true)}
        />
      </div>
    </div>
  )

  const latestIncomeSection = (
    <div className={cn('rounded-xl border p-3 bg-zinc-950/40', rattingTheme.border)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{t('activity.ratting.latestRewards')}</p>
      </div>
      <div className="space-y-1.5">
        {top3Rewards.length > 0 ? (
          top3Rewards.map((log: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    log.type === 'ess' ? 'bg-amber-400' : log.type === 'loot' ? 'bg-cyan-400' : 'bg-emerald-400'
                  )}
                />
                <p className="text-[10px] text-zinc-300 font-bold truncate tracking-tight uppercase">{log.charName || log.type.toUpperCase()}</p>
              </div>
              <p className={cn('text-[10px] font-mono font-black tracking-tighter', rattingTheme.text)}>{formatISK(log.amount || 0)}</p>
            </div>
          ))
        ) : (
          <div className="py-2 text-center">
            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{t('activity.ratting.noRecentBounties')}</p>
          </div>
        )}
      </div>
    </div>
  )

  const liveTransactions = (
    <div className={cn('rounded-2xl p-4 relative overflow-hidden group/logs bg-zinc-950/40', rattingTheme.border)}>
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className={cn('h-3 w-1 rounded-full bg-emerald-500')} />
        <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.ratting.liveTransactions')}</span>
      </div>
      <div className={cn(
        "overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-1.5",
        displayMode === 'compact' ? 'max-h-[220px]' : 'max-h-[450px]'
      )}>
        {(logs || [])
          .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((log: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center text-[11px] p-2.5 bg-zinc-900/20 border border-white/[0.02] rounded-xl">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-300 font-bold truncate max-w-[120px]">{log.charName || t('common.unknown')}</span>
              </div>
              <div className="text-right shrink-0">
                <span className={cn('font-mono font-black', rattingTheme.text)}>{isMounted ? formatISK(log.amount || 0) : '--- ISK'}</span>
                <div className="text-[8px] text-zinc-600 font-black uppercase mt-0.5">
                  {t(`activity.ratting.${log.type}`)} • <FormattedDate date={log.date} mode="time" />
                </div>
              </div>
            </div>
          ))}
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
      <RattingAnalyticsModal open={analyticsOpen} onOpenChange={setAnalyticsOpen} logs={logs} />
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
