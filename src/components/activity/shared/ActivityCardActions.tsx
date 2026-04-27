'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type ActivityType, getActivityColors } from '@/lib/constants/activity-colors'
import { 
  Plus, 
  Shield, 
  MapPin,
  Target,
  Loader2,
  Package
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from '@/i18n/hooks'

interface ActionConfig {
  label: string
  icon: React.ElementType
  onClick?: () => void
  only: 'compact' | 'expanded' | 'both'
  tooltip?: string
}

interface ActivityCardActionsProps {
  activityType: ActivityType
  mode: 'compact' | 'expanded'
  onOpenLootModal?: () => void
  onOpenSalvageModal?: () => void
  onOpenSafetyModal?: () => void
  onOpenBestOresModal?: () => void
  isLoading?: boolean
  className?: string
}

export function ActivityCardActions({
  activityType,
  mode,
  onOpenLootModal,
  onOpenSalvageModal,
  onOpenSafetyModal,
  onOpenBestOresModal,
  isLoading,
  className
}: ActivityCardActionsProps) {
  const { t } = useTranslations()
  const { label: activityLabel } = getActivityColors(activityType)
  const containerClass = mode === 'compact' ? "flex items-center gap-2" : "w-full space-y-2"

  const label = `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} Actions`

  const getButtonClass = (idx: number) => {
    if (mode === 'expanded') {
      return cn(
        "h-12 px-4 bg-zinc-900/40 border-white/[0.05] hover:bg-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
        idx === 0 && "bg-cyan-600/10 border-cyan-500/20 text-cyan-400 hover:bg-cyan-600/20"
      )
    }

    // Compact styles
    const baseCompact = "flex-1 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
    
    // First button (Primary action)
    if (idx === 0) {
      const activityColors: Record<ActivityType, string> = {
        mining: "bg-amber-600/20 border-amber-500/30 text-amber-500 hover:bg-amber-600/30 hover:border-amber-500/50",
        ratting: "bg-rose-600/20 border-rose-500/30 text-rose-500 hover:bg-rose-600/30 hover:border-rose-500/50",
        exploration: "bg-amber-600/20 border-amber-500/30 text-amber-500 hover:bg-amber-600/30 hover:border-amber-500/50",
        pvp: "bg-indigo-600/20 border-indigo-500/30 text-indigo-500 hover:bg-indigo-600/30 hover:border-indigo-500/50",
        industry: "bg-blue-600/20 border-blue-500/30 text-blue-500 hover:bg-blue-600/30 hover:border-blue-500/50",
        abyssal: "bg-purple-600/20 border-purple-500/30 text-purple-500 hover:bg-purple-600/30 hover:border-purple-500/50",
        crab: "bg-emerald-600/20 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600/30 hover:border-emerald-500/50",
        escalations: "bg-orange-600/20 border-orange-500/30 text-orange-500 hover:bg-orange-600/30 hover:border-orange-500/50"
      }
      return cn(baseCompact, "border", activityColors[activityType] || "bg-zinc-800 border-zinc-700")
    }

    // Secondary buttons (Add Loot/WISM/etc) - Use Cyan theme
    return cn(baseCompact, "bg-cyan-600/10 border border-cyan-500/20 hover:bg-cyan-600/20 hover:border-cyan-500/50 text-cyan-400")
  }

  const actionButtons: ActionConfig[] = (() => {
    switch (activityType) {
      case 'mining':
        /* Market / WISM live on the mining card header (icon buttons). */
        return []
      case 'ratting':
        return [
          {
            label: '',
            icon: Package,
            onClick: onOpenLootModal,
            only: 'both',
            tooltip: t('activity.ratting.lootHistory'),
          },
        ]
      case 'exploration':
        return [
          {
            label: 'Check',
            icon: Shield,
            onClick: onOpenSafetyModal,
            only: 'both',
          },
          {
            label: '+Loot',
            icon: Plus,
            onClick: onOpenLootModal,
            only: 'both',
          },
        ]
      default:
        return []
    }
  })()

  const visibleActions = actionButtons.filter(action => 
    action.only === 'both' || action.only === mode
  )

  if (visibleActions.length === 0) return null

  const content = (
    <div className={cn(mode === 'compact' ? "flex gap-2" : "flex gap-2", mode !== 'compact' && className)}>
      {visibleActions.map((action, idx) => {
        const Icon = action.icon

        return (
          <Tooltip key={idx}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isLoading}
                onClick={action.onClick}
                className={cn(getButtonClass(idx))}
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                {action.label && <span>{action.label}</span>}
              </Button>
            </TooltipTrigger>
            {action.tooltip && (
              <TooltipContent>
                {action.tooltip}
              </TooltipContent>
            )}
          </Tooltip>
        )
      })}
    </div>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn(containerClass, className)}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">{label}</p>
        </div>
        {content}
      </div>
    </TooltipProvider>
  )
}