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
import { getActivityTheme } from '@/lib/activity/activity-theme'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn, isPremium } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useSession } from '@/lib/session-client'
import { useTranslations } from '@/i18n/hooks'

interface RattingSyncError {
  characterId: number
  characterName: string
  error: string
  /** 'auth' → character needs to re-authenticate (missing token/scope). */
  reason?: 'auth' | 'transient'
}

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
    syncErrors?: RattingSyncError[]
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
  const { t } = useTranslations()
  const hasPremium = isPremium(session?.user?.subscriptionEnd)
  const colors = getActivityColors(activityType)
  const theme = getActivityTheme(activityType)

  const syncErrors = esiMeta?.syncErrors ?? []
  const hasSyncErrors = syncErrors.length > 0
  const syncRanWithoutChanges =
    Boolean(esiMeta?.lastSyncAt) &&
    !hasSyncErrors &&
    !esiMeta?.lastSyncWithChangesAt

  const themedFooterHover =
    activityType === 'mining'
      ? 'hover:border-cyan-400/35 hover:bg-cyan-400/12 hover:text-cyan-200'
      : activityType === 'exploration'
        ? 'hover:border-orange-400/35 hover:bg-orange-500/10 hover:text-orange-200'
        : activityType === 'ratting'
          ? 'hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-300'
          : activityType === 'abyssal'
            ? 'hover:border-purple-400/35 hover:bg-purple-500/10 hover:text-purple-200'
            : activityType === 'salvaging'
              ? 'hover:border-lime-400/35 hover:bg-lime-500/10 hover:text-lime-200'
              : 'hover:border-white/15 hover:bg-white/[0.06] hover:text-zinc-200'

  const iconButtonClass = cn(
    'rounded-lg border border-white/[0.08] bg-black/25 text-zinc-400 backdrop-blur-sm transition-all',
    themedFooterHover,
    mode === 'compact' ? 'h-9 w-9 p-0' : 'h-10 w-10 p-0'
  )

  const pauseButtonClass = cn(
    iconButtonClass,
    isPaused
      ? 'border-amber-500/30 bg-amber-500/5 text-amber-500 shadow-none hover:bg-amber-500/10'
      : themedFooterHover
  )

  const endButtonClass = cn(
    iconButtonClass,
    'border-red-500/20 text-red-400 hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300'
  )

  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className={cn(
          'flex shrink-0 flex-col gap-2 pt-3',
          'mt-3',
          theme.footer,
          className
        )}
      >
        {esiMeta && (
          <div
            className={cn(
              'flex flex-col gap-0.5 text-[10px] leading-tight',
              theme.textMuted
            )}
            title={t('activity.ratting.footerSyncTooltip', {
              lastSync: esiMeta.lastSyncAt || 'N/A',
              lastChange: esiMeta.lastSyncWithChangesAt || 'N/A',
              count: esiMeta.syncCount ?? 0,
            })}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className={cn('font-bold uppercase tracking-wide', theme.text)}>ESI</span>
              <span>
                {esiMeta.lastSyncAt ? (
                  <FormattedDate date={esiMeta.lastSyncAt} mode="time" />
                ) : (
                  '—'
                )}
              </span>
              {esiMeta.lastSyncWithChangesAt ? (
                <>
                  <span className="opacity-40">·</span>
                  <span className={cn('opacity-80', theme.text)}>
                    {t('activity.ratting.esiLastChange')}{' '}
                    <FormattedDate date={esiMeta.lastSyncWithChangesAt} mode="time" />
                  </span>
                </>
              ) : syncRanWithoutChanges ? (
                <>
                  <span className="opacity-40">·</span>
                  <span className="text-amber-200/70">{t('activity.ratting.esiSyncOkNoChanges')}</span>
                </>
              ) : null}
            </div>
            {hasSyncErrors && (
              <div className="text-red-300/90">
                {syncErrors.map((err) => (
                  <span key={err.characterId} className="block truncate">
                    {err.reason === 'auth'
                      ? t('activity.ratting.esiReauthNeededFor', { name: err.characterName })
                      : t('activity.ratting.esiSyncFailedFor', { name: err.characterName })}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
        {/* 1. Sync Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
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
                  {syncStatus === 'idle' && <RefreshCw className={cn('h-4 w-4', theme.text)} />}
                </>
              )}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content 
              className="bg-eve-dark border border-eve-border/50 px-3 py-1.5 rounded-sm text-xs text-white z-[100]"
              sideOffset={5}
            >
              {isSyncing ? t('activity.footer.syncing') : t('activity.footer.syncData')}
              <Tooltip.Arrow className="fill-eve-border/50" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 2. Export Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
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
              className="z-[100] overflow-hidden rounded-sm border border-eve-border/50 bg-eve-dark px-3 py-1.5 text-xs text-white"
              sideOffset={5}
            >
              {hasPremium ? t('activity.footer.exportCsv') : t('activity.footer.premiumOnly')}
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 3. Pause/Resume Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
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
              className="bg-eve-dark border border-eve-border/50 px-3 py-1.5 rounded-sm text-xs text-white z-[100]"
              sideOffset={5}
            >
              {isPaused ? t('activity.footer.resume') : t('activity.footer.pause')}
              <Tooltip.Arrow className="fill-eve-border/50" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        {/* 4. End Button */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button
              type="button"
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
              className="bg-eve-dark border border-eve-border/50 px-3 py-1.5 rounded-sm text-xs text-white z-[100]"
              sideOffset={5}
            >
              {t('activity.footer.endActivity')}
              <Tooltip.Arrow className="fill-eve-border/50" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>

        </div>
      </div>
    </Tooltip.Provider>
  )
}
