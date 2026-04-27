'use client'

import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  Download, 
  Pause, 
  Play, 
  StopCircle, 
  Loader2, 
  CheckCircle, 
  XCircle,
  Lock
} from 'lucide-react'

import { type ActivityType, getActivityColors } from '@/lib/constants/activity-colors'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn, isPremium } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useSession } from '@/lib/session-client'

interface ActivityCardFooterProps {
  activityType: ActivityType
  mode: 'compact' | 'expanded'
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  onTogglePause: () => void
  isPaused: boolean
  onExport: () => void
  onEnd: () => void
  className?: string
  /** Optional one-line ESI sync hint (ratting). */
  esiMeta?: {
    lastSyncAt?: string
    lastSyncWithChangesAt?: string
    syncCount?: number
  }
}

export function ActivityCardFooter({
  activityType,
  mode,
  onSync,
  isSyncing,
  syncStatus,
  onTogglePause,
  isPaused,
  onExport,
  onEnd,
  className,
  esiMeta,
}: ActivityCardFooterProps) {
  const { data: session } = useSession()
  const hasPremium = isPremium(session?.user?.subscriptionEnd)
  const colors = getActivityColors(activityType)

  const iconButtonClass = mode === 'compact'
    ? "h-10 w-10 p-0 bg-zinc-950/60 border-white/[0.05] hover:bg-cyan-500/10 hover:border-cyan-500/50 text-zinc-400 hover:text-cyan-400 transition-all duration-500 rounded-xl"
    : "h-12 w-12 p-0 bg-zinc-900/40 border border-white/5 hover:bg-zinc-800 hover:border-white/10 text-zinc-500 hover:text-white rounded-xl transition-all duration-300 shadow-sm"

  const pauseButtonClass = cn(
    iconButtonClass,
    isPaused 
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
      : "text-zinc-400 hover:text-cyan-400"
  )

  const endButtonClass = mode === 'compact'
    ? "h-10 w-10 p-0 bg-red-500/5 border-red-500/10 hover:bg-red-500 hover:text-white hover:border-red-500 text-red-500 rounded-xl transition-all"
    : "h-12 w-12 p-0 bg-red-500/5 border-red-500/10 hover:bg-red-500/20 hover:border-red-500/50 text-red-500 rounded-xl transition-all"

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className={cn('flex flex-col gap-1.5 pt-2 border-t border-white/[0.03]', className)}>
        {esiMeta && (
          <div
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[9px] text-zinc-600 font-mono leading-tight"
            title={`Last sync: ${esiMeta.lastSyncAt || 'N/A'} | Last sync with changes: ${esiMeta.lastSyncWithChangesAt || 'N/A'} | Sync count: ${esiMeta.syncCount ?? 0}`}
          >
            <span className="font-bold uppercase tracking-wider text-zinc-500">ESI</span>
            <span>
              {esiMeta.lastSyncAt ? <FormattedDate date={esiMeta.lastSyncAt} mode="time" /> : '—'}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="uppercase tracking-tight text-zinc-500">
              chg{' '}
              {esiMeta.lastSyncWithChangesAt ? (
                <FormattedDate date={esiMeta.lastSyncWithChangesAt} mode="time" />
              ) : (
                'N/A'
              )}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
        {/* 1. Sync Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              size="sm"
              variant="ghost"
              disabled={isSyncing}
              onClick={onSync}
              className={`${iconButtonClass} ${isSyncing ? "animate-pulse border-cyan-500/50 bg-cyan-500/5" : ""}`}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {syncStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {syncStatus === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                  {syncStatus === 'idle' && <RefreshCw className={`h-4 w-4 ${colors.text}`} />}
                </>
              )}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content 
              className="bg-black/90 border border-zinc-800 px-3 py-2 rounded-lg text-[10px] text-white z-[100] backdrop-blur-md animate-in fade-in zoom-in duration-200"
              sideOffset={5}
            >
              {isSyncing ? 'Syncing...' : 'Sync'}
              <Tooltip.Arrow className="fill-black/90" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 2. Export Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={hasPremium ? onExport : undefined}
              className={cn(
                iconButtonClass,
                !hasPremium && "cursor-not-allowed opacity-80"
              )}
              disabled={!hasPremium}
            >
              {hasPremium ? (
                <Download className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4 text-amber-500 fill-amber-500/10" />
              )}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              className="z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
              sideOffset={5}
            >
              {hasPremium ? "Export activity data to CSV" : "Export activity (Premium Only)"}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 3. Pause/Resume Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={onTogglePause}
              className={pauseButtonClass}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content 
              className="bg-black/90 border border-zinc-800 px-3 py-2 rounded-lg text-[10px] text-white z-[100] backdrop-blur-md animate-in fade-in zoom-in duration-200"
              sideOffset={5}
            >
              {isPaused ? 'Resume' : 'Pause'}
              <Tooltip.Arrow className="fill-black/90" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 4. End Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={onEnd}
              className={endButtonClass}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content 
              className="bg-black/90 border border-zinc-800 px-3 py-2 rounded-lg text-[10px] text-white z-[100] backdrop-blur-md animate-in fade-in zoom-in duration-200"
              sideOffset={5}
            >
              Finish Activity
              <Tooltip.Arrow className="fill-black/90" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        </div>
      </div>
    </Tooltip.Provider>
  )
}